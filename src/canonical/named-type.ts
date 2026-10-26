import type {
  NamedType,
} from "./types.js";

import { normalizeSchema } from "./schema.js";

export function normalizeNamedTypes(
  schemas: unknown,
): NamedType[] {
  if (!isRecord(schemas)) {
    return [];
  }

  const types: NamedType[] = [];

  for (const [name, schema] of Object.entries(schemas)) {
    if (!isRecord(schema)) {
      continue;
    }
    
    types.push({
      name,
      description:
        typeof schema.description === "string"
          ? schema.description
          : undefined,
      type: normalizeSchema(schema),
    });
  }

  return types;
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