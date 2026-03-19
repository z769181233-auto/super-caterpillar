const { Client } = require('pg');

export function isCiOrGateContextEnv(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.CI === '1' ||
    !!process.env.JEST_WORKER_ID ||
    process.env.GATE_ENV_MODE === 'ci'
  );
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  const message = String((error as any)?.message || '');
  return (
    message.includes('startup connect exceeded') ||
    message.includes('PRISMA_CONNECT_TIMEOUT') ||
    message.includes("Can't reach database server") ||
    message.includes('P1001')
  );
}

export function isPrismaFallbackEligibleError(error: unknown): boolean {
  const message = String((error as any)?.message || '');
  return message.includes('PRISMA_QUERY_TIMEOUT') || isDatabaseUnavailableError(error);
}

export function getRuntimeDbTimeoutMs(kind: 'connect' | 'query' | 'slowQueryWarn'): number {
  const ciOrGate = isCiOrGateContextEnv();

  switch (kind) {
    case 'connect':
      return Number(process.env.PRISMA_CONNECT_TIMEOUT_MS || (ciOrGate ? '5000' : '15000'));
    case 'query':
      return Number(process.env.PRISMA_QUERY_TIMEOUT_MS || (ciOrGate ? '5000' : '15000'));
    case 'slowQueryWarn':
      return Number(process.env.PRISMA_SLOW_QUERY_WARN_MS || (ciOrGate ? '1000' : '2000'));
  }
}

export function buildPrismaDatasourceUrl(
  rawUrl: string | undefined,
  connectTimeoutMs: number,
  queryTimeoutMs: number,
  applicationName = 'super-caterpillar-api'
): string | undefined {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    const connectTimeoutSec = String(Math.max(1, Math.ceil(connectTimeoutMs / 1000)));
    const poolTimeoutSec = String(Math.max(1, Math.ceil(queryTimeoutMs / 1000)));

    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', connectTimeoutSec);
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', poolTimeoutSec);
    }
    if (!url.searchParams.has('application_name')) {
      url.searchParams.set('application_name', applicationName);
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function buildRuntimePgConnectionString(
  rawUrl: string | undefined,
  applicationName: string,
  connectTimeoutMs = getRuntimeDbTimeoutMs('connect')
): string | undefined {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    const connectTimeoutSec = String(Math.max(1, Math.ceil(connectTimeoutMs / 1000)));

    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', connectTimeoutSec);
    }
    if (!url.searchParams.has('application_name')) {
      url.searchParams.set('application_name', applicationName);
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function createRuntimePgClient(options: {
  applicationName: string;
  connectionString?: string;
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
  statementTimeoutMs?: number;
}) {
  const connectionTimeoutMs = options.connectionTimeoutMs ?? getRuntimeDbTimeoutMs('connect');
  const queryTimeoutMs = options.queryTimeoutMs ?? getRuntimeDbTimeoutMs('query');
  const statementTimeoutMs = options.statementTimeoutMs ?? queryTimeoutMs;
  const connectionString = buildRuntimePgConnectionString(
    options.connectionString ?? process.env.DATABASE_URL,
    options.applicationName,
    connectionTimeoutMs
  );

  if (!connectionString) {
    throw new Error('DATABASE_URL required for pg fallback');
  }

  return new Client({
    connectionString,
    connectionTimeoutMillis: connectionTimeoutMs,
    statement_timeout: statementTimeoutMs,
    query_timeout: queryTimeoutMs,
  });
}

export async function withRuntimePgClient<T>(
  options: {
    applicationName: string;
    connectionString?: string;
    connectionTimeoutMs?: number;
    queryTimeoutMs?: number;
    statementTimeoutMs?: number;
  },
  fn: (client: any) => Promise<T>
): Promise<T> {
  const client = createRuntimePgClient(options);

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}
