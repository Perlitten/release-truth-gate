"use client";

export function Badge({ status, children }) {
  return <span className={`rt-state ${status}`}>{children}</span>;
}
