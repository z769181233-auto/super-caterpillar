import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuthResponse } from './auth-response';

test('parseAuthResponse returns parsed payload for valid json', async () => {
  const response = new Response(JSON.stringify({ success: false, message: 'bad request' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });

  const payload = await parseAuthResponse(response);

  assert.deepEqual(payload, { success: false, message: 'bad request' });
});

test('parseAuthResponse returns null for empty response body', async () => {
  const response = new Response('', { status: 503 });

  const payload = await parseAuthResponse(response);

  assert.equal(payload, null);
});

test('parseAuthResponse falls back to raw message for non-json response body', async () => {
  const response = new Response('<html>service unavailable</html>', { status: 503 });

  const payload = await parseAuthResponse(response);

  assert.deepEqual(payload, { message: '<html>service unavailable</html>' });
});
