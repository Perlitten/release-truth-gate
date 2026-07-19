export function CheckboxList({ detailed = false, children }) {
  const className = detailed ? "rt-checkbox-list rt-checkbox-list-detailed" : "rt-checkbox-list";
  return (
    <div className={className}>
      {children}
    </div>
  );
}
