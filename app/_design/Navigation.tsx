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
  return (
    <nav aria-label={label} className="sg-navigation">
      <ul className="sg-navigation__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              aria-current={item.id === activeId ? "page" : undefined}
              className="sg-navigation__item"
              onClick={() => onSelect(item)}
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
