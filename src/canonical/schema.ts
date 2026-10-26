import type { TypeReference } from "./types.js";

type OpenAPISchema = Record<string, unknown>;

export function normalizeSchema(
  schema: OpenAPISchema | undefined,
): TypeReference {
  if (!schema) {
    return {
      kind: "unknown",
    };
  }

  // $ref
  if (typeof schema.$ref === "string") {
    return {
      kind: "model",
      name: getRefName(schema.$ref),
    };
  }

  // OpenAPI 3.1:
  // type: ["string", "null"]
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter(
      (type): type is string => typeof type === "string",
    );

    const nullable = types.includes("null");
    const actualType = types.find((type) => type !== "null");

    if (actualType) {
      const result = normalizeSchema({
        ...schema,
        type: actualType,
      });

      if (result.kind !== "unknown") {
        return {
          ...result,
          nullable,
        };
      }
    }
  }

  switch (schema.type) {
    case "string":
      return {
        kind: "primitive",
        type: "string",
      };

    case "integer":
      return {
        kind: "primitive",
        type: "integer",
      };

    case "number":
      return {
        kind: "primitive",
        type: "number",
      };

    case "boolean":
      return {
        kind: "primitive",
        type: "boolean",
      };

    case "array":
      return {
        kind: "array",
        items: normalizeSchema(
          isRecord(schema.items)
            ? schema.items
            : undefined,
        ),
      };

    default:
      return {
        kind: "unknown",
      };
  }
}

function getRefName(ref: string): string {
  const name = ref.split("/").pop();

  if (!name) {
    throw new Error(`Invalid $ref: ${ref}`);
  }

  return name;
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