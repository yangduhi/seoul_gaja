const CROWD_VALUE = Object.freeze({ RELAXED: 0, NORMAL: 1, BUSY: 2, CROWDED: 3 });

function sourceTimestamp(row) {
  return row.sourceUpdatedAt ?? row.fetchedAt;
}

function horizonBucket(timestamp) {
  return `${new Date(timestamp).toISOString().slice(0, 13)}:00:00Z`;
}

function rankByAreaCode(entries) {
  const denominator = Math.max(1, entries.length - 1);
  return new Map(entries.map((entry) => [
    entry.areaCode,
    entries.filter((candidate) => candidate.value < entry.value).length / denominator,
  ]));
}

function eligibleSnapshotRows(viewModel) {
  return viewModel.snapshot.rows.filter((row) =>
    (row.availability === 'available' || row.availability === 'carried_forward')
    && Object.hasOwn(CROWD_VALUE, row.crowdLevel)
    && typeof sourceTimestamp(row) === 'string');
}

function officialBucketMaps(viewModel, cohort) {
  if (viewModel.officialForecast.status !== 'READY') return new Map();
  const groups = new Map();
  const invalidBuckets = new Set();
  for (const areaCode of cohort) {
    const forecast = viewModel.officialForecast.byAreaCode[areaCode];
    for (const point of forecast?.points ?? []) {
      if (point.snapshotId !== viewModel.snapshot.snapshotId || !Object.hasOwn(CROWD_VALUE, point.crowdLevel)) continue;
      const bucket = horizonBucket(point.timestamp);
      if (invalidBuckets.has(bucket)) continue;
      const places = groups.get(bucket) ?? new Map();
      if (places.has(areaCode)) {
        groups.delete(bucket);
        invalidBuckets.add(bucket);
        continue;
      }
      places.set(areaCode, point);
      groups.set(bucket, places);
    }
  }
  return new Map([...groups].filter(([, places]) => places.size === cohort.length));
}

export function buildRecommendationInput(viewModel, now) {
  const currentRows = eligibleSnapshotRows(viewModel);
  const cohort = currentRows.map((row) => row.areaCode).sort();
  const currentRanks = rankByAreaCode(currentRows.map((row) => ({
    areaCode: row.areaCode,
    value: CROWD_VALUE[row.crowdLevel],
  })));
  const buckets = officialBucketMaps(viewModel, cohort);
  const forecastRanks = new Map([...buckets].map(([bucket, places]) => [
    bucket,
    rankByAreaCode([...places].map(([areaCode, point]) => ({
      areaCode,
      value: CROWD_VALUE[point.crowdLevel],
    }))),
  ]));
  const snapshotSources = currentRows.map(sourceTimestamp).sort();
  return {
    now: typeof now === 'string' ? now : new Date(now).toISOString(),
    activeSnapshot: {
      id: viewModel.snapshot.snapshotId,
      sourceUpdatedAt: snapshotSources[0] ?? '',
    },
    historyMaturity: { elapsedDays: 0, coverage: 0 },
    places: currentRows.map((row) => ({
      areaCode: row.areaCode,
      currentCrowd: {
        status: 'available',
        percentile: currentRanks.get(row.areaCode),
        cohort,
        snapshotId: viewModel.snapshot.snapshotId,
        sourceUpdatedAt: sourceTimestamp(row),
      },
      officialForecasts: [...buckets].map(([bucket, places]) => {
        const point = places.get(row.areaCode);
        return {
          status: 'available',
          authority: 'official',
          snapshotId: point.snapshotId,
          timestamp: point.timestamp,
          horizonBucket: bucket,
          percentile: forecastRanks.get(bucket)?.get(row.areaCode),
          cohort,
          sourceUpdatedAt: point.sourceUpdatedAt,
          interpolated: false,
          extrapolated: false,
        };
      }),
      historyDeviation: { status: 'unavailable' },
    })),
  };
}
