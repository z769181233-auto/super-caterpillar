import express from 'express';
import * as util from 'util';

const app = express();
app.use(express.json());

const handler = (req: any, res: any) => {
  const body = req.body || {};
  const mode = body?.payload?.mode || 'SUCCESS';

  console.log(`[MockHttpEngine] Received ${req.method} ${req.path}`);

  if (mode === 'SUCCESS') {
    return res.json({
      success: true,
      data: {
        // Redundant structure to satisfy various mapping versions
        volumes: [
          {
            index: 1,
            title: 'Volume 1',
            chapters: [
              {
                index: 1,
                title: 'Chapter 1',
                summary: 'Chapter summary sentence one. Chapter summary sentence two.',
                scenes: [
                  {
                    index: 1,
                    title: 'Scene 1',
                    summary: 'Scene summary sentence one. Scene summary sentence two.',
                    content: 'Scene content sentence one. Scene content sentence two.',
                  }
                ]
              }
            ]
          }
        ],
        seasons: [
          {
            index: 1,
            title: 'Season 1',
            episodes: [
              {
                index: 1,
                title: 'Episode 1',
                scenes: [
                  {
                    index: 1,
                    title: 'Scene 1',
                    summary: 'The first scene of the episode.',
                    shots: [
                      { index: 1, title: 'Shot 1-1', text: 'Visual content for first shot.' },
                      { index: 2, title: 'Shot 1-2', text: 'Visual content for second shot.' },
                    ]
                  },
                  {
                    index: 2,
                    title: 'Scene 2',
                    summary: 'The second scene of the episode.',
                    shots: [
                      { index: 1, title: 'Shot 2-1', text: 'Visual content for first shot in second scene.' },
                      { index: 2, title: 'Shot 2-2', text: 'Visual content for second shot in second scene.' },
                    ]
                  }
                ]
              }
            ]
          }
        ],
        debugEcho: body,
      },
      metrics: {
        durationMs: 123,
        tokens: 50,
        costUsd: 0.01,
      },
    });
  }

  if (mode === 'FAILED') {
    return res.json({
      success: false,
      error: {
        message: 'Business failed in mock engine',
        code: 'BUSINESS_ERROR',
        details: { mode },
      },
    });
  }

  return res.json({
    success: false,
    error: {
      message: 'Unknown mode',
      code: 'UNKNOWN_MODE',
      details: { mode },
    },
  });
};

app.post('/invoke', handler);
app.post('/story/parse', handler);
app.post('/text/visual-density', handler);
app.post('/text/enrich', handler);
app.post('/render/shot', handler);
// Catch-all
app.post('*', handler);

const port = 19000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  process.stdout.write(
    util.format(`[MockHttpEngine] listening on http://localhost:${port}`) + '\n'
  );
});
