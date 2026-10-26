import { describe, expect, it } from "vitest";

import { normalizeSchema } from "../src/canonical/schema.js";
import { toTypeScriptType } from "../src/targets/typescript/type-mapper.js";

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
  it("normalizes inline objects", () => {
    expect(
      normalizeSchema({
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
          },
          external_customer_id: {
            type: ["string", "null"],
          },
        },
      }),
    ).toEqual({
      kind: "object",
      properties: [
        {
          name: "name",
          wireName: "name",
          required: true,
          type: {
            kind: "primitive",
            type: "string",
          },
        },
        {
          name: "externalCustomerId",
          wireName: "external_customer_id",
          required: false,
          type: {
            kind: "primitive",
            type: "string",
            nullable: true,
          },
        },
      ],
    });
  });
  it("normalizes enums", () => {
  expect(
    normalizeSchema({
      type: "string",
      enum: [
        "rising",
        "falling",
        "recurring",
      ],
    }),
  ).toEqual({
    kind: "enum",
    values: [
      "rising",
      "falling",
      "recurring",
    ],
  });
});
it("normalizes nullable oneOf references", () => {
  expect(
    normalizeSchema({
      oneOf: [
        {
          $ref: "#/components/schemas/FindingSummaryInvestigation",
        },
        {
          type: "null",
        },
      ],
    }),
  ).toEqual({
    kind: "model",
    name: "FindingSummaryInvestigation",
    nullable: true,
  });
});
it("normalizes oneOf unions", () => {
  expect(
    normalizeSchema({
      oneOf: [
        {
          $ref: "#/components/schemas/Cat",
        },
        {
          $ref: "#/components/schemas/Dog",
        },
      ],
    }),
  ).toEqual({
    kind: "union",
    variants: [
      {
        kind: "model",
        name: "Cat",
      },
      {
        kind: "model",
        name: "Dog",
      },
    ],
  });
});
it("maps enums", () => {
  expect(
    toTypeScriptType({
      kind: "enum",
      values: [
        "rising",
        "falling",
        "recurring",
      ],
    }),
  ).toBe(
    '"rising" | "falling" | "recurring"',
  );
});
it("maps unions", () => {
  expect(
    toTypeScriptType({
      kind: "union",
      variants: [
        {
          kind: "model",
          name: "Cat",
        },
        {
          kind: "model",
          name: "Dog",
        },
      ],
    }),
  ).toBe("Cat | Dog");
});
it("normalizes allOf intersections", () => {
  expect(
    normalizeSchema({
      allOf: [
        {
          $ref: "#/components/schemas/InboxEmbed",
        },
        {
          type: "object",
          required: ["token", "embed_url"],
          properties: {
            token: {
              type: "string",
            },
            embed_url: {
              type: "string",
            },
          },
        },
      ],
    }),
  ).toEqual({
    kind: "intersection",
    variants: [
      {
        kind: "model",
        name: "InboxEmbed",
      },
      {
        kind: "object",
        properties: [
          {
            name: "token",
            wireName: "token",
            required: true,
            type: {
              kind: "primitive",
              type: "string",
            },
          },
          {
            name: "embedUrl",
            wireName: "embed_url",
            required: true,
            type: {
              kind: "primitive",
              type: "string",
            },
          },
        ],
      },
    ],
  });
});
it("normalizes anyOf as a union", () => {
  expect(
    normalizeSchema({
      anyOf: [
        { type: "string" },
        { type: "integer" },
        { type: "number" },
        { type: "boolean" },
      ],
    }),
  ).toEqual({
    kind: "union",
    variants: [
      {
        kind: "primitive",
        type: "string",
      },
      {
        kind: "primitive",
        type: "integer",
      },
      {
        kind: "primitive",
        type: "number",
      },
      {
        kind: "primitive",
        type: "boolean",
      },
    ],
  });
});
});