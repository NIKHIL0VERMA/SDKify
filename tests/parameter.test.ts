import { describe, expect, it } from "vitest";

import { normalizeParameter } from "../src/canonical/parameter.js";

describe("normalizeParameter", () => {
  it("normalizes a path parameter", () => {
    expect(
      normalizeParameter({
        name: "customer_id",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      }),
    ).toEqual({
      name: "customerId",
      wireName: "customer_id",
      location: "path",
      required: true,
      description: undefined,
      type: {
        kind: "primitive",
        type: "string",
      },
    });
  });

  it("normalizes an optional query parameter", () => {
    expect(
      normalizeParameter({
        name: "page_size",
        in: "query",
        schema: {
          type: "integer",
        },
      }),
    ).toEqual({
      name: "pageSize",
      wireName: "page_size",
      location: "query",
      required: false,
      description: undefined,
      type: {
        kind: "primitive",
        type: "integer",
      },
    });
  });

  it("forces path parameters to required", () => {
    const parameter = normalizeParameter({
      name: "customer_id",
      in: "path",
      schema: {
        type: "string",
      },
    });

    expect(parameter.required).toBe(true);
  });
});