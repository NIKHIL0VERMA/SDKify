import type { OpenAPI } from "@scalar/openapi-types";

import type {
  HttpMethod,
  Operation,
  SDKSpec,
  Service,
} from "./types.js";

type OpenAPIServer = {
  url: string;
  description?: string;
};

type OpenAPITag = {
  name: string;
  description?: string;
};

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
] as const;

type OpenAPIMethod = (typeof HTTP_METHODS)[number];

export function normalizeOpenAPI(
  document: OpenAPI.Document,
): SDKSpec {
  const services = new Map<string, Service>();

  for (const [path, pathItem] of Object.entries(
    document.paths ?? {},
  )) {
    if (!pathItem) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (!operation) {
        continue;
      }

      const operationId = operation.operationId;

      if (!operationId) {
        throw new Error(
          `Missing operationId for ${method.toUpperCase()} ${path}`,
        );
      }

      const serviceName = operation.tags?.[0] ?? "Default";

      let service = services.get(serviceName);

      if (!service) {
        service = {
          name: serviceName,
          description: findTagDescription(document, serviceName),
          operations: [],
        };

        services.set(serviceName, service);
      }

        service.operations.push({
            name: deriveOperationName(operationId, serviceName),
            operationId,
            method: method.toUpperCase() as HttpMethod,
            path,
            summary: operation.summary,
            description: operation.description,
            parameters: [],
        });
    }
  }

  return {
    name: document.info.title,
    version: document.info.version,
    description: document.info.description,

    servers:
      "servers" in document
        ? (document.servers ?? []).map((server: OpenAPIServer) => ({
            url: server.url,
            description: server.description,
          }))
        : [],

    services: [...services.values()],
  };
}

function findTagDescription(
  document: OpenAPI.Document,
  name: string,
): string | undefined {
  if (!("tags" in document)) {
    return undefined;
  }

  return document.tags?.find((tag: OpenAPITag) => tag.name === name)
    ?.description;
}

function deriveOperationName(
  operationId: string,
  serviceName: string,
): string {
  const service = normalizeName(serviceName);
  const singular = singularize(service);

  const suffixes = [service, singular].sort(
    (a, b) => b.length - a.length,
  );

  for (const suffix of suffixes) {
    if (
      operationId.toLowerCase().endsWith(suffix.toLowerCase())
    ) {
      return operationId.slice(
        0,
        operationId.length - suffix.length,
      );
    }
  }

  return operationId;
}

function normalizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

function singularize(value: string): string {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s")) {
    return value.slice(0, -1);
  }

  return value;
}