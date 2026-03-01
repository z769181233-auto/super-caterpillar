/**
 * Health Check Helper
 * 访问 /health/ready, /health/live, /health/gpu
 */

import { readResponseBody } from './response_body';

export interface HealthCheckResult {
  endpoint: string;
  status: number;
  response: any;
  timestamp: string;
}

export async function checkHealth(
  apiBaseUrl: string,
  endpoints: string[] = ['/health/ready', '/health/live', '/health/gpu', '/health']
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  for (const endpoint of endpoints) {
    try {
      const url = `${apiBaseUrl}${endpoint}`;
      const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      const data = await readResponseBody(response);

      results.push({
        endpoint,
        status: response.status,
        response: data,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      results.push({
        endpoint,
        status: 0,
        response: { error: error?.message ?? String(error) },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}
