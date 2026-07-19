import { describe, expect, it } from "vitest";

import { isAllowedSourceUrl } from "./source-url.js";

describe("isAllowedSourceUrl", () => {
  it("allows http and https evidence sources", () => {
    expect(isAllowedSourceUrl("https://github.com/example/repo")).toBe(true);
    expect(isAllowedSourceUrl("http://localhost:3000/report")).toBe(true);
  });

  it("rejects non-web and malformed source URLs", () => {
    expect(isAllowedSourceUrl("ftp://example.test/evidence")).toBe(false);
    expect(isAllowedSourceUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedSourceUrl("not a URL")).toBe(false);
  });
});
