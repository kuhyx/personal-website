#!/bin/bash
#
# deploy.sh — deploy personal-website for real, then prove it is live.
#
# The live site is served from the checkout at ~/src/personal-website (a caddy
# container bind-mounts its dist/, a system unit runs its dist-admin/), so a
# deploy is: fast-forward that checkout, rerun the installer that owns the
# stack, then health-check what is actually being served.
#
# Usage:
#   scripts/deploy.sh           Pull, then full or fast deploy, health-check.
#   scripts/deploy.sh --full    Pull, always run the full installer.
#   scripts/deploy.sh --check   Health-check only (no pull, no build).
#
# Full vs fast: the full installer (pnpm install, astro build, gitea/caddy/
# firewall, admin unit) takes minutes on a loaded host. After it passes, the
# deployed commit + installer hash go into a stamp. While both still match,
# a rerun takes the fast path: recreate the container (`setup serve`) and
# start the admin unit if it is down. Any failed run deletes the stamp, so
# the next run is full again.
#
# Every run appends "<time> mode=<m> head=<sha> exit=<n>" to
# $STATE/deploy.log, so the outcome survives a killed caller.
#
# Idempotent. Exits non-zero if any step or check fails.
#
# Overridable for testing (defaults are the live ones):
#   PW_DEPLOY_SRC, PW_DEPLOY_SETUP, PW_DEPLOY_STATE, PW_DEPLOY_LOCAL_URL,
#   PW_DEPLOY_PUBLIC_URL, PW_DEPLOY_ADMIN_URL

set -euo pipefail

readonly SRC="${PW_DEPLOY_SRC:-${HOME}/src/personal-website}"
readonly SETUP="${PW_DEPLOY_SETUP:-${HOME}/src/testsAndMisc/linux_configuration/features/setup_personal_website.sh}"
readonly LOCAL_URL="${PW_DEPLOY_LOCAL_URL:-http://127.0.0.1:8088}"
readonly PUBLIC_URL="${PW_DEPLOY_PUBLIC_URL:-https://kuhy.duckdns.org}"
readonly ADMIN_URL="${PW_DEPLOY_ADMIN_URL:-http://127.0.0.1:4321/admin}"
readonly STATE="${PW_DEPLOY_STATE:-${XDG_STATE_HOME:-${HOME}/.local/state}/personal-website-deploy}"
readonly STAMP="${STATE}/deployed"
readonly RECORD="${STATE}/deploy.log"
readonly CONTAINER="personal-website"
readonly ADMIN_UNIT="personal-website-admin.service"

FAILURES=0

pass() { printf 'PASS %s\n' "$1"; }
fail() {
	printf 'FAIL %s\n' "$1" >&2
	FAILURES=$((FAILURES + 1))
}
die() {
	printf 'deploy: %s\n' "$1" >&2
	exit 1
}

# HTTP status of a URL; 000 when unreachable. -k only matters for the public
# URL and keeps a cert hiccup from masking whether the content is right.
http_code() {
	curl -sk -o /dev/null -w '%{http_code}' --max-time 10 "$1" || true
}

# check <name> <command...>: record a PASS/FAIL line instead of aborting, so
# one run reports every broken check rather than only the first.
check() {
	local name="$1"
	shift
	if "$@"; then pass "$name"; else fail "$name"; fi
}

is_200() { [[ "$(http_code "$1")" == "200" ]]; }
is_404() { [[ "$(http_code "$1")" == "404" ]]; }

container_running() {
	[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" == "true" ]]
}

admin_active() { systemctl is-active --quiet "$ADMIN_UNIT"; }

# The served landing page must be the build of the checkout we just pulled,
# not a stale dist/ or a stale bind mount.
serves_current_build() {
	cmp -s <(curl -s --max-time 10 "${LOCAL_URL}/") "${SRC}/dist/index.html"
}

checkout_at_origin() {
	git -C "$SRC" fetch -q origin main &&
		[[ "$(git -C "$SRC" rev-parse HEAD)" == "$(git -C "$SRC" rev-parse origin/main)" ]]
}

health_check() {
	local missing="${LOCAL_URL}/__deploy-check-missing-$$"
	check "container ${CONTAINER} running" container_running
	check "${ADMIN_UNIT} active" admin_active
	check "admin answers ${ADMIN_URL}" is_200 "$ADMIN_URL"
	check "local site ${LOCAL_URL}/ 200" is_200 "${LOCAL_URL}/"
	check "public site ${PUBLIC_URL}/ 200" is_200 "${PUBLIC_URL}/"
	check "unknown path 404" is_404 "$missing"
	check "served / matches ${SRC}/dist/index.html" serves_current_build
	check "checkout at origin/main" checkout_at_origin
	if ((FAILURES > 0)); then
		die "${FAILURES} health check(s) failed."
	fi
	printf 'deploy: all health checks passed.\n'
}

# What a deploy depends on: the checkout's commit and the installer code.
# The installer's lib/ files are hashed too, since most of it lives there.
deploy_fingerprint() {
	local lib="${SETUP%/*}/lib"
	printf '%s %s\n' "$(git -C "$SRC" rev-parse HEAD)" \
		"$(cat "$SETUP" "$lib"/website_*.sh "$lib"/static_site_caddy.sh 2>/dev/null | sha256sum | cut -d' ' -f1)"
}

MODE="check"

# EXIT trap: append the outcome, and drop the stamp on failure so a broken
# deploy is never skipped by the fast path.
record_result() {
	local rc=$?
	mkdir -p "$STATE"
	if ((rc != 0)); then rm -f -- "$STAMP"; fi
	printf '%s mode=%s head=%s exit=%d\n' "$(date -Is)" "$MODE" \
		"$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo none)" "$rc" >>"$RECORD"
	printf 'deploy: mode=%s exit=%d\n' "$MODE" "$rc"
}

ensure_admin_running() {
	admin_active || sudo -n systemctl restart "$ADMIN_UNIT"
}

deploy() {
	[[ -d "$SRC/.git" ]] || die "No checkout at ${SRC}."
	[[ -x "$SETUP" ]] || die "Installer not found: ${SETUP}."
	git -C "$SRC" pull --ff-only
	local want
	want="$(deploy_fingerprint)"
	if [[ "$1" != "--full" && -f "$STAMP" && "$(cat "$STAMP")" == "$want" ]]; then
		MODE="fast"
		bash "$SETUP" serve
		ensure_admin_running
	else
		MODE="full"
		rm -f -- "$STAMP"
		bash "$SETUP" setup
	fi
	health_check
	mkdir -p "$STATE"
	printf '%s\n' "$want" >"$STAMP"
}

main() {
	trap record_result EXIT
	case "${1:-}" in
	--check) health_check ;;
	"" | --full) deploy "${1:-}" ;;
	*) die "Unknown argument: $1 (use --full, --check or nothing)." ;;
	esac
}

main "$@"
