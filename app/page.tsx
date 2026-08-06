import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { CatalogSurface, type CatalogRow, type RecommendationSummary } from "./_catalog/CatalogSurface";
import { readProductViewModel } from "../server/product-read-model";
import { buildRecommendationSurface } from "../server/recommendations.mjs";
import { resolveVisualEvidenceFixture, type VisualEvidenceSearchParams } from "./_visual-evidence/resolve";

export const metadata: Metadata = {
  title: "서울 가자 — 인파 레이더",
  description: "서울 공식 장소의 현재 혼잡도와 원천 기반 다음 시간을 살펴봅니다.",
  other: {
    "codex-preview": "product",
  },
};

type HomeProps = Readonly<{ searchParams: Promise<VisualEvidenceSearchParams> }>;

export default async function Home({ searchParams }: HomeProps) {
  const requestNow = new Date().toISOString();
  const visualQuery = await searchParams;
  const visualFixture = resolveVisualEvidenceFixture(visualQuery);
  const result = visualFixture === null
    ? await readProductViewModel(env?.DB, { now: requestNow, expectedCatalogCount: 121 })
    : { status: "READY", data: visualFixture } as const;
  if (result.status !== "READY") {
    const unavailableRecommendations = { now: { mode: "NOW", status: "ZERO_ELIGIBLE", browseCopy: "공식 현재 혼잡도와 예보가 없어 추천을 잠시 보류합니다.", results: [] }, next: { mode: "NEXT", status: "ZERO_ELIGIBLE", browseCopy: "공식 현재 혼잡도와 예보가 없어 추천을 잠시 보류합니다.", results: [] } } satisfies Readonly<{ now: RecommendationSummary; next: RecommendationSummary }>;
    return <CatalogSurface status="UNAVAILABLE" catalog={[]} snapshotStatus="UNAVAILABLE" sourceTime={null} recommendations={unavailableRecommendations} unavailableReason={result.reason} />;
  }
  const snapshotByCode = new Map(result.data.snapshot.rows.map((row) => [row.areaCode, row]));
  const catalog: CatalogRow[] = result.data.catalog.map((place) => {
    const row = snapshotByCode.get(place.areaCode);
    return { areaCode: place.areaCode, areaName: place.areaName, availability: row?.availability ?? "unavailable", crowdLevel: row?.crowdLevel ?? "UNKNOWN", populationMin: row?.populationMin ?? null, populationMax: row?.populationMax ?? null, sourceUpdatedAt: row?.sourceUpdatedAt ?? null, fetchedAt: row?.fetchedAt ?? "", freshness: row?.freshness ?? null, freshnessBasis: row?.freshnessBasis ?? "source_updated_at" };
  });
  const recommendationNow = visualFixture === null ? requestNow : "2026-08-06T00:30:00Z";
  const recommendations = buildRecommendationSurface(result.data, recommendationNow);
  return <CatalogSurface status="READY" catalog={catalog} snapshotStatus={result.data.snapshot.status} sourceTime={catalog[0]?.sourceUpdatedAt ?? catalog[0]?.fetchedAt ?? null} recommendations={recommendations} initialSelectedAreaCode={visualFixture !== null && visualQuery.visualState === "selected-detail" ? catalog[0]?.areaCode : undefined} />;
}
