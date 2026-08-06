import type { ProductViewModel } from "./product-read-model.ts";

export type RecommendationReason = Readonly<{
  kind: "current_crowd_percentile" | "official_forecast_percentile" | "history_deviation_percentile";
  value: number;
  sourceTimestamp: string;
}>;

export type RecommendationResult = Readonly<{
  areaCode: string;
  score: number;
  variant: "base" | "history-enhanced";
  historyMaturity: "ACCUMULATING" | "PROVISIONAL" | "STABLE" | "MATURE";
  selectedTimestamp: string;
  sourceTimestamps: Readonly<Record<string, string>>;
  reasons: readonly RecommendationReason[];
}>;

export type RecommendationMode = Readonly<{
  mode: "NOW" | "NEXT";
  status: "READY" | "ZERO_ELIGIBLE";
  browseCopy?: string;
  results: readonly RecommendationResult[];
}>;

export type RecommendationSurface = Readonly<{
  now: RecommendationMode;
  next: RecommendationMode;
}>;

export function evaluateRecommendations(input: unknown): RecommendationSurface;
export function buildRecommendationSurface(viewModel: ProductViewModel, now: string): RecommendationSurface;
