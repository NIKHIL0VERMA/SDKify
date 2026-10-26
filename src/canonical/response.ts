import type { Response } from "./types.js";
import { normalizeContent } from "./content.js";

export function normalizeResponse(
  responses: unknown,
): Response | undefined {
  if (!isRecord(responses)) {
    return undefined;
  }

  const statusCode = selectSuccessResponse(
    Object.keys(responses),
  );

  if (!statusCode) {
    return undefined;
  }

  const response = responses[statusCode];

  if (!isRecord(response)) {
    return undefined;
  }

  if (typeof response.$ref === "string") {
    throw new Error(
      `Response $ref is not supported yet: ${response.$ref}`,
    );
  }

  const normalized = normalizeContent(response.content);

  if (!normalized) {
    return {
      statusCode,
    };
  }

  return {
    statusCode,
    contentType: normalized.contentType,
    type: normalized.type,
  };
}

function selectSuccessResponse(
  statusCodes: string[],
): string | undefined {
  const preferred = ["200", "201", "202", "204"];

  for (const status of preferred) {
    if (statusCodes.includes(status)) {
      return status;
    }
  }

  const success = statusCodes.find((status) =>
    /^2\d\d$/.test(status),
  );

  if (success) {
    return success;
  }

  if (statusCodes.includes("default")) {
    return "default";
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