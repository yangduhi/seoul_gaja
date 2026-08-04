import type { HTMLAttributes, PropsWithChildren } from "react";

export const glassDepths = ["content", "floating", "strong"] as const;
export type GlassDepth = (typeof glassDepths)[number];

type GlassPanelProps = PropsWithChildren<
  Readonly<
    HTMLAttributes<HTMLDivElement> & {
      readonly depth?: GlassDepth;
      readonly interactive?: boolean;
      readonly emphasis?: "default" | "current-decision";
    }
  >
>;

export function GlassPanel({
  children,
  className = "",
  depth = "content",
  emphasis = "default",
  interactive = false,
  ...attributes
}: GlassPanelProps) {
  const interactionClass = interactive ? " sg-glass-panel--interactive" : "";
  const emphasisClass = emphasis === "current-decision" ? " sg-glass-panel--decision" : "";

  return (
    <div
      {...attributes}
      className={`sg-glass-panel sg-glass-panel--${depth}${interactionClass}${emphasisClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
