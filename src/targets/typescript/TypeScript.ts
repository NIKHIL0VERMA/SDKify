import type {
  AuthScheme,
  NamedType,
  ObjectProperty,
  Parameter,
  SDKSpec,
  Service,
  TypeReference,
} from "../../canonical/types.js";
import { LanguageContract } from "../../generator/contract.js";
import type { FileDefinition } from "../../generator/types.js";
import type { PreparedOperation } from "../../project/SDKProject.js";

/**
 * One flattened multipart request field; `name` is the SDK identifier,
 * `wireName` the key appended to FormData.
 */
interface PreparedMultipartField {
  name: string;
  wireName: string;
  required: boolean;
  description?: string;
  tsType: string;
  isFile: boolean;
  isFileArray: boolean;
  isJson: boolean;
  example: string;
}

/**
 * Named types referenced by a rendered docs example — enums need value
 * imports (const objects), models type imports (interfaces).
 */
interface ExampleImports {
  enums: Set<string>;
  models: Set<string>;
}

export class TypeScript extends LanguageContract {
  private spec?: SDKSpec;


  getName(): string {
    return "typescript";
  }

  getFiles(): FileDefinition[] {
    return [
      {
        scope: "default",
        template: "client.twig",
        destination: "src/client.ts",
      },
      {
        scope: "default",
        template: "index.twig",
        destination: "src/index.ts",
      },
      {
        scope: "default",
        template: "models-index.twig",
        destination: "src/models/index.ts",
      },
      {
        scope: "default",
        template: "package.json.twig",
        destination: "package.json",
      },
      {
        scope: "default",
        template: "inputFile.twig",
        destination: "src/inputFile.ts",
      },
      {
        scope: "copy",
        template: "tsconfig.json",
        destination: "tsconfig.json",
      },
      {
        scope: "service",
        template: "service.twig",
        destination: "src/services/{{ service.name | caseKebab }}.ts",
      },
      {
        scope: "model",
        template: "model.zod.twig",
        destination: "src/models/{{ model.name }}.ts",
      },
      {
        scope: "enum",
        template: "enum.zod.twig",
        destination: "src/models/{{ enum.name }}.ts",
      },
      {
        scope: "method",
        template: "docs/example.md.twig",
        destination:
          "docs/examples/{{ service.name | caseKebab }}/{{ method.name | caseKebab }}.md",
      },
    ];
  }

  getKeywords(): string[] {
    return [
      "break", "case", "catch", "class", "const", "continue", "debugger",
      "default", "delete", "do", "else", "enum", "export", "extends",
      "false", "finally", "for", "function", "if", "import", "in",
      "instanceof", "new", "null", "return", "super", "switch", "this",
      "throw", "true", "try", "typeof", "var", "void", "while", "with",
      "as", "implements", "interface", "let", "package", "private",
      "protected", "public", "static", "yield", "await", "async",
    ];
  }

  getTypeName(type: TypeReference): string {
    let result: string;

    switch (type.kind) {
      case "primitive":
        result = this.getPrimitiveType(type.type);
        break;

      case "model":
        result = type.name;
        break;

      case "file":
        result = "File";
        break;

      case "array":
        result = `Array<${this.getTypeName(type.items)}>`;
        break;

      case "object":
        result = this.getObjectType(type.properties);
        break;

      case "enum":
        result = type.values
          .map((value) => this.getLiteral(value))
          .join(" | ");
        break;

      case "union":
        result = type.variants
          .map((variant) => this.getTypeName(variant))
          .join(" | ");
        break;

      case "intersection":
        result = type.variants
          .map((variant) => this.getTypeName(variant))
          .join(" & ");
        break;

      case "unknown":
        result = "unknown";
        break;
    }

    if ("nullable" in type && type.nullable) {
      return `${result} | null`;
    }

    return result;
  }

