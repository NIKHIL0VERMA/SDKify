import { describe, expect, it } from "vitest";

import { normalizeSchema } from "../src/canonical/schema.js";

describe("normalizeSchema", () => {
  it("normalizes string", () => {
    expect(
      normalizeSchema({
        type: "string",
      }),
    ).toEqual({
      kind: "primitive",
      type: "string",
    });
  });

  it("normalizes model references", () => {
    expect(
      normalizeSchema({
        $ref: "#/components/schemas/Customer",
      }),
    ).toEqual({
      kind: "model",
      name: "Customer",
    });
  });

  it("normalizes arrays", () => {
    expect(
      normalizeSchema({
        type: "array",
        items: {
          $ref: "#/components/schemas/Customer",
        },
      }),
    ).toEqual({
      kind: "array",
      items: {
        kind: "model",
        name: "Customer",
      },
    });
  });

  it("supports OpenAPI 3.1 nullable types", () => {
    expect(
      normalizeSchema({
        type: ["string", "null"],
      }),
    ).toEqual({
      kind: "primitive",
      type: "string",
      nullable: true,
    });
  });
});