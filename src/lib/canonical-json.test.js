import { describe, expect, it } from "vitest";

import { canonicalJson } from "./canonical-json.js";

describe("canonicalJson", () => {
  it("sorts object keys recursively without changing array order", () => {
    expect(
      canonicalJson({
        z: [{ y: 2, x: 1 }],
        a: { d: 4, c: 3 },
      }),
    ).toBe('{"a":{"c":3,"d":4},"z":[{"x":1,"y":2}]}');
  });
});

