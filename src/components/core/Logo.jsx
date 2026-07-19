"use client";

import { Sparkle } from "@phosphor-icons/react";

export function Logo({ large = false }) {
  return (
    <span className={`rt-logo${large ? " large" : ""}`}>
      <Sparkle weight="fill" />
    </span>
  );
}
