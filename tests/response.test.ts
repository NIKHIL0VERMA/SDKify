import { describe, expect, it } from "vitest";

import { normalizeResponse } from "../src/canonical/response.js";

describe("normalizeResponse", () => {
  it("normalizes a successful response", () => {
    expect(
      normalizeResponse({
        "200": {
          description: "Success",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CustomerResponse",
              },
            },
          },
        },
      }),
    ).toEqual({
      statusCode: "200",
      contentType: "application/json",
      type: {
        kind: "model",
        name: "CustomerResponse",
      },
    });
  });

  it("supports responses without a body", () => {
    expect(
      normalizeResponse({
        "204": {
          description: "Deleted",
        },
      }),
    ).toEqual({
      statusCode: "204",
    });
  });
});