import express from 'express';
import { createRoutes } from './routes';

export function createApp() {
  const app = express();
  const bodyLimit = process.env.ANIME_STUDIO_V2_BODY_LIMIT || '64mb';
  const configuredOrigins = (process.env.ANIME_STUDIO_V2_WEB_ORIGIN || 'http://localhost:4311,http://127.0.0.1:4311')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    const allowedOrigin = requestOrigin && configuredOrigins.includes(requestOrigin) ? requestOrigin : configuredOrigins[0];
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });
  app.use(express.json({ limit: bodyLimit }));
  app.use(createRoutes());
  return app;
}
