import { GlassPanel } from "./GlassPanel";
import { Navigation } from "./Navigation";

type Phase03CatalogSurfaceProps = Readonly<{
  readonly announcement: string;
  readonly onSelectSection: (section: "map" | "list") => void;
}>;

const sections = [
  { id: "map", label: "Map" },
  { id: "list", label: "Places" },
] as const;

export function Phase03CatalogSurface({ announcement, onSelectSection }: Phase03CatalogSurfaceProps) {
  return (
    <GlassPanel aria-label="Place catalog" className="sg-phase03-catalog" depth="content">
      <p aria-atomic="true" aria-live="polite" className="sg-visually-hidden">{announcement}</p>
      <Navigation
        activeId="list"
        items={sections}
        label="Catalog sections"
        onSelect={(item) => {
          if (item.id === "map" || item.id === "list") {
            onSelectSection(item.id);
          }
        }}
      />
      <button className="sg-current-decision-cta" type="button">Show current decision</button>
    </GlassPanel>
  );
}
