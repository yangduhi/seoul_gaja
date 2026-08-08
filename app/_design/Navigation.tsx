export type NavigationItem = Readonly<{
  readonly id: string;
  readonly label: string;
}>;

type NavigationProps = Readonly<{
  readonly activeId: string;
  readonly items: readonly NavigationItem[];
  readonly label: string;
  readonly onSelect: (item: NavigationItem) => void;
}>;

export function Navigation({ activeId, items, label, onSelect }: NavigationProps) {
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = items.length - 1;
    let nextIndex: number;

    if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;
    else return;

    const nextItem = items.at(nextIndex);
    const nextButton = event.currentTarget.closest("nav")?.querySelectorAll<HTMLButtonElement>(".sg-navigation__item").item(nextIndex);
    if (!nextItem || !nextButton) return;

    event.preventDefault();
    nextButton.focus();
    onSelect(nextItem);
  }

  return (
    <nav aria-label={label} className="sg-navigation">
      <ul className="sg-navigation__list">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              aria-current={item.id === activeId ? "page" : undefined}
              className="sg-navigation__item"
              onClick={() => onSelect(item)}
              onKeyDown={(event) => moveFocus(event, index)}
              type="button"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
import type { KeyboardEvent } from "react";
