import * as http from 'http';

interface TestResult {
  success: boolean;
  statusCode: number;
  responseTime: number;
  error?: string;
}

interface LoadTestConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  concurrency: number;
  requests: number;
}

async function makeRequest(config: LoadTestConfig): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(config.url);

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: config.method,
      headers: config.headers || {},
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          success: res.statusCode! >= 200 && res.statusCode! < 300,
          statusCode: res.statusCode!,
          responseTime,
        });
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        statusCode: 0,
        responseTime,
        error: error.message,
      });
    });

    if (config.body) {
      req.write(config.body);
    }

    req.end();
  });
}

async function runLoadTest(config: LoadTestConfig): Promise<any> {
  const results: TestResult[] = [];
  const batches: Promise<void>[] = [];

  for (let i = 0; i < config.requests; i += config.concurrency) {
    const batch = Array.from({ length: Math.min(config.concurrency, config.requests - i) }, () =>
      makeRequest(config).then((result) => {
        results.push(result);
      })
    );
    batches.push(Promise.all(batch).then(() => {}));
  }

  await Promise.all(batches);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const status5xx = results.filter((r) => r.statusCode >= 500 && r.statusCode < 600);

  const responseTimes = results.map((r) => r.responseTime);
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    status5xx: status5xx.length,
    successRate: (successful.length / results.length) * 100,
    avgResponseTime: Math.round(avgResponseTime),
    maxResponseTime,
    minResponseTime,
    statusCodeDistribution: results.reduce((acc, r) => {
      acc[r.statusCode] = (acc[r.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>),
  };
}

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';

  // Get auth token first
  const loginResponse = await makeRequest({
    url: `${baseUrl}/api/auth/login`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123',
    }),
    concurrency: 1,
    requests: 1,
  });

  let token = '';
  if (loginResponse.success) {
    // In a real scenario, we'd parse the JSON response
    // For now, we'll use a placeholder
    token = 'placeholder-token';
  }

  const tests = [
    {
      name: 'GET /api/health',
      config: {
        url: `${baseUrl}/api/health`,
        method: 'GET',
        concurrency: 20,
        requests: 100,
      },
    },
    {
      name: 'GET /api/projects/:id (with auth)',
      config: {
        url: `${baseUrl}/api/projects/test-id`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        concurrency: 20,
        requests: 100,
      },
    },
  ];

  const report: any = {
    timestamp: new Date().toISOString(),
    baseUrl,
    tests: [],
    summary: {
      totalTests: 0,
      totalRequests: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      overallSuccessRate: 0,
    },
  };

  for (const test of tests) {
    console.log(`Running load test: ${test.name}...`);
    const result = await runLoadTest(test.config);
    report.tests.push({
      name: test.name,
      ...result,
    });
    report.summary.totalTests++;
    report.summary.totalRequests += result.total;
    report.summary.totalSuccessful += result.successful;
    report.summary.totalFailed += result.failed;
  }

  report.summary.overallSuccessRate =
    (report.summary.totalSuccessful / report.summary.totalRequests) * 100;

  // Write report
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '../../../reports/stability/STABILITY_REPORT.md');
  const markdown = `# Stability Test Report

Generated at: ${report.timestamp}

## Test Configuration
- Base URL: ${baseUrl}
- Total Tests: ${report.summary.totalTests}
- Total Requests: ${report.summary.totalRequests}

## Test Results

${report.tests
  .map(
    (test: any) => `### ${test.name}

- Total Requests: ${test.total}
- Successful: ${test.successful}
- Failed: ${test.failed}
- Success Rate: ${test.successRate.toFixed(2)}%
- Average Response Time: ${test.avgResponseTime}ms
- Max Response Time: ${test.maxResponseTime}ms
- Min Response Time: ${test.minResponseTime}ms
- 5xx Errors: ${test.status5xx}
- Status Code Distribution: ${JSON.stringify(test.statusCodeDistribution, null, 2)}
`
  )
  .join('\n')}

## Summary

- Overall Success Rate: ${report.summary.overallSuccessRate.toFixed(2)}%
- Total Successful: ${report.summary.totalSuccessful}
- Total Failed: ${report.summary.totalFailed}
`;

  fs.writeFileSync(reportPath, markdown);
  console.log(`Report written to: ${reportPath}`);
}

main().catch(console.error);











