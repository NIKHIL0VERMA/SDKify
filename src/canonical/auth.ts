import type {
  ApiKeyAuth,
  AuthScheme,
  HttpAuth,
} from "./types.js";

export function normalizeAuth(
  securitySchemes: unknown,
): AuthScheme[] {
  if (!isRecord(securitySchemes)) {
    return [];
  }

  const schemes: AuthScheme[] = [];

  for (const [name, rawScheme] of Object.entries(
    securitySchemes,
  )) {
    if (!isRecord(rawScheme)) {
      continue;
    }

    if (rawScheme.type === "apiKey") {
      const scheme = normalizeApiKey(
        name,
        rawScheme,
      );

      if (scheme) {
        schemes.push(scheme);
      }

      continue;
    }

    if (rawScheme.type === "http") {
      const scheme = normalizeHttp(
        name,
        rawScheme,
      );

      if (scheme) {
        schemes.push(scheme);
      }
    }
  }

  return schemes;
}

function normalizeApiKey(
  name: string,
  scheme: Record<string, unknown>,
): ApiKeyAuth | undefined {
  if (
    typeof scheme.name !== "string" ||
    !isApiKeyLocation(scheme.in)
  ) {
    return undefined;
  }

  return {
    kind: "apiKey",
    name,
    wireName: scheme.name,
    location: scheme.in,
  };
}

function normalizeHttp(
  name: string,
  scheme: Record<string, unknown>,
): HttpAuth | undefined {
  if (typeof scheme.scheme !== "string") {
    return undefined;
  }

  return {
    kind: "http",
    name,
    scheme: scheme.scheme,

    bearerFormat:
      typeof scheme.bearerFormat === "string"
        ? scheme.bearerFormat
        : undefined,
  };
}

function isApiKeyLocation(
  value: unknown,
): value is ApiKeyAuth["location"] {
  return (
    value === "header" ||
    value === "query" ||
    value === "cookie"
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