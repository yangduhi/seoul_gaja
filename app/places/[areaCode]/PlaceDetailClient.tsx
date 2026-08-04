"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

type DetailSurface = "BOTTOM_SHEET" | "DETAIL_PANE" | "FULL_SCREEN";

type RestoreContext = Readonly<{
  selection: string | null;
  scrollY: number;
  focusTarget: string | null;
}>;

const restoreKey = "seoul-gaja.detail.restore";
const safeAreaCode = /^[A-Za-z0-9_-]+$/;

function navigationType(): string {
  const entry = performance.getEntriesByType("navigation")[0];
  return entry instanceof PerformanceNavigationTiming ? entry.type : "navigate";
}

function sheetSurface(): DetailSurface {
  return window.innerWidth >= 768 ? "DETAIL_PANE" : "BOTTOM_SHEET";
}

function currentSurface(): DetailSurface {
  const isSheet = navigationType() !== "reload" && window.history.state?.entry === "sheet";
  return isSheet ? sheetSurface() : "FULL_SCREEN";
}

function subscribeToSurface(onStoreChange: () => void): () => void {
  const onPopState = () => {
    restorePriorPlaceContext();
    onStoreChange();
  };
  window.addEventListener("resize", onStoreChange);
  window.addEventListener("popstate", onPopState);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("popstate", onPopState);
  };
}

function isRestoreContext(value: unknown): value is RestoreContext {
  if (typeof value !== "object" || value === null) return false;
  const selection = Reflect.get(value, "selection");
  const scrollY = Reflect.get(value, "scrollY");
  const focusTarget = Reflect.get(value, "focusTarget");
  return (typeof selection === "string" || selection === null)
    && typeof scrollY === "number"
    && (typeof focusTarget === "string" || focusTarget === null);
}

function readRestoreContext(): RestoreContext | null {
  const value = sessionStorage.getItem(restoreKey);
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRestoreContext(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function openInAppPlaceDetail(areaCode: string, restore: RestoreContext): void {
  const path = `/places/${encodeURIComponent(areaCode)}`;
  sessionStorage.setItem(restoreKey, JSON.stringify(restore));
  window.history.pushState({ entry: "sheet" }, "", path);
  window.dispatchEvent(new CustomEvent("seoul-gaja:detail-selection", { detail: { areaCode, restore } }));
}

export function restorePriorPlaceContext(): RestoreContext | null {
  const restore = readRestoreContext();
  if (restore === null) return null;
  window.scrollTo({ top: restore.scrollY, behavior: "instant" });
  if (restore.focusTarget !== null) document.getElementById(restore.focusTarget)?.focus();
  return restore;
}

export function PlaceDetailClient({ areaCode }: Readonly<{ areaCode: string }>) {
  const isSafe = safeAreaCode.test(areaCode);
  const surface = useSyncExternalStore(subscribeToSurface, currentSurface, () => "FULL_SCREEN");
  const [announcement, setAnnouncement] = useState("");

  if (!isSafe) {
    return (
      <main aria-live="polite">
        <h1>Place not found</h1>
        <p>This official place is no longer available. Browse the current catalog.</p>
        <Link href="/">Browse official places</Link>
      </main>
    );
  }

  const close = () => {
    window.history.back();
  };
  const share = async () => {
    const url = new URL(`/places/${encodeURIComponent(areaCode)}`, window.location.origin).toString();
    try {
      if (navigator.share !== undefined) {
        await navigator.share({ title: "Seoul crowd detail", url });
        setAnnouncement("Canonical place link shared.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setAnnouncement("Canonical place link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setAnnouncement("Sharing cancelled.");
        return;
      }
      setAnnouncement("Unable to share the link. Copy the canonical URL from the address bar.");
    }
  };

  return (
    <main aria-live="polite" data-detail-surface={surface} data-area-code={areaCode}>
      <p>{announcement}</p>
      <button type="button" onClick={close}>Close detail</button>
      <h1>Official place detail</h1>
      <p>Official area code: {areaCode}</p>
      <section aria-label="Current crowd status">
        <h2>Current data</h2>
        <p>Current crowd information will appear here when the active official snapshot is available.</p>
      </section>
      <section aria-label="Recommendation guidance">
        <h2>Choose a time</h2>
        <p>Use the current source time and the next source-backed official window. If no recommendation is available, the reason and timestamps are shown instead of a score.</p>
      </section>
      <button type="button" onClick={share}>Share official place link</button>
      <p>This link identifies only the official place and does not include your current location.</p>
    </main>
  );
}
