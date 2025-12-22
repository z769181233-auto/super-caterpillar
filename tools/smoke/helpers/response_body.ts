// tools/smoke/helpers/response_body.ts
export async function readResponseBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}
