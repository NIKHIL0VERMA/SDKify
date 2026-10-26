import { describe, expect, it } from "vitest";

import { toTypeScriptType } from "../../../src/targets/typescript/type-mapper.js";

describe("toTypeScriptType", () => {
  it("maps primitives", () => {
    expect(
      toTypeScriptType({
        kind: "primitive",
        type: "string",
      }),
    ).toBe("string");

    expect(
      toTypeScriptType({
        kind: "primitive",
        type: "integer",
      }),
    ).toBe("number");
  });

  it("maps model references", () => {
    expect(
      toTypeScriptType({
        kind: "model",
        name: "Customer",
      }),
    ).toBe("Customer");
  });

  it("maps intersections", () => {
  expect(
    toTypeScriptType({
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
          ],
        },
      ],
    }),
  ).toBe(
    "InboxEmbed & { token: string; }",
  );
});

  it("maps arrays", () => {
    expect(
      toTypeScriptType({
        kind: "array",
        items: {
          kind: "model",
          name: "Customer",
        },
      }),
    ).toBe("Array<Customer>");
  });

  it("maps nullable types", () => {
    expect(
      toTypeScriptType({
        kind: "primitive",
        type: "string",
        nullable: true,
      }),
    ).toBe("string | null");
  });

  it("maps inline objects", () => {
    expect(
      toTypeScriptType({
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
      }),
    ).toBe(
      "{ name: string; externalCustomerId?: string | null; }",
    );
  });
});