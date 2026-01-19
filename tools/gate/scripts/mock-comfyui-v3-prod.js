const http = require('http');
const crypto = require('crypto');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/prompt') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const hash = crypto.createHash('sha256').update(body).digest('hex').substring(0, 8);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prompt_id: 'pid_' + hash }));
    });
  } else if (req.method === 'GET' && req.url.startsWith('/history/')) {
    const pid = req.url.split('/history/')[1];
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
                    visual_prompt: 'V3 Production Receipt Mock Output',
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
    res.writeHead(404);
    res.end();
  }
});

server.listen(18189, () => {
  console.log('Mock ComfyUI running on 18189');
});
