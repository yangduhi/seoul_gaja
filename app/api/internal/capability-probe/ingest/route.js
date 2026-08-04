import "server-only";

import { env } from "cloudflare:workers";

import {
  CAPABILITY_PROBE_NAME,
  authorizeCapabilityProbe,
  createD1CapabilityAdapter,
  exerciseD1CapabilityLifecycle,
} from "../../../../../server/phase-00-capability-probe.mjs";

const MAX_SYNTHETIC_PAYLOAD_BYTES = 4096;

export async function POST(request) {
  const authorization = authorizeCapabilityProbe(
    request.headers.get("authorization"),
    env.SITE_INGEST_TOKEN,
  );
  if (authorization.kind === "unavailable") {
    return Response.json({ error: "capability_probe_unavailable" }, { status: 503 });
  }
  if (authorization.kind === "rejected") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_SYNTHETIC_PAYLOAD_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
    throw error;
  }
  if (!isSyntheticPayload(payload)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    const probeId = crypto.randomUUID();
    const payloadHash = await sha256(JSON.stringify(payload));
    const lifecycle = await exerciseD1CapabilityLifecycle(
      createD1CapabilityAdapter(env.DB),
      probeId,
      payloadHash,
    );
    return Response.json({ probe: CAPABILITY_PROBE_NAME, probeId: lifecycle.probeId, cleanup: lifecycle.cleanup }, { status: 202 });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: "capability_probe_unavailable" }, { status: 503 });
    }
    throw error;
  }
}

function isSyntheticPayload(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
