import {
  createProvenanceReceipt,
  persistDerivedSourceBinding,
  persistProvenanceReceipt,
  ProvenancePolicyError,
} from "./provenance-cadence.mjs";

const MAX_PAYLOAD_BYTES = 1024 * 1024;
const CATALOG_SIZE = 121;
const CROWD_LEVELS = new Set(["RELAXED", "NORMAL", "BUSY", "CROWDED", "UNKNOWN"]);
const AVAILABILITY = new Set(["available", "carried_forward", "unavailable", "expired"]);
const PROVENANCE = new Set(["refreshed", "carried_forward", "missing"]);

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

function isIsoTimestamp(value) {
  return typeof value === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isSnapshotRow(row) {
  return Boolean(row)
    && typeof row === "object"
    && !Array.isArray(row)
    && typeof row.areaCode === "string"
    && row.areaCode.length > 0
    && typeof row.areaName === "string"
    && row.areaName.length > 0
    && AVAILABILITY.has(row.availability)
    && PROVENANCE.has(row.provenance)
    && CROWD_LEVELS.has(row.crowdLevel)
    && (row.sourceUpdatedAt === null || isIsoTimestamp(row.sourceUpdatedAt))
    && isIsoTimestamp(row.fetchedAt)
    && !Object.hasOwn(row, "source_updated_at")
    && !Object.hasOwn(row, "fetched_at");
}

function parseSnapshot(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.contractVersion !== "1.0.0" || typeof payload.snapshotId !== "string" || payload.snapshotId.length === 0 || typeof payload.catalogVersion !== "string" || payload.catalogVersion.length === 0) return null;
  if (!Array.isArray(payload.rows) || payload.rows.length !== CATALOG_SIZE || !payload.rows.every(isSnapshotRow)) return null;
  const areaCodes = new Set(payload.rows.map((row) => row.areaCode));
  if (areaCodes.size !== CATALOG_SIZE) return null;
  const meta = payload.meta;
  if (!meta || meta.attempted !== CATALOG_SIZE || !Number.isInteger(meta.refreshed) || !Number.isInteger(meta.carriedForward) || !Number.isInteger(meta.unavailable)) return null;
  if (meta.refreshed < 0 || meta.carriedForward < 0 || meta.unavailable < 0 || meta.refreshed + meta.carriedForward + meta.unavailable !== CATALOG_SIZE) return null;
  return payload;
}

export async function handleIngestSnapshot(request, expectedToken, database) {
  if (request.method !== "POST") return jsonError("method_not_allowed", 405);
  if (typeof expectedToken !== "string" || expectedToken.length === 0) return jsonError("ingest_unavailable", 503);
  if (request.headers.get("authorization") !== `Bearer ${expectedToken}`) return jsonError("unauthorized", 401);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_PAYLOAD_BYTES) return jsonError("payload_too_large", 413);

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("invalid_json", 400);
    throw error;
  }
  const snapshot = parseSnapshot(payload);
  if (snapshot === null) return jsonError("invalid_payload", 422);

  const { provenanceReceipt, ...canonicalPayload } = snapshot;
  let receipt;
  try {
    receipt = createProvenanceReceipt({
      ...provenanceReceipt,
      accepted_status: "accepted",
      canonical_payload: canonicalPayload,
    });
  } catch (error) {
    if (error instanceof ProvenancePolicyError) return jsonError("invalid_provenance", 422);
    throw error;
  }

  try {
    await persistProvenanceReceipt(database, receipt);
    await persistDerivedSourceBinding(database, {
      derived_kind: "materialization",
      derived_key: snapshot.snapshotId,
      receipt,
    });
  } catch (error) {
    if (error instanceof ProvenancePolicyError && /CONFLICT$/.test(error.code)) return jsonError("provenance_conflict", 409);
    if (error instanceof ProvenancePolicyError) return jsonError("provenance_storage_unavailable", 503);
    if (error instanceof Error) return jsonError("provenance_storage_error", 503);
    throw error;
  }

  return Response.json({
    status: "accepted",
    snapshotId: snapshot.snapshotId,
    catalogVersion: snapshot.catalogVersion,
    attempted: snapshot.meta.attempted,
    receiptId: receipt.receipt_id,
    receiptVersion: receipt.receipt_version,
    canonicalPayloadSha256: receipt.canonical_payload_sha256,
    sourceReceiptId: receipt.receipt_id,
    sourceReceiptVersion: receipt.receipt_version,
  }, { status: 202 });
}
