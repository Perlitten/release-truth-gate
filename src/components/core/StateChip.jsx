"use client";

export function StateChip({ state, children }) {
  return <span className={state}>{children}</span>;
}
