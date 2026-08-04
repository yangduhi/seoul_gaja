import "server-only";

import { env } from "cloudflare:workers";

import { CAPABILITY_PROBE_NAME, createD1CapabilityAdapter } from "../../../../../server/phase-00-capability-probe.mjs";

export async function GET() {
  try {
    await createD1CapabilityAdapter(env.DB).health();
    return Response.json({ probe: CAPABILITY_PROBE_NAME, status: "healthy" });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ probe: CAPABILITY_PROBE_NAME, status: "unavailable" }, { status: 503 });
    }
    throw error;
  }
}
