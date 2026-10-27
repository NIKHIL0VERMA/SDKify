import type { NamedType, SDKSpec, Service, TypeReference } from "../canonical/types.js";
import type { FileDefinition, SDKFilter } from "./types.js";
import type { PreparedOperation } from "../project/SDKProject.js";

export abstract class LanguageContract {

  abstract getName(): string;
  abstract getFiles(): FileDefinition[];
  abstract getKeywords(): string[];
  abstract getTypeName(type: TypeReference): string;

  getFilters(): SDKFilter[] {
    return [];
  }

  getFunctions(): SDKFilter[] {
    return [];
  }

  escapeKeyword(value: string): string {
    if (this.getKeywords().includes(value)) {
      return `x${value}`;
    }
    return value;
  }

  prepareSdk(_spec: SDKSpec): Record<string, unknown> {
    return {};
  }

  prepareService(
    _service: Service,
    _methods: PreparedOperation[],
    _dependencies: string[],
  ): Record<string, unknown> {
    return {};
  }

  prepareMethod(
    _service: Service,
    _method: PreparedOperation,
  ): Record<string, unknown> {
    return {};
  }

  prepareModel(
    _model: NamedType,
    _dependencies: string[],
  ): Record<string, unknown> {
    return {};
  }

  prepareEnum(_enumType: NamedType): Record<string, unknown> {
    return {};
  }
}
