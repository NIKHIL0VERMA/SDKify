import type { TypeReference } from "./types.js";
import { normalizeSchema } from "./schema.js";

type ContentResult = {
  contentType: string;
  type: TypeReference;
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
  };
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