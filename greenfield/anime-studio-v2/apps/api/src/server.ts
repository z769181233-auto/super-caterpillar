import { createApp } from './app';
const port = Number(process.env.PORT || 4310);

const app = createApp();

app.listen(port, () => {
  console.log(`[anime-studio-v2-api] listening on http://localhost:${port}`);
});
