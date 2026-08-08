import type { ProductViewModel } from "../../server/product-read-model";
import { readyVisualFixture } from "./ready-fixture";

export type VisualEvidenceSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

export function resolveVisualEvidenceFixture(searchParams: VisualEvidenceSearchParams): ProductViewModel | null {
  if (process.env.NODE_ENV !== "development") return null;
  return searchParams.visualFixture === "ready-v1" ? readyVisualFixture : null;
}
