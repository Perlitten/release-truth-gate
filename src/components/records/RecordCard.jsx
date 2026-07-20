export function RecordCard({ tone, icon, children }) {
  return (
    <article className="rt-record">
      <div className={`rt-record-mark ${tone}`}>{icon}</div>
      <div>{children}</div>
    </article>
  );
}
