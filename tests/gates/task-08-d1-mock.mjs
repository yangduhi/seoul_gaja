import { canonicalPayloadSha256 } from '../../server/provenance-cadence.mjs';

export function createD1Mock() {
  const receipts = new Map();
  const bindings = new Map();
  const statements = [];

  function receiptFromArgs(args) {
    return {
      receipt_id: args[0], receipt_version: args[1], workflow_run_id: args[2],
      collector_version: args[3], parser_version: args[4], catalog_version: args[5],
      raw_response_sha256: args[6], per_place_outcome_counts: args[7], source_times: args[8],
      fetch_times: args[9], canonical_payload_sha256: args[10], accepted_at: args[11], retained_until: args[12],
    };
  }

  function restore(map, entries) {
    map.clear();
    for (const [key, value] of entries) map.set(key, value);
  }

  function boundStatement(sql, args) {
    return {
      async run() {
        if (/UPDATE\s+provenance_receipts/i.test(sql)) {
          const persisted = receipts.get(`${args[0]}:${args[1]}`);
          if (persisted && JSON.stringify(persisted) !== JSON.stringify(receiptFromArgs(args))) {
            throw new Error('PROVENANCE_RECEIPT_IMMUTABLE');
          }
        } else if (/UPDATE\s+provenance_source_bindings/i.test(sql)) {
          const persisted = bindings.get(`${args[0]}:${args[1]}`);
          if (persisted && (persisted.source_receipt_id !== args[2] || persisted.source_receipt_version !== args[3])) {
            throw new Error('PROVENANCE_SOURCE_BINDING_IMMUTABLE');
          }
        } else if (/INSERT\s+OR\s+IGNORE\s+INTO\s+provenance_receipts/i.test(sql)) {
          const key = `${args[0]}:${args[1]}`;
          if (!receipts.has(key)) receipts.set(key, receiptFromArgs(args));
        } else if (/INSERT\s+OR\s+IGNORE\s+INTO\s+provenance_source_bindings/i.test(sql)) {
          const key = `${args[0]}:${args[1]}`;
          if (!bindings.has(key)) {
            bindings.set(key, {
              source_receipt_id: args[2], source_receipt_version: args[3], bound_at: args[4],
            });
          }
        }
        return { success: true };
      },
      async first() {
        if (/FROM\s+provenance_receipts/i.test(sql)) return receipts.get(`${args[0]}:${args[1]}`) ?? null;
        if (/FROM\s+provenance_source_bindings/i.test(sql)) return bindings.get(`${args[0]}:${args[1]}`) ?? null;
        return null;
      },
    };
  }

  return {
    statements,
    receipts,
    bindings,
    prepare(sql) {
      return {
        async run() {
          statements.push({ sql, args: [] });
          return boundStatement(sql, []).run();
        },
        bind(...args) {
          statements.push({ sql, args });
          return boundStatement(sql, args);
        },
      };
    },
    async batch(boundStatements) {
      const receiptsBefore = structuredClone([...receipts.entries()]);
      const bindingsBefore = structuredClone([...bindings.entries()]);
      try {
        const results = [];
        for (const statement of boundStatements) results.push(await statement.run());
        return results;
      } catch (error) {
        restore(receipts, receiptsBefore);
        restore(bindings, bindingsBefore);
        throw error;
      }
    },
  };
}

export function createNormalizedSnapshot(provenanceReceipt) {
  const rows = Array.from({ length: 121 }, (_, index) => ({
    areaCode: `AREA-${String(index + 1).padStart(3, '0')}`,
    areaName: `Area ${index + 1}`,
    availability: 'available',
    provenance: 'refreshed',
    crowdLevel: 'NORMAL',
    populationMin: 100,
    populationMax: 200,
    sourceUpdatedAt: '2026-08-04T00:00:00Z',
    fetchedAt: '2026-08-04T00:00:05Z',
    rawHash: (index + 1).toString(16).padStart(64, '0'),
    officialForecast: {
      authority: 'official',
      sourceUpdatedAt: '2026-08-04T00:00:00Z',
      fetchedAt: '2026-08-04T00:00:05Z',
      rawHash: (index + 1).toString(16).padStart(64, '0'),
      points: Array.from({ length: 6 }, (_, pointIndex) => ({
        timestamp: new Date(Date.parse('2026-08-04T00:00:05Z') + (pointIndex + 1) * 60 * 60 * 1000).toISOString(),
        crowdLevel: 'NORMAL',
        populationMin: 100,
        populationMax: 200,
        sourceUpdatedAt: '2026-08-04T00:00:00Z',
      })),
    },
  }));
  const canonicalPayload = {
    contractVersion: '1.0.0',
    snapshotId: 'snapshot-local-0001',
    catalogVersion: 'catalog-v1',
    rows,
    meta: { attempted: 121, refreshed: 121, carriedForward: 0, unavailable: 0 },
  };
  return {
    ...canonicalPayload,
    payloadSha256: canonicalPayloadSha256(canonicalPayload),
    provenanceReceipt,
  };
}
