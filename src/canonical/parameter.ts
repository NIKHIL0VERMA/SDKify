import type { Parameter } from "./types.js";
import { normalizeSchema } from "./schema.js";

type OpenAPIParameter = {
  name?: unknown;
  in?: unknown;
  required?: unknown;
  description?: unknown;
  schema?: unknown;
  example?: unknown;
  default?: unknown;
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
    wireName: parameter.name,
    location: parameter.in as Parameter["location"],
    required:
      parameter.in === "path" ||
      parameter.required === true,

    description:
      typeof parameter.description === "string"
        ? parameter.description
        : undefined,

    type: normalizeSchema(schema),
    example: selectValue(parameter.example, schema?.example),
    default: selectValue(parameter.default, schema?.default),
  };
}

function selectValue(
  primary: unknown,
  fallback: unknown,
): unknown {
  if (typeof primary !== "undefined") {
    return primary;
  }

  if (typeof fallback !== "undefined") {
    return fallback;
  }

  return undefined;
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