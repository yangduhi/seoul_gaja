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

function koreaHistoryBasis(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const weekdays = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });
  return {
    weekday: weekdays[values.weekday],
    localTimeBucket: `${values.hour}:${Number(values.minute) < 30 ? '00' : '30'}`,
  };
}

function matchingHistoryProfiles(viewModel, rows, now) {
  if (viewModel.history.status !== 'READY') return new Map();
  const basis = koreaHistoryBasis(now);
  return new Map(rows.flatMap((row) => {
    const profiles = viewModel.history.byAreaCode[row.areaCode]?.profiles ?? [];
    const profile = profiles.find((candidate) => candidate.weekday === basis.weekday && candidate.hour === Number(basis.localTimeBucket.slice(0, 2)));
    return profile === undefined || typeof profile.crowdRankMedian !== 'number'
      ? []
      : [[row.areaCode, profile]];
  }));
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
  const profiles = matchingHistoryProfiles(viewModel, currentRows, now);
  const historyRanks = rankByAreaCode(currentRows.flatMap((row) => {
    const profile = profiles.get(row.areaCode);
    const currentRank = currentRanks.get(row.areaCode);
    return profile === undefined || currentRank === undefined
      ? []
      : [{ areaCode: row.areaCode, value: Math.abs(currentRank - profile.crowdRankMedian) }];
  }));
  const historyBasis = koreaHistoryBasis(now);
  const snapshotSources = currentRows.map(sourceTimestamp).sort();
  return {
    now: typeof now === 'string' ? now : new Date(now).toISOString(),
    activeSnapshot: {
      id: viewModel.snapshot.snapshotId,
      sourceUpdatedAt: snapshotSources[0] ?? '',
    },
    historyMaturity: {},
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
      historyDeviation: (() => {
        const profile = profiles.get(row.areaCode);
        const percentile = historyRanks.get(row.areaCode);
        return profile === undefined || percentile === undefined
          ? { status: 'unavailable' }
          : {
            status: 'available',
            percentile,
            computedAt: profile.computedAt,
            weekday: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date(now)),
            localTimeBucket: historyBasis.localTimeBucket,
            maturity: profile.maturity,
            coverage: profile.coverage,
          };
      })(),
    })),
  };
}
