"use client";

import { SpinnerGap } from "@phosphor-icons/react";

export function Button({
  variant = "primary",
  busy = false,
  type = "button",
  disabled,
  onClick,
  children,
  className = "",
  ...rest
}) {
  return (
    <button
      className={`rt-${variant}${className ? ` ${className}` : ""}`}
      type={type}
      disabled={disabled || busy}
      onClick={onClick}
      {...rest}
    >
      {busy ? <SpinnerGap className="rt-spin" /> : children}
    </button>
  );
}
