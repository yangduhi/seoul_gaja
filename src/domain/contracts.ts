export type CrowdLevel = "RELAXED" | "NORMAL" | "BUSY" | "CROWDED" | "UNKNOWN";

export type Availability = "available" | "carried_forward" | "unavailable" | "expired";
export type Provenance = "refreshed" | "carried_forward" | "missing";

export type PlaceIdentity = Readonly<{
  areaCode: string;
  areaName: string;
  latitude: number | null;
  longitude: number | null;
}>;

export type CurrentObservation = Readonly<{
  areaCode: string;
  areaName: string;
  crowdLevel: CrowdLevel;
  populationMin: number | null;
  populationMax: number | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  availability: Availability;
  provenance: Provenance;
}>;

export type ForecastPoint = Readonly<{
  time: string;
  crowdLevel: CrowdLevel;
  populationMin: number | null;
  populationMax: number | null;
}>;
