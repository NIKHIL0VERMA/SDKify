import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NamedType, Service } from "../canonical/types.js";
import type { PreparedOperation, SDKProject } from "../project/SDKProject.js";
import type { LanguageContract } from "./contract.js";
import type { FileDefinition } from "./types.js";
import { TemplateRenderer } from "./renderer.js";

export interface SDKMetadata {
  name?: string;
  version?: string;
  description?: string;
}

export class Generator {
  constructor(
    private readonly project: SDKProject,
    private readonly contract: LanguageContract,
    private readonly metadata: SDKMetadata = {},
  ) {}

  async generate(outputRoot: string): Promise<string[]> {
    const renderer = this.createRenderer();
    const baseContext = this.buildBaseContext();
    const written: string[] = [];

    for (const file of this.contract.getFiles()) {
      if (file.scope === "copy") {
        const destination = await renderer.renderString(file.destination, baseContext);
        const outputPath = path.join(outputRoot, destination);

        await mkdir(path.dirname(outputPath), { recursive: true });
        await copyFile(
          path.resolve(this.getTemplatesDirectory(), file.template),
          outputPath,
        );

        written.push(outputPath);
        continue;
      }

      for (const entityContext of this.project.contexts(file.scope)) {
        const context: Record<string, unknown> = {
          ...baseContext,
          ...entityContext,
        };

        this.applyPreparedContext(file, context);

        const destination = await renderer.renderString(file.destination, context);
        const outputPath = path.join(outputRoot, destination);

        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, await renderer.render(file.template, context), "utf8");

        written.push(outputPath);
      }
    }

    return written;
  }

  private applyPreparedContext(
    file: FileDefinition,
    context: Record<string, unknown>,
  ): void {
    if (file.scope === "model") {
      const model = context.model as NamedType;

      Object.assign(
        context,
        this.contract.prepareModel(
          model,
          this.project.getTypeDependencies(model),
        ),
      );
    }

    if (file.scope === "enum") {
      Object.assign(
        context,
        this.contract.prepareEnum(context.enum as NamedType),
      );
    }

    if (file.scope === "service") {
      const service = context.service as Service;

      Object.assign(
        context,
        this.contract.prepareService(
          service,
          service.operations.map((operation) =>
            this.project.prepareOperation(operation),
          ),
          this.project.getOperationModelReferences(service.operations),
        ),
      );
    }

    if (file.scope === "method") {
      const { service, method } = context as {
        service: Service;
        method: PreparedOperation;
      };

      Object.assign(context, this.contract.prepareMethod(service, method));
    }
  }

  private createRenderer(): TemplateRenderer {
    return new TemplateRenderer(
      [this.getTemplatesDirectory()],
      this.contract.getFilters(),
      this.contract.getFunctions(),
    );
  }

  private getTemplatesDirectory(): string {
    return path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "targets",
      this.contract.getName(),
      "templates",
    );
  }

  private buildBaseContext(): Record<string, unknown> {
    return {
      sdk: {
        name: this.metadata.name ?? this.project.spec.name,
        version: this.metadata.version ?? this.project.spec.version,
        description: this.metadata.description ?? this.project.spec.description,
      },
      spec: this.project.spec,
      services: this.project.services,
      models: this.project.models,
      enums: this.project.enums,
      ...this.contract.prepareSdk(this.project.spec),
    };
  }
}
