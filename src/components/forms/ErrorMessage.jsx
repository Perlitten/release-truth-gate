import { WarningCircle } from "@phosphor-icons/react";

export function ErrorMessage({ className, children }) {
  const classes = ['rt-error'];
  if (className) classes.push(className);
  
  return (
    <p className={classes.join(' ')} role="alert">
      <WarningCircle /> {children}
    </p>
  );
}
