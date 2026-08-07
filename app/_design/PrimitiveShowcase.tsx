"use client";

import { ChartAlternatives } from "./ChartAlternatives";
import { GlassPanel } from "./GlassPanel";
import { Navigation } from "./Navigation";
import { Phase03CatalogSurface } from "./Phase03CatalogSurface";
import { PlaceDetailSheet } from "./PlaceDetailSheet";
import { presentationByMode, presentationModes } from "./Presentation";

type PrimitiveShowcaseProps = Readonly<{
  readonly onDismissSheet: () => void;
  readonly onSelectSection: (section: "map" | "list") => void;
}>;

const navigationItems = [
  { id: "map", label: "Map" },
  { id: "list", label: "Places" },
] as const;

const chartRows = [
  { label: "14:30", value: "Normal" },
  { label: "15:00", value: "Busy" },
] as const;

export function PrimitiveShowcase({ onDismissSheet, onSelectSection }: PrimitiveShowcaseProps) {
  return (
    <section aria-label="Design primitive showcase" className="sg-primitive-showcase">
      <GlassPanel depth="content">Content panel</GlassPanel>
      <GlassPanel depth="floating">Floating panel</GlassPanel>
      <GlassPanel depth="strong" emphasis="current-decision">Current decision panel</GlassPanel>
      <Navigation
        activeId="list"
        items={navigationItems}
        label="Showcase sections"
        onSelect={(item) => onSelectSection(item.id === "map" ? "map" : "list")}
      />
      <Phase03CatalogSurface announcement="Current catalog is available." onSelectSection={onSelectSection} />
      <ChartAlternatives emptyMessage="No source-backed forecast is available." rows={chartRows} summary="Official forecast remains available." title="Forecast alternative" />
      <ul aria-label="Presentation modes" className="sg-primitive-showcase__modes">
        {presentationModes.map((mode) => <li key={mode}>{presentationByMode[mode].mode}</li>)}
      </ul>
      <PlaceDetailSheet label="Showcase detail" onRequestClose={onDismissSheet}>
        <p>Keyboard-closeable detail state.</p>
      </PlaceDetailSheet>
    </section>
  );
}
