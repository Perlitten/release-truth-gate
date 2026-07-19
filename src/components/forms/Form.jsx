"use client";

export function Form({ compact = false, className, onSubmit, children }) {
  const classes = ['rt-form'];
  if (compact) classes.push('compact');
  if (className) classes.push(className);
  
  return (
    <form className={classes.join(' ')} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
