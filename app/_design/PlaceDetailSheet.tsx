"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, PropsWithChildren } from "react";

type PlaceDetailSheetProps = PropsWithChildren<
  Readonly<{
    readonly label: string;
    readonly onRequestClose: () => void;
  }>
>;

export function PlaceDetailSheet({ children, label, onRequestClose }: PlaceDetailSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    sheetRef.current?.focus();

    return () => {
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onRequestClose();
    }
  }

  return (
    <div
      aria-label={label}
      aria-modal="true"
      className="sg-place-detail-sheet"
      onKeyDown={handleKeyDown}
      ref={sheetRef}
      role="dialog"
      tabIndex={-1}
    >
      <button aria-label="Close detail" className="sg-place-detail-sheet__close" onClick={onRequestClose} type="button">
        Close
      </button>
      {children}
    </div>
  );
}
