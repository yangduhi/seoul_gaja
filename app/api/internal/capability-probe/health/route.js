import "server-only";

import { env } from "cloudflare:workers";

import { createCapabilityProbeRouteHandlers } from "../../../../../server/phase-00-capability-probe.mjs";

const handlers = createCapabilityProbeRouteHandlers(env);

export function GET(request) {
  return handlers.GET(request);
}
