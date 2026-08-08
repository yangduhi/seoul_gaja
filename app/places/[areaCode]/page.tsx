import type { Metadata } from "next";
import { env } from "cloudflare:workers";

import { InvalidPlaceFallback } from "./InvalidPlaceFallback";
import { PlaceDetailClient } from "./PlaceDetailClient";
import type { DetailPayload } from "./PlaceDetailClient";
import { readProductViewModel } from "../../../server/product-read-model";
import { resolveVisualEvidenceFixture, type VisualEvidenceSearchParams } from "../../_visual-evidence/resolve";

const safeAreaCode = /^[A-Za-z0-9_-]+$/;

type PlacePageProps = Readonly<{
  params: Promise<Readonly<{ areaCode: string }>>;
  searchParams: Promise<VisualEvidenceSearchParams>;
}>;

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { areaCode } = await params;
  const result = safeAreaCode.test(areaCode) ? await readProductViewModel(env?.DB, { expectedCatalogCount: 121 }) : null;
  const isOfficialPlace = result?.status === "READY" && result.data.catalog.some((place) => place.areaCode === areaCode);
  return {
    title: `Place detail: ${areaCode}`,
    robots: { index: isOfficialPlace, follow: isOfficialPlace },
  };
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const { areaCode } = await params;
  if (!safeAreaCode.test(areaCode)) return <InvalidPlaceFallback />;
  const visualFixture = resolveVisualEvidenceFixture(await searchParams);
  const result = visualFixture === null
    ? await readProductViewModel(env?.DB, { expectedCatalogCount: 121 })
    : { status: "READY", data: visualFixture } as const;
  if (result.status === "UNAVAILABLE") {
    const payload: DetailPayload = { status: "UNAVAILABLE", areaCode, areaName: null, snapshot: null, forecast: [], history: [], reason: result.reason };
    return <PlaceDetailClient areaCode={areaCode} payload={payload} />;
  }
  if (result.status !== "READY") return <InvalidPlaceFallback />;
  const place = result.data.catalog.find((item) => item.areaCode === areaCode);
  if (place === undefined) return <InvalidPlaceFallback />;
  const row = result.data.snapshot.rows.find((item) => item.areaCode === areaCode) ?? null;
  const forecast = result.data.officialForecast.status === "READY" ? result.data.officialForecast.byAreaCode[areaCode]?.points ?? [] : [];
  const history = result.data.history.status === "READY" ? result.data.history.byAreaCode[areaCode]?.profiles ?? [] : [];
  const payload: DetailPayload = {
    status: "READY",
    areaCode,
    areaName: place.areaName,
    snapshot: row ? { areaName: place.areaName, availability: row.availability, crowdLevel: row.crowdLevel, populationMin: row.populationMin, populationMax: row.populationMax, sourceUpdatedAt: row.sourceUpdatedAt, fetchedAt: row.fetchedAt, freshness: row.freshness, freshnessBasis: row.freshnessBasis } : null,
    forecast: forecast.map((point) => ({ timestamp: point.timestamp, crowdLevel: point.crowdLevel, populationMin: point.populationMin, populationMax: point.populationMax, sourceUpdatedAt: point.sourceUpdatedAt })),
    history: history.map((profile) => ({ weekday: profile.weekday, hour: profile.hour, maturity: profile.maturity, crowdRankMedian: profile.crowdRankMedian, sampleCount: profile.sampleCount, missingCount: profile.missingCount, coverage: profile.coverage })),
  };
  return <PlaceDetailClient areaCode={areaCode} payload={payload} />;
}
