/** A static endpoint's body with its content type (UTF-8). */
export function textResponse(body: string, type: string): Response {
  return new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8` } });
}
