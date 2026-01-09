import http from 'http';
import { metricsText } from '@scu/observability';

export function startMetricsServer(port: number) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        const metrics = await metricsText();
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(metrics);
      } catch (err) {
        res.writeHead(500);
        res.end('Error collecting metrics');
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`[Metrics] Server running at http://localhost:${port}/metrics`);
  });

  return server;
}
