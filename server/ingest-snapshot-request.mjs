import {
  canonicalPayloadSha256,
  createProvenanceReceipt,
  ProvenancePolicyError,
} from "./provenance-cadence.mjs";
import { RequestBodyTooLargeError, readJsonBodyWithinLimit } from "./request-body.mjs";
import {
  persistAcceptedSnapshot,
  SnapshotMaterializationError,
} from "./snapshot-materialization.mjs";

const MAX_PAYLOAD_BYTES = 1024 * 1024;
const CATALOG_SIZE = 121;
const CROWD_LEVELS = new Set(["RELAXED", "NORMAL", "BUSY", "CROWDED", "UNKNOWN"]);
const FORECAST_CROWD_LEVELS = new Set(["RELAXED", "NORMAL", "BUSY", "CROWDED"]);
const AVAILABILITY = new Set(["available", "carried_forward", "unavailable", "expired"]);
const PROVENANCE = new Set(["refreshed", "carried_forward", "missing"]);
const SHA256 = /^[a-f0-9]{64}$/;

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

function isIsoTimestamp(value) {
  return typeof value === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isNullablePopulation(value) {
  return value === null || Number.isSafeInteger(value) && value >= 0;
}

function hasValidPopulationRange(minimum, maximum) {
  return isNullablePopulation(minimum)
    && isNullablePopulation(maximum)
    && ((minimum === null && maximum === null) || (Number.isSafeInteger(minimum) && Number.isSafeInteger(maximum) && minimum <= maximum));
}

function isForecastPoint(point, sourceUpdatedAt, fetchedAt) {
  return Boolean(point)
    && typeof point === "object"
    && !Array.isArray(point)
    && isIsoTimestamp(point.timestamp)
    && Date.parse(point.timestamp) > Date.parse(fetchedAt)
    && FORECAST_CROWD_LEVELS.has(point.crowdLevel)
    && point.sourceUpdatedAt === sourceUpdatedAt
    && (point.authority === undefined || point.authority === "official")
    && point.synthetic !== true
    && hasValidPopulationRange(point.populationMin, point.populationMax)
    && !Object.hasOwn(point, "crowd_level")
    && !Object.hasOwn(point, "source_updated_at");
}

function isOfficialForecast(value, sourceUpdatedAt, fetchedAt) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.authority !== "official" || value.synthetic === true || value.sourceUpdatedAt !== sourceUpdatedAt || value.fetchedAt !== fetchedAt || !SHA256.test(value.rawHash) || !Array.isArray(value.points) || value.points.length < 6) return false;
  const timestamps = new Set();
  for (const point of value.points) {
    if (!isForecastPoint(point, sourceUpdatedAt, fetchedAt) || timestamps.has(point.timestamp)) return false;
    timestamps.add(point.timestamp);
  }
  return true;
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
    && isIsoTimestamp(row.sourceUpdatedAt)
    && isIsoTimestamp(row.fetchedAt)
    && SHA256.test(row.rawHash)
    && hasValidPopulationRange(row.populationMin, row.populationMax)
    && isOfficialForecast(row.officialForecast, row.sourceUpdatedAt, row.fetchedAt)
    && !Object.hasOwn(row, "source_updated_at")
    && !Object.hasOwn(row, "fetched_at");
}

function parseSnapshot(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.contractVersion !== "1.0.0" || typeof payload.snapshotId !== "string" || payload.snapshotId.length === 0 || typeof payload.catalogVersion !== "string" || payload.catalogVersion.length === 0 || !SHA256.test(payload.payloadSha256)) return null;
  if (!Array.isArray(payload.rows) || payload.rows.length !== CATALOG_SIZE || !payload.rows.every(isSnapshotRow)) return null;
  const areaCodes = new Set(payload.rows.map((row) => row.areaCode));
  if (areaCodes.size !== CATALOG_SIZE) return null;
  const meta = payload.meta;
  if (!meta || meta.attempted !== CATALOG_SIZE || !Number.isInteger(meta.refreshed) || !Number.isInteger(meta.carriedForward) || !Number.isInteger(meta.unavailable)) return null;
  if (meta.refreshed < 0 || meta.carriedForward < 0 || meta.unavailable < 0 || meta.refreshed + meta.carriedForward + meta.unavailable !== CATALOG_SIZE) return null;
  const canonicalPayload = structuredClone(payload);
  delete canonicalPayload.provenanceReceipt;
  delete canonicalPayload.payloadSha256;
  if (payload.payloadSha256 !== canonicalPayloadSha256(canonicalPayload)) return null;
  return payload;
}

export async function handleIngestSnapshot(request, expectedToken, database) {
  if (request.method !== "POST") return jsonError("method_not_allowed", 405);
  if (typeof expectedToken !== "string" || expectedToken.length === 0) return jsonError("ingest_unavailable", 503);
  if (request.headers.get("authorization") !== `Bearer ${expectedToken}`) return jsonError("unauthorized", 401);

  let payload;
  try {
    payload = await readJsonBodyWithinLimit(request, MAX_PAYLOAD_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return jsonError("payload_too_large", 413);
    if (error instanceof SyntaxError) return jsonError("invalid_json", 400);
    throw error;
  }
  const snapshot = parseSnapshot(payload);
  if (snapshot === null) return jsonError("invalid_payload", 422);

  const canonicalPayload = structuredClone(snapshot);
  delete canonicalPayload.provenanceReceipt;
  let receipt;
  try {
    receipt = createProvenanceReceipt({
      ...snapshot.provenanceReceipt,
      accepted_status: "accepted",
      canonical_payload: canonicalPayload,
    });
  } catch (error) {
    if (error instanceof ProvenancePolicyError) return jsonError("invalid_provenance", 422);
    throw error;
  }

  try {
    await persistAcceptedSnapshot(database, snapshot, receipt);
  } catch (error) {
    if (error instanceof ProvenancePolicyError && /CONFLICT$/.test(error.code)) return jsonError("provenance_conflict", 409);
    if (error instanceof ProvenancePolicyError) return jsonError("provenance_storage_unavailable", 503);
    if (error instanceof SnapshotMaterializationError) return jsonError("materialization_storage_error", 503);
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
