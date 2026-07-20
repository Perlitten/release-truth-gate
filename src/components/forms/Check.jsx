export function Check({ label, className, ...inputProps }) {
  const classes = ['rt-check'];
  if (className) classes.push(className);
  
  return (
    <label className={classes.join(' ')}>
      <input type="checkbox" {...inputProps} />
      <span>{label}</span>
    </label>
  );
}
