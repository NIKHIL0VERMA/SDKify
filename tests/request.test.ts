import { describe, expect, it } from "vitest";

import { normalizeRequestBody } from "../src/canonical/request.js";

describe("normalizeRequestBody", () => {
  it("normalizes a JSON request body", () => {
    expect(
      normalizeRequestBody({
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/CustomerCreateRequest",
            },
          },
        },
      }),
    ).toEqual({
      required: true,
      contentType: "application/json",
      type: {
        kind: "model",
        name: "CustomerCreateRequest",
      },
    });
  });
});