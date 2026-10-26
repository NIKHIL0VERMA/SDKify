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

  if (typeof schema.$ref === "string") {
    return {
      kind: "model",
      name: getRefName(schema.$ref),
    };
  }

  if (Array.isArray(schema.enum)) {
    const values = schema.enum.filter(
      (
        value,
      ): value is string | number | boolean =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    );

    if (values.length > 0) {
      return {
        kind: "enum",
        values,
      };
    }
  }

  if (Array.isArray(schema.oneOf)) {
    return normalizeUnion(schema.oneOf);
  }

  if (Array.isArray(schema.anyOf)) {
    return normalizeUnion(schema.anyOf);
  }

  if (Array.isArray(schema.allOf)) {
    return normalizeIntersection(schema.allOf);
  }

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

    case "object":
      return normalizeObjectSchema(schema);

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

function normalizeObjectSchema(
  schema: Record<string, unknown>,
): TypeReference {
  if (!isRecord(schema.properties)) {
    return {
      kind: "object",
      properties: [],
    };
  }

  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter(
        (value): value is string =>
          typeof value === "string",
      )
      : [],
  );

  const properties = Object.entries(
    schema.properties,
  )
    .filter(
      (
        entry,
      ): entry is [
        string,
        Record<string, unknown>,
      ] => isRecord(entry[1]),
    )
    .map(([wireName, property]) => ({
      name: camelCase(wireName),
      wireName,
      required: required.has(wireName),
      type: normalizeSchema(property),
    }));

  return {
    kind: "object",
    properties,
  };
}

function camelCase(value: string): string {
  return value.replace(
    /[_-]+([a-zA-Z0-9])/g,
    (_, character: string) =>
      character.toUpperCase(),
  );
}

function normalizeUnion(
  schemas: unknown[],
): TypeReference {
  let nullable = false;

  const variants: TypeReference[] = [];

  for (const schema of schemas) {
    if (!isRecord(schema)) {
      continue;
    }

    if (schema.type === "null") {
      nullable = true;
      continue;
    }

    variants.push(normalizeSchema(schema));
  }

  if (variants.length === 0) {
    return {
      kind: "unknown",
    };
  }

  if (variants.length === 1) {
    const variant = variants[0];

    if (!variant) {
      return {
        kind: "unknown",
      };
    }

    if (variant.kind === "unknown") {
      return variant;
    }

    if (!nullable) {
      return variant;
    }

    return {
      ...variant,
      nullable: true,
    };
  }

  return {
    kind: "union",
    variants,
    nullable: nullable || undefined,
  };
}

function normalizeIntersection(
  schemas: unknown[],
): TypeReference {
  const variants = schemas
    .filter(isRecord)
    .map(normalizeSchema)
    .filter(
      (type): type is Exclude<TypeReference, { kind: "unknown" }> =>
        type.kind !== "unknown",
    );

  if (variants.length === 0) {
    return {
      kind: "unknown",
    };
  }

  if (variants.length === 1) {
    const variant = variants[0];

    if (!variant) {
      return {
        kind: "unknown",
      };
    }

    return variant;
  }

  return {
    kind: "intersection",
    variants,
  };
}