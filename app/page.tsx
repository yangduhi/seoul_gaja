import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { CatalogSurface, type CatalogRow, type RecommendationSummary } from "./_catalog/CatalogSurface";
import { readProductViewModel } from "../server/product-read-model";
import { evaluateRecommendations } from "../server/recommendations.mjs";

export const metadata: Metadata = {
  title: "서울 가자 — 인파 레이더",
  description: "서울 공식 장소의 현재 혼잡도와 원천 기반 다음 시간을 살펴봅니다.",
  other: {
    "codex-preview": "product",
  },
};

export default async function Home() {
  const result = await readProductViewModel(env?.DB, { expectedCatalogCount: 121 });
  if (result.status !== "READY") {
    const unavailableRecommendations = { now: { mode: "NOW", status: "ZERO_ELIGIBLE", browseCopy: "공식 데이터 연결 후 원천 기반 추천을 계산합니다." }, next: { mode: "NEXT", status: "ZERO_ELIGIBLE", browseCopy: "공식 데이터 연결 후 원천 기반 추천을 계산합니다." } } satisfies Readonly<{ now: RecommendationSummary; next: RecommendationSummary }>;
    return <CatalogSurface status="UNAVAILABLE" catalog={[]} snapshotStatus="UNAVAILABLE" sourceTime={null} recommendations={unavailableRecommendations} unavailableReason={result.reason} />;
  }
  const snapshotByCode = new Map(result.data.snapshot.rows.map((row) => [row.areaCode, row]));
  const catalog: CatalogRow[] = result.data.catalog.map((place) => {
    const row = snapshotByCode.get(place.areaCode);
    return { areaCode: place.areaCode, areaName: place.areaName, availability: row?.availability ?? "unavailable", crowdLevel: row?.crowdLevel ?? "UNKNOWN", populationMin: row?.populationMin ?? null, populationMax: row?.populationMax ?? null, sourceUpdatedAt: row?.sourceUpdatedAt ?? null, fetchedAt: row?.fetchedAt ?? "", freshness: row?.freshness ?? null, freshnessBasis: row?.freshnessBasis ?? "source_updated_at" };
  });
  const recommendationInput = {
    now: new Date().toISOString(),
    activeSnapshot: { id: result.data.snapshot.snapshotId, sourceUpdatedAt: catalog[0]?.sourceUpdatedAt ?? catalog[0]?.fetchedAt ?? new Date().toISOString() },
    historyMaturity: { elapsedDays: 0, coverage: 0 },
    places: catalog.map((row) => ({ areaCode: row.areaCode, currentCrowd: { status: row.availability === "unavailable" ? "unavailable" : "available", sourceUpdatedAt: row.sourceUpdatedAt ?? row.fetchedAt, percentile: undefined, snapshotId: result.data.snapshot.snapshotId }, officialForecasts: result.data.officialForecast.status === "READY" ? result.data.officialForecast.byAreaCode[row.areaCode]?.points.map((point) => ({ ...point, status: "available" })) : [] })),
  };
  const recommendations = evaluateRecommendations(recommendationInput) as Readonly<{ now: RecommendationSummary; next: RecommendationSummary }>;
  return <CatalogSurface status="READY" catalog={catalog} snapshotStatus={result.data.snapshot.status} sourceTime={catalog[0]?.sourceUpdatedAt ?? catalog[0]?.fetchedAt ?? null} recommendations={recommendations} />;
}
