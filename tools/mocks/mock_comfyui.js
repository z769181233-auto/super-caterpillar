const http = require('http');

console.log('Starting Mock ComfyUI Server on port 8188...');

const server = http.createServer((req, res) => {
  console.log(`[MockComfy] ${req.method} ${req.url}`);

  if (req.method === 'POST' && req.url === '/prompt') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      console.log('[MockComfy] Received Prompt:', body.substring(0, 100));
      const promptId = 'mock_pid_' + Date.now();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prompt_id: promptId, number: 1, node_errors: {} }));
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/history/')) {
    // Return completed status immediately
    const promptId = req.url.split('/').pop();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const history = {
      [promptId]: {
        outputs: {
          9: {
            images: [{ filename: 'mock.png', subfolder: '', type: 'output' }],
          },
        },
        status: {
          status_str: 'success',
          completed: true,
        },
      },
    };
    res.end(JSON.stringify(history));
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/view')) {
    // Return dummy PNG
    res.writeHead(200, { 'Content-Type': 'image/png' });
    // 1x1 transparent png
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    res.end(png);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(8188, () => {
  console.log('Mock ComfyUI listening on 8188');
});
