import express from 'express';

const app = express();
app.use(express.json());

app.post('/invoke', (req, res) => {
  const body = req.body || {};
  const mode = body?.payload?.mode || 'SUCCESS';

  if (mode === 'SUCCESS') {
    return res.json({
      success: true,
      data: {
        seasons: [],
        episodes: [],
        debugEcho: body, // 回显请求体，方便调试
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

  if (mode === 'RETRYABLE') {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Temporary server error',
        code: 'MOCK_5XX',
        details: { mode },
      },
    });
  }

  // 未知模式，当成 FAILED 处理
  return res.json({
    success: false,
    error: {
      message: 'Unknown mode',
      code: 'UNKNOWN_MODE',
      details: { mode },
    },
  });
});

const port = 19000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[MockHttpEngine] listening on http://localhost:${port}`);
});