  prepareSdk(spec: SDKSpec): Record<string, unknown> {
    this.spec = spec;
    const authSchemes = this.getAuthSchemes(spec);

    return {
      baseUrl: spec.servers[0]?.url ?? "https://example.com",
      basePath: this.getBasePath(spec),
      authSchemes,
      docsSetupLines: [
        "const client = createClient({",
        ...authSchemes.map(
          (scheme) =>
            `  ${scheme.configName}: "YOUR_${this.toSnakeCase(String(scheme.configName)).toUpperCase()}",`,
        ),
        "});",
      ],
      models: spec.types
        .filter((type) => type.type.kind !== "enum")
        .map((type) => ({ name: type.name, fileName: type.name })),
      enums: spec.types
        .filter((type) => type.type.kind === "enum")
        .map((type) => ({ name: type.name, fileName: type.name })),
      sdkServices: spec.services.map((service) => ({
        name: service.name,
        className: this.serviceClassName(service.name),
        instanceName: this.escapeKeyword(this.toCamelCase(service.name)),
        fileName: this.toKebabCase(service.name),
      })),
    };
  }

  /**
   * Service class name, suffixed with "Service" when it would collide
   * with a model of the same name.
   */
  private serviceClassName(name: string): string {
    const className = this.toPascalCase(name);

    if (
      this.spec?.types.some((type) => type.name === className)
    ) {
      return `${className}Service`;
    }

    return className;
  }

  prepareService(
    service: Service,
    methods: PreparedOperation[],
    dependencies: string[],
  ): Record<string, unknown> {
    const methodData = methods.map((method) =>
      this.prepareMethodData(method, service),
    );

    // Aggregated across the file's methods so imports render once.
    const schemaImports = new Map<string, string>();

    for (const data of methodData) {
      for (const entry of (data.methodSchemaImports ?? []) as {
        name: string;
        fileName: string;
      }[]) {
        schemaImports.set(entry.name, entry.fileName);
      }
    }

    
    
    const typeImports = dependencies.map((name) => ({ name, fileName: name }));
    const combined = [...schemaImports.entries()].map(
      ([schemaName, modelName]) => ({
        name: schemaName,
        modelName,
        fileName: modelName,
        withType: typeImports.some((entry) => entry.name === modelName),
      }),
    );

    return {
      name: service.name,
      className: this.serviceClassName(service.name),
      description: service.description,
      methods: methodData,
      dependencies: typeImports.filter(
        (entry) => !combined.some((schema) => schema.modelName === entry.name),
      ),
      schemaImports: combined,
      needsZod: methodData.some((data) => data.methodNeedsZod === true),
    };
  }

  prepareMethod(
    service: Service,
    method: PreparedOperation,
  ): Record<string, unknown> {
    return { method: this.prepareMethodData(method, service) };
  }

  private prepareMethodData(
    method: PreparedOperation,
    service: Service,
  ): Record<string, unknown> {
    const map = new Map<string, string>();

    for (const parameter of method.parameters.path) {
      map.set(parameter.wireName, this.escapeKeyword(this.toCamelCase(parameter.wireName)));
    }

    const parameter = (p: Parameter) => ({
      name: this.escapeKeyword(this.toCamelCase(p.wireName)),
      
      queryKey: this.getWireKey(p.wireName),
      wireName: p.wireName,
      required: p.required,
      description: p.description,
      tsType: this.getTypeName(p.type),
    });

    const path = method.parameters.path.map(parameter);
    const query = method.parameters.query.map(parameter);
    const header = method.parameters.header.map(parameter);

    const hasBody = method.requestBody !== undefined;
    const isMultipart =
      hasBody && method.requestBody!.contentType === "multipart/form-data";
    const imports: ExampleImports = { enums: new Set(), models: new Set() };
    const fields = isMultipart
      ? this.getMultipartFields(method.requestBody!.type, imports)
      : [];
    const bodyRequired = method.requestBody?.required === true;
    const bodyOnly =
      hasBody &&
      !isMultipart &&
      path.length === 0 &&
      query.length === 0 &&
      header.length === 0;

    const argsRequired =
      bodyOnly
        ? bodyRequired
        : path.some((p) => p.required) ||
          query.some((p) => p.required) ||
          header.some((p) => p.required) ||
          (isMultipart && fields.some((f) => f.required)) ||
          (hasBody && !isMultipart && bodyRequired);

    const pathExpression = method.fullPath.replace(
      /\{([^}]+)\}/g,
      (_, wireName: string) => `\${${map.get(wireName) ?? wireName}}`,
    );
    const destructured = [
      ...path.map((p) => p.name),
      ...query.map((p) => p.name),
      ...fields.map((f) => f.name),
      ...(hasBody && !bodyOnly && !isMultipart ? ["body"] : []),
    ];

