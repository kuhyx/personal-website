#!/bin/bash
#
# test_deploy.sh — check deploy.sh's run-mode choice and its durable record.
#
# Swaps the installer for a stub that logs its argument, so no build runs.
# The health checks still hit the live site, so run it where the site is up.
#
#   1. no stamp      -> full installer ("setup"), stamp written, record exit=0
#   2. stamp current -> fast path ("serve"), record exit=0
#   3. broken check  -> exit non-zero, record exit=1
#   4. --full        -> full installer even with a current stamp

set -euo pipefail

DEPLOY="$(dirname "$(readlink -f "$0")")/deploy.sh"
readonly DEPLOY
TMP="$(mktemp -d)"
readonly TMP
trap 'rm -rf -- "$TMP"' EXIT

readonly STUB="${TMP}/setup_stub.sh"
readonly CALLS="${TMP}/calls"
readonly STATE="${TMP}/state"
# shellcheck disable=SC2016 # $1 is for the stub, not this shell
printf '#!/bin/bash\necho "$1" >>"%s"\n' "$CALLS" >"$STUB"
chmod +x "$STUB"

FAILED=0
expect() {
	if [[ "$2" == "$3" ]]; then
		echo "ok   $1"
	else
		echo "FAIL $1: want '$3', got '$2'"
		FAILED=1
	fi
}

run() { PW_DEPLOY_SETUP="$STUB" PW_DEPLOY_STATE="$STATE" "$DEPLOY" "$@" >/dev/null 2>&1; }
last_call() { tail -n 1 "$CALLS" 2>/dev/null || echo none; }
last_exit() { tail -n 1 "${STATE}/deploy.log" 2>/dev/null | grep -o 'exit=[0-9]*' || echo none; }

run && rc=0 || rc=$?
expect "1 first run exits 0" "$rc" 0
expect "1 first run uses full installer" "$(last_call)" setup
expect "1 stamp written" "$([[ -s ${STATE}/deployed ]] && echo yes || echo no)" yes
expect "1 record exit" "$(last_exit)" exit=0

run && rc=0 || rc=$?
expect "2 rerun exits 0" "$rc" 0
expect "2 rerun uses fast path" "$(last_call)" serve
expect "2 record exit" "$(last_exit)" exit=0

PW_DEPLOY_LOCAL_URL=http://127.0.0.1:1 run && rc=0 || rc=$?
expect "3 broken check exits 1" "$rc" 1
expect "3 record exit" "$(last_exit)" exit=1

run --full && rc=0 || rc=$?
expect "4 --full exits 0" "$rc" 0
expect "4 --full uses full installer" "$(last_call)" setup

exit "$FAILED"
