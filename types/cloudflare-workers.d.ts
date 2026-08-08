interface D1PreparedStatement {
  bind(...values: readonly unknown[]): D1PreparedStatement;
  all<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<{ readonly results: readonly T[] }>;
  first<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: readonly D1PreparedStatement[]): Promise<readonly unknown[]>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  const env: { readonly DB?: D1Database; readonly SITE_INGEST_TOKEN?: string };
  export { env };
}