    const isFileUsed = this.containsFile(method.requestBody?.type) ||
      [...method.parameters.path, ...method.parameters.query, ...method.parameters.header]
        .some((p) => this.containsFile(p.type));

    const data: Record<string, unknown> = {
      name: this.escapeKeyword(method.name),
      method: method.method,
      summary: method.summary,
      description: method.description,
      pathExpression,
      path,
      query,
      header,
      hasQuery: query.length > 0,
      hasHeader: header.length > 0,
      hasBody,
      bodyOnly,
      argsRequired,
      isMultipart,
      destructured,
      serviceInstance: this.escapeKeyword(this.toCamelCase(service.name)),
      isFileUsed,
    };

    const exampleEntries: { name: string; required: boolean; example: string }[] = [
      ...[...method.parameters.path, ...method.parameters.query, ...method.parameters.header].map(
        (p) => ({
          name: this.escapeKeyword(this.toCamelCase(p.wireName)),
          required: p.required,
          example: this.getExampleValue(
            p.type,
            p.example,
            p.default,
            p.wireName,
            new Set(),
            2,
            imports,
          ),
        }),
      ),
      ...fields.map((field) => ({
        name: field.name,
        required: field.required,
        example: field.example,
      })),
      
    ].sort((a, b) => Number(b.required) - Number(a.required));

    const exampleParamLines = exampleEntries.map(
      (entry) => `  ${entry.name}: ${entry.example},`,
    );

    const bodyType =
      hasBody && !isMultipart ? method.requestBody!.type : undefined;
    const isModelBody = (
      type: TypeReference,
    ): type is Extract<TypeReference, { kind: "model" }> =>
      type.kind === "model" && !this.isNamedEnumRef(type);

    if (isMultipart) {
      data.fields = fields;
    } else if (hasBody) {
      data.body = {
        tsType: this.getTypeName(bodyType!),
        required: bodyRequired,
        contentType: method.requestBody!.contentType,
      };
    }

    const docsLines: string[] = [];
    const prefix = method.response?.type ? "const result = " : "";

    if (bodyType && isModelBody(bodyType)) {
      imports.models.add(bodyType.name);
      const literal = this.getExampleValue(
        bodyType,
        method.requestBody!.example,
        undefined,
        "body",
        new Set(),
        0,
        imports,
      );

      docsLines.push(`const body: ${bodyType.name} = ${literal};`, "");
    }

    if (bodyOnly) {
      const value =
        bodyType && isModelBody(bodyType)
          ? "body"
          : this.getExampleValue(
              bodyType!,
              method.requestBody!.example,
              undefined,
              "body",
              new Set(),
              0,
              imports,
            );

      docsLines.push(`${prefix}await client.${data.serviceInstance}.${data.name}(${value});`);
    } else if (exampleParamLines.length > 0) {
      docsLines.push(`${prefix}await client.${data.serviceInstance}.${data.name}({`);
      docsLines.push(...exampleParamLines);

      if (bodyType) {
        docsLines.push(
          isModelBody(bodyType)
            ? "  body,"
            : `  body: ${this.getExampleValue(
                bodyType,
                method.requestBody!.example,
                undefined,
                "body",
                new Set(),
                2,
                imports,
              )},`,
        );
      }

      docsLines.push("});");
    } else {
      docsLines.push(`${prefix}await client.${data.serviceInstance}.${data.name}();`);
    }

    if (method.response?.type) {
      docsLines.push("console.log(result);");
    }

