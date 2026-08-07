export type ChartRow = Readonly<{
  readonly label: string;
  readonly value: string;
}>;

type ChartAlternativesProps = Readonly<{
  readonly emptyMessage: string;
  readonly rows: readonly ChartRow[];
  readonly summary: string;
  readonly title: string;
}>;

export function ChartAlternatives({ emptyMessage, rows, summary, title }: ChartAlternativesProps) {
  return (
    <section aria-label={title} className="sg-chart-alternative">
      <h3>{title}</h3>
      <p className="sg-chart-alternative__summary">{summary}</p>
      {rows.length === 0 ? (
        <p className="sg-chart-alternative__empty" role="status">{emptyMessage}</p>
      ) : (
        <table data-source-backed="true">
          <caption>{title} data table</caption>
          <thead><tr><th scope="col">Source</th><th scope="col">Time</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.label}-${row.value}`}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}
