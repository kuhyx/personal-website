/** The response record every route returns, and the two JSON shapes they build it from. */

/** A response, ready for the socket layer to write. */
export interface AdminResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
}

const JSON_TYPE = "application/json";

export function json(status: number, value: unknown, extra: Record<string, string> = {}): AdminResponse {
  return {
    status,
    headers: { "Content-Type": JSON_TYPE, "Cache-Control": "no-store", ...extra },
    body: JSON.stringify(value),
  };
}

export function fail(status: number, message: string, extra: Record<string, string> = {}): AdminResponse {
  return json(status, { error: message }, extra);
}
