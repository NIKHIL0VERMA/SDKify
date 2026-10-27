import { describe, expect, it } from "vitest";

import { normalizeNamedTypes } from "../src/canonical/named-type.js";

describe("normalizeNamedTypes", () => {
  it("normalizes named object schemas", () => {
    expect(
      normalizeNamedTypes({
        Customer: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
            },
            external_customer_id: {
              type: ["string", "null"],
            },
          },
        },
      }),
    ).toEqual([
      {
        name: "Customer",
        description: undefined,
        type: {
          kind: "object",
          properties: [
            {
              wireName: "id",
              required: true,
              type: {
                kind: "primitive",
                type: "string",
              },
            },
            {
              wireName: "external_customer_id",
              required: false,
              type: {
                kind: "primitive",
                type: "string",
                nullable: true,
              },
            },
          ],
        },
      },
    ]);
  });

  it("preserves named allOf schemas", () => {
    expect(
      normalizeNamedTypes({
        InboxEmbedCreated: {
          allOf: [
            {
              $ref: "#/components/schemas/InboxEmbed",
            },
            {
              type: "object",
              required: ["token"],
              properties: {
                token: {
                  type: "string",
                },
              },
            },
          ],
        },
      }),
    ).toEqual([
      {
        name: "InboxEmbedCreated",
        description: undefined,
        type: {
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
        },
      },
    ]);
  });
});