export type ChartRow = Readonly<{
  readonly label: string;
  readonly value: string;
}>;

type ChartAlternativesProps = Readonly<{
  readonly rows: readonly ChartRow[];
  readonly summary: string;
  readonly title: string;
}>;

export function ChartAlternatives({ rows, summary, title }: ChartAlternativesProps) {
  return (
    <section aria-labelledby="chart-alternative-title" className="sg-chart-alternative">
      <h2 id="chart-alternative-title">{title}</h2>
      <p>{summary}</p>
      <table>
        <caption>{title} data table</caption>
        <thead><tr><th scope="col">Time</th><th scope="col">Forecast</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
