"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";

export function Dialog({ title, eyebrow, children, onClose, wide = false }) {
  const dialogRef = useRef(null);
  // Capture the opener during render, before the dialog's autoFocus'd field
  // steals focus, so focus can return to it on close.
  const [returnFocusEl] = useState(() =>
    typeof document !== "undefined" ? document.activeElement : null,
  );

  useEffect(() => {
    const focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const focusFirst = () =>
      dialogRef.current?.querySelector(focusableSelector)?.focus();
    focusFirst();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialogRef.current?.querySelectorAll(focusableSelector) || []];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusEl?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="rt-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`rt-dialog ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
