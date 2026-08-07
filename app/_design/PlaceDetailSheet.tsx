"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, PropsWithChildren } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

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
    const sheet = sheetRef.current;
    const inertSiblings: Array<{ element: HTMLElement; wasInert: boolean }> = [];
    let branch: HTMLElement | null = sheet;

    while (branch?.parentElement) {
      const parent: HTMLElement = branch.parentElement;
      for (const sibling of parent.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          inertSiblings.push({ element: sibling, wasInert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = parent;
    }

    sheet?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    return () => {
      for (const { element, wasInert } of inertSiblings) {
        element.inert = wasInert;
      }
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onRequestClose();
      return;
    }

    if (event.key === "Tab") {
      const focusableElements = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const firstElement = focusableElements.at(0);
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        sheetRef.current?.focus();
      } else if (event.shiftKey && (document.activeElement === firstElement || document.activeElement === sheetRef.current)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
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
      style={{ maxHeight: "90dvh", overflowY: "auto", zIndex: 30 }}
      tabIndex={-1}
    >
      <button aria-label="상세 닫기" className="sg-place-detail-sheet__close" onClick={onRequestClose} type="button">
        닫기
      </button>
      {children}
    </div>
  );
}
