import type { Metadata } from "next";
import { env } from "cloudflare:workers";

import { PlaceDetailClient } from "./PlaceDetailClient";
import type { DetailPayload } from "./PlaceDetailClient";
import { readProductViewModel } from "../../../server/product-read-model";

type PlacePageProps = Readonly<{
  params: Promise<Readonly<{ areaCode: string }>>;
}>;

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { areaCode } = await params;
  return {
    title: `Place detail: ${areaCode}`,
    robots: { index: true, follow: true },
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { areaCode } = await params;
  const result = await readProductViewModel(env?.DB, { expectedCatalogCount: 121 });
  if (result.status !== "READY") {
    const payload: DetailPayload = { status: "UNAVAILABLE", areaCode, areaName: null, snapshot: null, forecast: [], history: [], reason: result.reason };
    return <PlaceDetailClient areaCode={areaCode} payload={payload} />;
  }
  const place = result.data.catalog.find((item) => item.areaCode === areaCode);
  if (place === undefined) return <PlaceDetailClient areaCode={areaCode} payload={{ status: "NOT_FOUND", areaCode, areaName: null, snapshot: null, forecast: [], history: [] }} />;
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
