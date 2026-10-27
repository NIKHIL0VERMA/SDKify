import type { TypeReference } from "./types.js";
import { normalizeSchema } from "./schema.js";

type ContentResult = {
  contentType: string;
  type: TypeReference;
  example?: unknown;
};

export function normalizeContent(
  content: unknown,
): ContentResult | undefined {
  if (!isRecord(content)) {
    return undefined;
  }

  const contentType = selectContentType(Object.keys(content));

  if (!contentType) {
    return undefined;
  }

  const mediaType = content[contentType];

  if (!isRecord(mediaType)) {
    return undefined;
  }

  const schema = isRecord(mediaType.schema)
    ? mediaType.schema
    : undefined;

  return {
    contentType,
    type: normalizeSchema(schema),
    example: selectExample(mediaType.example, mediaType.examples),
  };
}

function selectExample(
  example: unknown,
  examples: unknown,
): unknown {
  if (typeof example !== "undefined") {
    return example;
  }

  if (isRecord(examples)) {
    for (const entry of Object.values(examples)) {
      if (
        isRecord(entry) &&
        typeof entry.value !== "undefined"
      ) {
        return entry.value;
      }
    }
  }

  return undefined;
}

function selectContentType(
  contentTypes: string[],
): string | undefined {
  if (contentTypes.includes("application/json")) {
    return "application/json";
  }

  const jsonType = contentTypes.find(
    (type) =>
      type.endsWith("+json") ||
      type.includes("/json"),
  );

  return jsonType ?? contentTypes[0];
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