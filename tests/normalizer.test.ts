import { describe, expect, it } from "vitest";
import type { OpenAPI } from "@scalar/openapi-types";

import { normalizeOpenAPI } from "../src/canonical/normalizer.js";

describe("normalizeOpenAPI", () => {
  it("preserves operation tags and deprecation metadata", () => {
    const document = {
      openapi: "3.1.0",
      info: {
        title: "Tagged API",
        version: "1.0.0",
      },
      paths: {
        "/users": {
          get: {
            operationId: "listUsers",
            tags: ["users", "public"],
            deprecated: true,
            responses: {
              "204": {
                description: "No content",
              },
            },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: "object",
            deprecated: true,
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    } as unknown as OpenAPI.Document;

    const spec = normalizeOpenAPI(document);
    const service = spec.services[0];
    const operation = service?.operations[0];

    expect(service?.name).toBe("users");
    expect(operation?.tags).toEqual(["users", "public"]);
    expect(operation?.deprecated).toBe(true);
    expect(spec.types[0]?.deprecated).toBe(true);
  });

  it("groups untagged operations under the default service", () => {
    const document = {
      openapi: "3.1.0",
      info: {
        title: "Untagged API",
        version: "1.0.0",
      },
      paths: {
        "/health": {
          get: {
            operationId: "getHealth",
            responses: {
              "204": {
                description: "Healthy",
              },
            },
          },
        },
      },
    } as unknown as OpenAPI.Document;

    const spec = normalizeOpenAPI(document);

    expect(spec.services[0]?.name).toBe("Default");
    expect(spec.services[0]?.operations[0]?.tags).toEqual([]);
  });
});
