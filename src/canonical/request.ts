import type { RequestBody } from "./types.js";
import { normalizeContent } from "./content.js";

export function normalizeRequestBody(
  requestBody: unknown,
): RequestBody | undefined {
  if (!isRecord(requestBody)) {
    return undefined;
  }

  if (typeof requestBody.$ref === "string") {
    throw new Error(
      `Request body $ref is not supported yet: ${requestBody.$ref}`,
    );
  }

  const normalized = normalizeContent(requestBody.content);

  if (!normalized) {
    return undefined;
  }

  return {
    required: requestBody.required === true,
    contentType: normalized.contentType,
    type: normalized.type,
    example: normalized.example,
  };
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