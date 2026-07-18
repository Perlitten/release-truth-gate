import { describe, expect, it } from "vitest";

import { DatabaseUnavailableError, openDatabase } from "./connection.js";

describe("openDatabase", () => {
  it("fails fast with DatabaseUnavailableError when the host is unreachable", async () => {
    const startedAt = Date.now();
    await expect(
      openDatabase("postgresql://user:pass@10.255.255.1:5432/unreachable"),
    ).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(Date.now() - startedAt).toBeLessThan(8_000);
  }, 30_000);
});
