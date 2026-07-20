export function MetricCard({ tone, label, value, hint }) {
  return (
    <article className={tone || undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
