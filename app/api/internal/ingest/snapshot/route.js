import "server-only";

import { env } from "cloudflare:workers";

import { handleIngestSnapshot } from "../../../../../server/ingest-snapshot-request.mjs";

export function POST(request) {
  return handleIngestSnapshot(request, env.SITE_INGEST_TOKEN);
}
