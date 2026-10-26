import { describe, expect, it } from "vitest";

import { normalizeAuth } from "../src/canonical/auth.js";

describe("normalizeAuth", () => {
  it("normalizes API key auth", () => {
    expect(
      normalizeAuth({
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      }),
    ).toEqual([
      {
        kind: "apiKey",
        name: "ApiKeyAuth",
        wireName: "X-API-Key",
        location: "header",
      },
    ]);
  });

  it("normalizes HTTP bearer auth", () => {
    expect(
      normalizeAuth({
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      }),
    ).toEqual([
      {
        kind: "http",
        name: "BearerAuth",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    ]);
  });
});