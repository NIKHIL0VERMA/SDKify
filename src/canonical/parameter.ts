import type { Parameter } from "./types.js";
import { normalizeSchema } from "./schema.js";

type OpenAPIParameter = {
  name?: unknown;
  in?: unknown;
  required?: unknown;
  description?: unknown;
  schema?: unknown;
  $ref?: unknown;
};

const LOCATIONS = new Set([
  "path",
  "query",
  "header",
  "cookie",
]);

export function normalizeParameter(
  parameter: OpenAPIParameter,
): Parameter {
  // We'll resolve parameter $refs later.
  if (typeof parameter.$ref === "string") {
    throw new Error(
      `Parameter $ref is not supported yet: ${parameter.$ref}`,
    );
  }

  if (typeof parameter.name !== "string") {
    throw new Error("Parameter is missing a name");
  }

  if (
    typeof parameter.in !== "string" ||
    !LOCATIONS.has(parameter.in)
  ) {
    throw new Error(
      `Invalid parameter location: ${String(parameter.in)}`,
    );
  }

  const schema = isRecord(parameter.schema)
    ? parameter.schema
    : undefined;

  return {
    name: camelCase(parameter.name),
    wireName: parameter.name,

    location: parameter.in as Parameter["location"],

    // OpenAPI path parameters are always required.
    required:
      parameter.in === "path" ||
      parameter.required === true,

    description:
      typeof parameter.description === "string"
        ? parameter.description
        : undefined,

    type: normalizeSchema(schema),
  };
}

function camelCase(value: string): string {
  return value.replace(
    /[_-]+([a-zA-Z0-9])/g,
    (_, character: string) => character.toUpperCase(),
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}