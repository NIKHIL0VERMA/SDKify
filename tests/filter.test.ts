import { describe, expect, it } from "vitest";

import { filterSpecByTags } from "../src/project/filter.js";
import type { Operation, SDKSpec } from "../src/canonical/types.js";

function operation(name: string, tags: string[]): Operation {
  return {
    name,
    operationId: name,
    method: "GET",
    path: `/${name}`,
    tags,
    parameters: [],
  };
}

function specWithServices(): SDKSpec {
  return {
    name: "Filtered API",
    version: "1.0.0",
    servers: [],
    auth: [],
    types: [
      {
        name: "User",
        type: {
          kind: "object",
          properties: [],
        },
      },
    ],
    services: [
      {
        name: "users",
        operations: [
          operation("listUsers", ["users"]),
          operation("inviteUser", ["users", "admin"]),
        ],
      },
      {
        name: "admin",
        operations: [operation("purgeCache", ["admin"])],
      },
    ],
  };
}

describe("filterSpecByTags", () => {
  it("returns the original spec when no filters are configured", () => {
    const spec = specWithServices();

    expect(filterSpecByTags(spec, {})).toBe(spec);
  });

  it("keeps operations carrying an included tag", () => {
    const result = filterSpecByTags(specWithServices(), {
      includeTags: ["users"],
    });

    expect(result.services[0]?.operations.map((entry) => entry.name)).toEqual([
      "listUsers",
      "inviteUser",
    ]);
    expect(result.services[1]?.operations).toEqual([]);
  });

  it("removes operations carrying an excluded tag", () => {
    const result = filterSpecByTags(specWithServices(), {
      excludeTags: ["admin"],
    });

    expect(result.services[0]?.operations.map((entry) => entry.name)).toEqual([
      "listUsers",
    ]);
    expect(result.services[1]?.operations).toEqual([]);
  });

  it("preserves named types referenced by the remaining operations", () => {
    const result = filterSpecByTags(specWithServices(), {
      includeTags: ["users"],
    });

    expect(result.types).toHaveLength(1);
    expect(result.types[0]).toEqual({
      name: "User",
      type: {
        kind: "object",
        properties: [],
      },
    });
  });
});
