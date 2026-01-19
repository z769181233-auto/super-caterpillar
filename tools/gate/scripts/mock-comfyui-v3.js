const http = require('http');
const crypto = require('crypto');

const server = http.createServer((req, res) => {
  console.log(`[MOCK_COMFY] Incoming request: ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.url === '/prompt') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      console.log(`[MOCK_COMFY] Prompt Body: ${body.substring(0, 100)}...`);
      const hash = crypto.createHash('sha256').update(body).digest('hex').substring(0, 8);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prompt_id: 'pid_' + hash }));
    });
  } else if (req.method === 'GET' && req.url.startsWith('/history/')) {
    const pid = req.url.split('/history/')[1];
    console.log(`[MOCK_COMFY] Fetching history for ${pid}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const output = {
      [pid]: {
        status: { completed: true },
        outputs: {
          9: {
            text: [
              JSON.stringify({
                shots: [
                  {
                    index: 1,
                    shot_type: 'MEDIUM_SHOT',
                    visual_prompt: 'V3 E2E Mock Output',
                    camera_movement: 'STATIC',
                  },
                ],
              }),
            ],
          },
        },
      },
    };
    res.end(JSON.stringify(output));
  } else {
    console.warn(`[MOCK_COMFY] 404 for ${req.url}`);
    res.writeHead(404);
    res.end();
  }
});

server.listen(18188, () => {
  console.log('Mock ComfyUI running on 18188');
});