    if (method.response?.type) {
      
      
      const schemaImports = new Map<string, string>();
      const parse = this.getResponseParse(method.response.type, schemaImports);

      if (parse) {
        data.responseParse = parse;
        data.methodSchemaImports = [...schemaImports.entries()].map(
          ([name, fileName]) => ({ name, fileName }),
        );

        if (parse.startsWith("z.array")) {
          data.methodNeedsZod = true;
        }
      }
    }

    
    const importParts = [
      "createClient",
      ...[...imports.enums].filter((name) =>
        docsLines.some((line) => line.includes(`${name}.`)),
      ),
      ...(isFileUsed ? ["InputFile"] : []),
      ...[...imports.models].map((name) => `type ${name}`),
    ];

    data.docsImportLine = `import { ${importParts.join(", ")} } from "../../src/index.js";`;
    data.docsLines = docsLines;

    if (method.response?.type) {
      data.response = this.getTypeName(method.response.type);
    }

    data.requestHead =
      data.responseParse !== undefined
        ? "const data = await this.client.request<unknown>("
        : `return this.client.request<${data.response ? (data.response as string) : "void"}>(`;

    return data;
  }

  /**
   * Multipart request bodies become flat file/value fields appended to
   * FormData. `format: binary` fields map to InputFile; scalar parts
   * append as plain strings; complex parts as JSON.
   */
  private getMultipartFields(
    type: TypeReference,
    imports: ExampleImports,
  ): PreparedMultipartField[] {
    if (type.kind === "file") {
      return [
        {
          name: "file",
          wireName: "file",
          required: true,
          tsType: "InputFile",
          isFile: true,
          isFileArray: false,
          isJson: false,
          description: undefined,
          example: 'await InputFile.fromPath("./example.pdf")',
        },
      ];
    }

    if (type.kind !== "object") {
      return [];
    }

    return type.properties.map((property) => {
      const name = this.escapeKeyword(this.toCamelCase(property.wireName));
      const base = {
        name,
        wireName: property.wireName,
        required: property.required,
        description: property.description,
      };
      const file = property.type.kind === "file";
      const fileArray =
        property.type.kind === "array" &&
        property.type.items.kind === "file";

      if (file) {
        return {
          ...base,
          tsType: "InputFile",
          isFile: true,
          isFileArray: false,
          isJson: false,
          example: 'await InputFile.fromPath("./example.pdf")',
        };
      }

      if (fileArray) {
        return {
          ...base,
          tsType: "Array<InputFile>",
          isFile: true,
          isFileArray: true,
          isJson: false,
          example: '[await InputFile.fromPath("./example.pdf")]',
        };
      }

      return {
        ...base,
        tsType: this.getTypeName(property.type),
        isFile: false,
        isFileArray: false,
        isJson: property.type.kind !== "primitive",
        example: this.getExampleValue(
          property.type,
          property.example,
          property.default,
          property.wireName,
          new Set(),
          2,
          imports,
        ),
      };
    });
  }

  /**
   * Whether any file type appears within a type — drives InputFile
   * imports in docs examples.
   */
  private containsFile(type: TypeReference | undefined): boolean {
    if (!type) {
      return false;
    }

    switch (type.kind) {
      case "file":
        return true;

      case "array":
        return this.containsFile(type.items);

      case "object":
        return type.properties.some((property) =>
          this.containsFile(property.type),
        );

      case "union":
      case "intersection":
        return type.variants.some((variant) => this.containsFile(variant));

      default:
        return false;
    }
  }

  /**
   * Code literal for a docs example value, preferring spec-declared
   * example over default over a synthesized placeholder. Non-empty
   * objects print multiline at `indent`; named enums render as member
   * references (Status.draft) and collect value imports.
   */
  private getExampleValue(
    type: TypeReference,
    example: unknown,
    def: unknown,
    placeholder: string,
    seen: Set<string> = new Set(),
    indent = 0,
    imports?: ExampleImports,
  ): string {
    if (typeof example !== "undefined") {
      return this.getCodeLiteral(example, indent);
    }

    if (typeof def !== "undefined") {
      return this.getCodeLiteral(def, indent);
    }

    switch (type.kind) {
      case "file":
        return 'await InputFile.fromPath("./example.pdf")';

      case "model":
        if (this.isNamedEnumRef(type)) {
          const enumType = this.spec?.types.find(
            (named) => named.name === type.name,
          );
          const first =
            enumType && enumType.type.kind === "enum"
              ? enumType.type.values[0]
              : undefined;

          imports?.enums.add(type.name);

          return `${type.name}.${this.getEnumMemberName(first ?? "value")}`;
        }

        imports?.models.add(type.name);

        return this.getModelExample(type.name, seen, indent, imports);

      case "array":
        return this.wrapArray(
          [
            this.getExampleValue(
              type.items,
              undefined,
              undefined,
              placeholder,
              seen,
              indent + 2,
              imports,
            ),
          ],
          indent,
        );

      case "enum":
        return this.getLiteral(type.values[0] ?? "value");

      case "primitive":
        if (type.type === "string") {
          return JSON.stringify(placeholder);
        }

        if (type.type === "boolean") {
          return "true";
        }

        return "1";

      case "object": {
        if (type.properties.length === 0) {
          return "{}";
        }

        const pad = " ".repeat(indent + 2);
        const lines = type.properties.map(
          (property) =>
            `${pad}${this.getWireKey(property.wireName)}: ${this.getExampleValue(
              property.type,
              property.example,
              property.default,
              property.wireName,
              seen,
              indent + 2,
              imports,
            )},`,
        );

        return `{\n${lines.join("\n")}\n${" ".repeat(indent)}}`;
      }

      case "union":
      case "intersection": {
        const variant = type.variants.find(
          (candidate) => candidate.kind !== "unknown",
        );

        return variant
          ? this.getExampleValue(
              variant,
              undefined,
              undefined,
              placeholder,
              seen,
              indent,
              imports,
            )
          : "{}";
      }

      case "unknown":
        return JSON.stringify(placeholder);
    }
  }

  /**
   * YAML/JSON example values rendered as TypeScript code literals;
   * non-empty objects print multiline at `indent`.
   */
  private getCodeLiteral(value: unknown, indent = 0): string {
    if (value === null) {
      return "null";
    }

    if (typeof value === "string") {
      return JSON.stringify(value);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return this.wrapArray(
        value.map((item) => this.getCodeLiteral(item, indent + 2)),
        indent,
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);

      if (entries.length === 0) {
        return "{}";
      }

      const pad = " ".repeat(indent + 2);
      const lines = entries.map(
        ([key, item]) =>
          `${pad}${this.getWireKey(key)}: ${this.getCodeLiteral(item, indent + 2)},`,
      );

      return `{\n${lines.join("\n")}\n${" ".repeat(indent)}}`;
    }

    return JSON.stringify(value);
  }

  /**
   * Arrays render inline for scalar items and multiline when any item
   * is a multiline object/array literal.
   */
  private wrapArray(items: string[], indent: number): string {
    if (items.length === 0) {
      return "[]";
    }

    if (items.every((item) => !item.includes("\n"))) {
      return `[${items.join(", ")}]`;
    }

    const pad = " ".repeat(indent + 2);

    return `[\n${items.map((item) => `${pad}${item},`).join("\n")}\n${" ".repeat(indent)}]`;
  }

  /**
   * Example object literal synthesized from a model's properties, with
   * cycle protection for self-referencing models.
   */
  private getModelExample(
    name: string,
    seen: Set<string>,
    indent = 0,
    imports?: ExampleImports,
  ): string {
    if (seen.has(name)) {
      return "{}";
    }

    const model = this.spec?.types.find((type) => type.name === name);
    seen.add(name);

    if (!model) {
      return "{}";
    }

    if (model.type.kind === "object") {
      return this.getPropertiesExample(
        model.type.properties,
        seen,
        indent,
        imports,
      );
    }

    if (model.type.kind === "intersection") {
      const properties = model.type.variants.flatMap((variant) =>
        variant.kind === "object" ? variant.properties : [],
      );

      return this.getPropertiesExample(properties, seen, indent, imports);
    }

    return this.getExampleValue(
      model.type,
      undefined,
      undefined,
      name,
      seen,
      indent,
      imports,
    );
  }

  private getPropertiesExample(
    properties: ObjectProperty[],
    seen: Set<string>,
    indent = 0,
    imports?: ExampleImports,
  ): string {
    if (properties.length === 0) {
      return "{}";
    }

    const pad = " ".repeat(indent + 2);
    const lines = properties.map(
      (property) =>
        `${pad}${this.getWireKey(property.wireName)}: ${this.getExampleValue(
          property.type,
          property.example,
          property.default,
          property.wireName,
          seen,
          indent + 2,
          imports,
        )},`,
    );

    return `{\n${lines.join("\n")}\n${" ".repeat(indent)}}`;
  }

  prepareModel(
    model: NamedType,
    _dependencies: string[],
  ): Record<string, unknown> {
    const { type } = model;
    let expression: string;

    if (this.canRenderAsInterface(type)) {
      const parents = this.getInterfaceParents(type);
      const objectPart = this.getZodExpression({
        kind: "object",
        properties: this.getInterfaceProperties(type),
      });
      expression = objectPart;

      for (const parent of [...parents].reverse()) {
        expression = `z.lazy(() => ${parent}Schema).and(${expression})`;
      }
    } else {
      expression = this.getZodExpression(type);
    }

    const recursive = this.isSelfRecursive(model);

    return {
      name: model.name,
      description: model.description,
      kind: "zod",
      schemaExpression: expression,
      
      
      
      
      recursive,
      tsTypeExpression: recursive ? this.getTypeName(type) : undefined,
      typeImports: recursive ? this.getTypeImports(type, model.name) : [],
      schemaImports: this.withoutSelfSchemaImport(
        this.getSchemaImports(type),
        model.name,
      ),
    };
  }

  /**
   * Whether a model references itself anywhere in its own type graph.
   * Self-references render as `z.lazy(() => <same>Schema)`, so the
   * model must declare its type structurally rather than z.infer it
   * from its own schema.
   */
  private isSelfRecursive(model: NamedType): boolean {
    const target = model.name;

    const visit = (type: TypeReference): boolean => {
      switch (type.kind) {
        case "model":
          return type.name === target;

        case "array":
          return visit(type.items);

        case "object":
          return type.properties.some((property) =>
            visit(property.type),
          );

        case "union":
        case "intersection":
          return type.variants.some(visit);

        default:
          return false;
      }
    };

    return visit(model.type);
  }

  /**
   * Type-only imports a recursive model's structural type alias needs —
   * named model and enum references other than itself.
   */
  private getTypeImports(
    type: TypeReference,
    selfName: string,
  ): { name: string; fileName: string }[] {
    const names = new Set<string>();

    const visit = (candidate: TypeReference): void => {
      switch (candidate.kind) {
        case "model":
          if (candidate.name !== selfName) {
            names.add(candidate.name);
          }
          break;

        case "array":
          visit(candidate.items);
          break;

        case "object":
          candidate.properties.forEach((property) =>
            visit(property.type),
          );
          break;

        case "union":
        case "intersection":
          candidate.variants.forEach(visit);
          break;

        default:
          break;
      }
    };

    visit(type);

    return [...names].map((name) => ({ name, fileName: name }));
  }

  /**
   * Drops a model's own runtime schema import — a self-import both files
   * don't need and recursive graphs would emit.
   */
  private withoutSelfSchemaImport(
    imports: { name: string; fileName: string }[],
    modelName: string,
  ): { name: string; fileName: string }[] {
    const self = `${modelName}Schema`;

    return imports.filter((entry) => entry.name !== self);
  }

  /**
   * Zod schema expression for a canonical type. Named models render as
   * lazy schema references (safe under circular imports and recursive
   * models); wire keys are used verbatim.
   */
  private getZodExpression(
    type: TypeReference,
    indent = 0,
  ): string {
    switch (type.kind) {
      case "primitive":
        if (type.type === "string") {
          return "z.string()";
        }

        if (type.type === "boolean") {
          return "z.boolean()";
        }

        return "z.number()";

      case "model": {
        if (this.isNamedEnumRef(type)) {
          return `${type.name}Schema`;
        }

        return `z.lazy(() => ${type.name}Schema)`;
      }

      case "array":
        return `z.array(${this.getZodExpression(type.items, indent)})`;

      case "enum": {
        if (type.values.every((value) => typeof value === "string")) {
          return `z.enum([${type.values.map((value) => this.getLiteral(value)).join(", ")}])`;
        }

        return `z.union([${type.values
          .map((value) => `z.literal(${this.getLiteral(value)})`)
          .join(", ")}])`;
      }

      case "object": {
        if (type.properties.length === 0) {
          return "z.object({})";
        }

        const pad = " ".repeat(indent + 2);
        const fields = type.properties.map(
          (property) =>
            `${pad}${this.getWireKey(property.wireName)}: ${this.getZodProperty(
              property,
              indent + 2,
            )}`,
        );

        return `z.object({\n${fields.join(",\n")},\n${" ".repeat(indent)}})`;
      }

      case "union": {
        const variants = type.variants.filter(
          (variant) => variant.kind !== "unknown",
        );

        if (variants.length === 0) {
          return "z.unknown()";
        }

        if (variants.length === 1) {
          return this.getZodExpression(variants[0]!, indent);
        }

        return `z.union([${variants
          .map((variant) => this.getZodExpression(variant, indent))
          .join(", ")}])`;
      }

      case "intersection": {
        const variants = type.variants.filter(
          (variant) => variant.kind !== "unknown",
        );

        if (variants.length === 0) {
          return "z.unknown()";
        }

        let expression = this.getZodExpression(variants[0]!, indent);

        for (const variant of variants.slice(1)) {
          expression += `.and(${this.getZodExpression(variant, indent)})`;
        }

        return expression;
      }

      case "file":
        return "z.unknown()";

      case "unknown":
        return "z.unknown()";
    }
  }

  getZodProperty(
    property: ObjectProperty,
    indent = 0,
  ): string {
    let expression = this.getZodExpression(property.type, indent);

    if (property.type.kind === "primitive" && property.type.nullable) {
      expression += ".nullable()";
    }

    if (!property.required) {
      expression += ".optional()";
    }

    return expression;
  }

  /**
   * Runtime zod-schema imports a type pulls in — named model and enum
   * schemas only.
   */
  private getSchemaImports(type: TypeReference): { name: string; fileName: string }[] {
    const imports = new Map<string, string>();

    const walk = (candidate: TypeReference): void => {
      switch (candidate.kind) {
        case "model":
          imports.set(`${candidate.name}Schema`, candidate.name);
          break;

        case "array":
          walk(candidate.items);
          break;

        case "object":
          candidate.properties.forEach((property) =>
            walk(property.type),
          );
          break;

        case "union":
        case "intersection":
          candidate.variants.forEach(walk);
          break;

        default:
          break;
      }
    };

    walk(type);

    return [...imports.entries()].map(([name, fileName]) => ({
      name,
      fileName,
    }));
  }

  /**
   * Schema expression that validates a response body —
   * `TaskSchema.parse(data)` for named models/enums, `z.array(...)`
   * for lists; undefined for types without a named schema.
   */
  private getResponseParse(
    type: TypeReference,
    imports: Map<string, string>,
  ): string | undefined {
    if (type.kind === "model") {
      imports.set(`${type.name}Schema`, type.name);

      return `${type.name}Schema.parse(data)`;
    }

    if (type.kind === "array") {
      const items = type.items;

      if (items.kind === "model") {
        imports.set(`${items.name}Schema`, items.name);

        return `z.array(${items.name}Schema).parse(data)`;
      }
    }

    return undefined;
  }

  prepareEnum(enumType: NamedType): Record<string, unknown> {
    const values =
      enumType.type.kind === "enum" ? enumType.type.values : [];

    return {
      name: enumType.name,
      description: enumType.description,
      kind: "enum",
      schemaExpression: this.getZodExpression(enumType.type),
      values: values.map((value) => ({
        name: this.getEnumMemberName(value),
        literal: this.getLiteral(value),
      })),
    };
  }

  private getBasePath(spec: SDKSpec): string {
    const url = spec.servers[0]?.url;

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

  private canRenderAsInterface(type: TypeReference): boolean {
    if (type.kind === "object") {
      return true;
    }

    if (type.kind !== "intersection") {
      return false;
    }

    return type.variants.every(
      (variant) => variant.kind === "model" || variant.kind === "object",
    );
  }

  private getInterfaceParents(type: TypeReference): string[] {
    if (type.kind !== "intersection") {
      return [];
    }

    return type.variants
      .filter(
        (variant): variant is Extract<TypeReference, { kind: "model" }> =>
          variant.kind === "model",
      )
      .map((variant) => variant.name);
  }

  private getInterfaceProperties(type: TypeReference): ObjectProperty[] {
    if (type.kind === "object") {
      return type.properties;
    }

    if (type.kind !== "intersection") {
      return [];
    }

    return type.variants.flatMap((variant) =>
      variant.kind === "object" ? variant.properties : [],
    );
  }

  private getEnumMemberName(value: string | number | boolean): string {
    if (typeof value === "string") {
      const normalized = value.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) =>
        c.toUpperCase(),
      );
      return /^[0-9]/.test(normalized) ? `_${normalized}` : normalized;
    }

    return `Value${value}`;
  }

  private getPrimitiveType(
    type: "string" | "number" | "integer" | "boolean",
  ): string {
    switch (type) {
      case "string":
        return "string";

      case "number":
      case "integer":
        return "number";

      case "boolean":
        return "boolean";
    }
  }

  private getLiteral(value: string | number | boolean): string {
    return typeof value === "string" ? JSON.stringify(value) : String(value);
  }

  private getObjectType(properties: ObjectProperty[]): string {
    if (properties.length === 0) {
      return "Record<string, unknown>";
    }

    const fields = properties.map((property) => {
      const optional = property.required ? "" : "?";

      return `${this.getWireKey(property.wireName)}${optional}: ${this.getTypeName(property.type)};`;
    });

    return `{ ${fields.join(" ")} }`;
  }

  /**
   * Object keys hit the wire, so they keep wire names — bare when
   * identifier-shaped, quoted otherwise (TS property names accept any
   * string).
   */
  private getWireKey(wireName: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(wireName)
      ? wireName
      : JSON.stringify(wireName);
  }

  /**
   * Auth option names: scheme names often end in "Auth" (ApiKeyAuth);
   * stripping it yields idiomatic option keys (apiKey). Collisions
   * fall back to the full name, then a numeric suffix.
   */
  private getAuthSchemes(spec: SDKSpec): Record<string, unknown>[] {
    const used = new Set<string>();

    return spec.auth.map((scheme) => {
      const stripped = scheme.name.replace(/Auth$/i, "");
      let candidate = this.escapeKeyword(
        this.toCamelCase(stripped || scheme.name),
      );

      if (used.has(candidate)) {
        candidate = this.escapeKeyword(this.toCamelCase(scheme.name));
      }

      let suffix = 2;

      while (used.has(candidate)) {
        candidate = `${candidate}${suffix++}`;
      }

      used.add(candidate);

      return { ...scheme, configName: candidate };
    });
  }

  private isNamedEnumRef(type: TypeReference): boolean {
    return type.kind === "model" && this.isNamedEnum(type.name);
  }

  private isNamedEnum(name: string): boolean {
    return (
      this.spec?.types.find((type) => type.name === name)?.type.kind === "enum"
    );
  }

  private toSnakeCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join("_")
      .toLowerCase();
  }

  private toCamelCase(value: string): string {
    const parts = value
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
      .split(/(?=[A-Z])/);

    if (parts.length === 0) {
      return value;
    }

    return (
      parts[0]!.toLowerCase() + parts.slice(1).join("")
    );
  }

  private toPascalCase(value: string): string {
    const camel = this.toCamelCase(value);

    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  private toKebabCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "");
  }
}
