export function Field({ label, hint, children }) {
  return (
    <label className="rt-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
