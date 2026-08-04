import type { Metadata } from "next";

import { PlaceDetailClient } from "./PlaceDetailClient";

type PlacePageProps = Readonly<{
  params: Promise<Readonly<{ areaCode: string }>>;
}>;

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { areaCode } = await params;
  return {
    title: `Place detail: ${areaCode}`,
    robots: { index: false, follow: false },
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { areaCode } = await params;
  return <PlaceDetailClient areaCode={areaCode} />;
}
