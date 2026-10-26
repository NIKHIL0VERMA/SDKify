import { describe, expect, it } from "vitest";

import { normalizeContent } from "../src/canonical/content.js";

describe("normalizeContent", () => {
  it("prefers application/json", () => {
    expect(
      normalizeContent({
        "text/plain": {
          schema: {
            type: "string",
          },
        },
        "application/json": {
          schema: {
            $ref: "#/components/schemas/Customer",
          },
        },
      }),
    ).toEqual({
      contentType: "application/json",
      type: {
        kind: "model",
        name: "Customer",
      },
    });
  });
});