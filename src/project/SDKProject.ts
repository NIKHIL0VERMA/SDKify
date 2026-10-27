import type {
  SDKSpec,
  Service,
  Operation,
  NamedType,
  Parameter,
  TypeReference,
} from "../canonical/types.js";
import type { FileScope } from "../generator/types.js";

export interface PreparedOperation {
  name: string;
  operationId: string;
  method: Operation["method"];
  path: string;
  fullPath: string;
  summary?: string;
  description?: string;

  parameters: {
    path: Parameter[];
    query: Parameter[];
    header: Parameter[];
    cookie: Parameter[];
  };

  requestBody?: Operation["requestBody"];
  response?: Operation["response"];
}

export class SDKProject {
  constructor(readonly spec: SDKSpec) {}

  get services(): Service[] {
    return this.spec.services;
  }

  get operations(): Operation[] {
    return this.spec.services.flatMap((service) => service.operations);
  }

  get models(): NamedType[] {
    return this.spec.types.filter((type) => type.type.kind !== "enum");
  }

  get enums(): NamedType[] {
    return this.spec.types.filter((type) => type.type.kind === "enum");
  }

  findType(name: string): NamedType | undefined {
    return this.spec.types.find((type) => type.name === name);
  }

  getTypeDependencies(type: NamedType): string[] {
    const references = this.getModelReferences(type.type);
    references.delete(type.name);

    return [...references];
  }

  getModelReferences(type: TypeReference, visited = new Set<string>()): Set<string> {
    switch (type.kind) {
      case "model":
        visited.add(type.name);
        return visited;

      case "array":
        return this.getModelReferences(type.items, visited);

      case "object":
        for (const property of type.properties) {
          this.getModelReferences(property.type, visited);
        }
        return visited;

      case "union":
      case "intersection":
        for (const variant of type.variants) {
          this.getModelReferences(variant, visited);
        }
        return visited;

      case "primitive":
      case "enum":
      case "file":
      case "unknown":
        return visited;
    }
  }

  getOperationModelReferences(operations: Operation[]): string[] {
    const references = new Set<string>();

    for (const operation of operations) {
      if (operation.requestBody?.type) {
        for (const name of this.getModelReferences(operation.requestBody.type)) {
          references.add(name);
        }
      }

      if (operation.response?.type) {
        for (const name of this.getModelReferences(operation.response.type)) {
          references.add(name);
        }
      }

      for (const parameter of operation.parameters) {
        for (const name of this.getModelReferences(parameter.type)) {
          references.add(name);
        }
      }
    }

    return [...references];
  }

  prepareOperation(operation: Operation): PreparedOperation {
    const grouped = {
      path: [] as Parameter[],
      query: [] as Parameter[],
      header: [] as Parameter[],
      cookie: [] as Parameter[],
    };

    for (const parameter of operation.parameters) {
      grouped[parameter.location].push(parameter);
    }

    return {
      name: operation.name,
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      fullPath: this.getBasePath() + operation.path,
      summary: operation.summary,
      description: operation.description,
      parameters: grouped,
      requestBody: operation.requestBody,
      response: operation.response,
    };
  }

  getBasePath(): string {
    const url = this.spec.servers[0]?.url;

    if (!url) {
      return "";
    }

    try {
      const { pathname } = new URL(url);
      return pathname === "/" ? "" : pathname.replace(/\/$/, "");
    } catch {
      return "";
    }
  }

  contexts(scope: FileScope): Record<string, unknown>[] {
    switch (scope) {
      case "default":
        return [{}];

      case "service":
        return this.services.map((service) => ({ service }));

      case "method":
        return this.services.flatMap((service) =>
          service.operations.map((operation) => ({
            service,
            method: this.prepareOperation(operation),
          })),
        );

      case "model":
        return this.models.map((model) => ({ model }));

      case "enum":
        return this.enums.map((enumType) => ({ enum: enumType }));

      case "copy":
        return [];
    }
  }
}
