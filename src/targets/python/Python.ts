import type {
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
 * One flattened multipart request field; `name` is the Python
 * keyword-argument identifier, `wireName` the key appended to the
 * multipart payload.
 */
interface PreparedPythonField {
  name: string;
  wireName: string;
  required: boolean;
  description?: string;
  pyType: string;

  
  encode?: string;

  isFile: boolean;
  isFileArray: boolean;
  example: string;
}

/**
 * One keyword-argument parameter, mapped to Python syntax.
 */
interface PreparedPythonParam {
  name: string;
  wireName: string;
  required: boolean;
  description?: string;
  pyType: string;

  
  isEnum: boolean;
}

/**
 * Property of a synthesized TypedDict or pydantic field.
 */
interface PreparedPythonProperty {
  name: string;
  pyType: string;
  required: boolean;
  description?: string;

  
  hasDefault?: boolean;

  
  default?: string;

  
  hasAlias?: boolean;

  
  alias?: string;
}

/**
 * A TypedDict class definition (main, synthesized nested, or request/response body).
 */
interface PreparedPythonTypeDef {
  name: string;

  /**
   * Base class name when required and optional properties must be
   * split across a Required pair.
   */
  baseName?: string;

  description?: string;

  
  parents?: string[];

  required: PreparedPythonProperty[];
  optional: PreparedPythonProperty[];
}


interface PreparedPythonImport {
  name: string;
  fileName: string;
}

/**
 * Contract for the Python target.
 *
 * Maps canonical types to pydantic models, Literal unions, and
 * `str, Enum` classes; operations to keyword-argument methods over an
 * httpx client; and file payloads to an InputFile utility.
 */
export class Python extends LanguageContract {
  private spec?: SDKSpec;

  getName(): string {
    return "python";
  }

  getFiles(): FileDefinition[] {
    const pkg = "{{ sdk.name | caseSnake }}";

    return [
      {
        scope: "default",
        template: "pyproject.toml.twig",
        destination: "pyproject.toml",
      },
      {
        scope: "default",
        template: "client.twig",
        destination: `${pkg}/client.py`,
      },
      {
        scope: "default",
        template: "index.twig",
        destination: `${pkg}/__init__.py`,
      },
      {
        scope: "default",
        template: "input-file.twig",
        destination: `${pkg}/input_file.py`,
      },
      {
        scope: "default",
        template: "models-init.twig",
        destination: `${pkg}/models/__init__.py`,
      },
      {
        scope: "default",
        template: "services-init.twig",
        destination: `${pkg}/services/__init__.py`,
      },
      {
        scope: "copy",
        template: "py.typed",
        destination: `${pkg}/py.typed`,
      },
      {
        scope: "service",
        template: "service.twig",
        destination: `${pkg}/services/{{ service.name | caseSnake }}.py`,
      },
      {
        scope: "model",
        template: "model.pydantic.twig",
        destination: `${pkg}/models/{{ model.name | caseSnake }}.py`,
      },
      {
        scope: "enum",
        template: "enum.twig",
        destination: `${pkg}/models/{{ enum.name | caseSnake }}.py`,
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
      "False", "None", "True", "and", "as", "assert", "async", "await",
      "break", "class", "continue", "def", "del", "elif", "else",
      "except", "finally", "for", "from", "global", "if", "import",
      "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
      "return", "try", "while", "with", "yield",
    ];
  }

  /**
   * Python reserves collisions by appending an underscore (idiomatic
   * "delete_" style) instead of the generic x-prefix.
   */
  escapeKeyword(value: string): string {
    if (this.getKeywords().includes(value)) {
      return `${value}_`;
    }

    return value;
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
        result = "InputFile";
        break;

      case "array":
        result = `list[${this.getTypeName(type.items)}]`;
        break;

      case "object":
        result = "dict[str, object]";
        break;

      case "enum":
        result = type.values
          .map((value) => this.getLiteral(value))
          .join(", ");
        result = `Literal[${result}]`;
        break;

      case "union":
        result = type.variants
          .map((variant) => this.getTypeName(variant))
          .join(" | ");
        break;

      case "intersection":
        
        
        result = this.getTypeName(type.variants[0]!);
        break;

      case "unknown":
        result = "object";
        break;
    }

    if ("nullable" in type && type.nullable) {
      return `${result} | None`;
    }

    return result;
  }

  prepareSdk(spec: SDKSpec): Record<string, unknown> {
    this.spec = spec;
    const authSchemes = this.getAuthSchemes(spec);

    return {
      baseUrl: spec.servers[0]?.url ?? "https://example.com",
      authSchemes,
      dependenciesLine: 'dependencies = ["httpx>=0.27", "pydantic>=2.9"]',
      docsSetupLines: [
        "client = Client(",
        ...authSchemes.map(
          (scheme) =>
            `    ${scheme.configName}="YOUR_${String(scheme.configName).toUpperCase()}",`,
        ),
        ")",
      ],
      models: spec.types
        .filter((type) => type.type.kind !== "enum")
        .map((type) => ({
          name: type.name,
          fileName: this.toSnakeCase(type.name),
        })),
      enums: spec.types
        .filter((type) => type.type.kind === "enum")
        .map((type) => ({
          name: type.name,
          fileName: this.toSnakeCase(type.name),
        })),
      sdkServices: spec.services.map((service) => ({
        name: service.name,
        className: this.serviceClassName(service.name),
        instanceName: this.escapeKeyword(this.toSnakeCase(service.name)),
        fileName: this.toSnakeCase(service.name),
      })),
    };
  }

  /**
   * Service class name, suffixed with "Service" when it would collide
   * with a model of the same name.
   */
  private serviceClassName(name: string): string {
    const className = this.toPascalCase(name);

    if (this.spec?.types.some((type) => type.name === className)) {
      return `${className}Service`;
    }

    return className;
  }

  prepareService(
    service: Service,
    methods: PreparedOperation[],
    dependencies: string[],
  ): Record<string, unknown> {
    
    const names = new Set(this.spec?.types.map((type) => type.name) ?? []);
    const synthesized: PreparedPythonTypeDef[] = [];

    const preparedMethods: Record<string, unknown>[] = methods.map((method) =>
      this.prepareMethodData(method, service, names, synthesized),
    );

    const serialized = JSON.stringify({ preparedMethods, synthesized });
    const typingImports = ["Literal", "TypedDict"].filter((name) => {
      if (name === "TypedDict") {
        return synthesized.length > 0;
      }

      return serialized.includes("Literal[");
    });

    
    
    const pydanticModelImports = new Map<string, string>();

    for (const data of preparedMethods) {
      for (const entry of (data.pydanticModelImports ?? []) as {
        name: string;
        fileName: string;
      }[]) {
        pydanticModelImports.set(entry.name, entry.fileName);
      }
    }

    return {
      name: service.name,
      className: this.serviceClassName(service.name),
      description: service.description,
      methods: preparedMethods,
      synthesized,
      typingImports,
      pydanticModelImports: [...pydanticModelImports.entries()].map(
        ([name, fileName]) => ({ name, fileName }),
      ),
      ...this.getImports(
        dependencies.filter((name) => !pydanticModelImports.has(name)),
        preparedMethods,
      ),
    };
  }

  /**
   * Splits referenced types into runtime enum imports and
   * type-checking-guarded model imports, and detects file usage.
   */
  private getImports(
    dependencies: string[],
    methods: Record<string, unknown>[],
  ): Record<string, unknown> {
    const enums: PreparedPythonImport[] = [];
    const models: PreparedPythonImport[] = [];

    for (const name of dependencies) {
      const entry: PreparedPythonImport = {
        name,
        fileName: this.toSnakeCase(name),
      };

      if (this.isNamedEnum(name)) {
        enums.push(entry);
      } else {
        models.push(entry);
      }
    }

    return {
      enumImports: enums,
      modelImports: models,
      fileImport: methods.some(
        (method) => method.isFileUsed === true,
      ),
    };
  }

  prepareMethod(
    service: Service,
    method: PreparedOperation,
  ): Record<string, unknown> {
    
    
    const names = new Set(this.spec?.types.map((type) => type.name) ?? []);
    const synthesized: PreparedPythonTypeDef[] = [];

    return { method: this.prepareMethodData(method, service, names, synthesized) };
  }

  private prepareMethodData(
    method: PreparedOperation,
    service: Service,
    names: Set<string>,
    synthesized: PreparedPythonTypeDef[],
  ): Record<string, unknown> {
    const map = new Map<string, string>();

    for (const parameter of method.parameters.path) {
      map.set(parameter.wireName, this.escapeKeyword(this.toSnakeCase(parameter.wireName)));
    }

    const parameter = (p: Parameter): PreparedPythonParam => ({
      name: this.escapeKeyword(this.toSnakeCase(p.wireName)),
      wireName: p.wireName,
      required: p.required,
      description: p.description,
      pyType: this.getTypeName(p.type),
      isEnum: this.isNamedEnumRef(p.type),
    });

    const path = method.parameters.path.map(parameter);
    const query = method.parameters.query.map(parameter);
    const header = method.parameters.header.map(parameter);

    const hasBody = method.requestBody !== undefined;
    const isMultipart =
      hasBody && method.requestBody!.contentType === "multipart/form-data";
    const fields = isMultipart
      ? this.getMultipartFields(method.requestBody!.type)
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
      (_, wireName: string) => `{${map.get(wireName) ?? this.toSnakeCase(wireName)}}`,
    );

    
    
    
    const exampleParams: { name: string; required: boolean; example: string }[] = [
      ...[
        ...method.parameters.path,
        ...method.parameters.query,
        ...method.parameters.header,
      ].map((p) => ({
        name: this.escapeKeyword(this.toSnakeCase(p.wireName)),
        required: p.required,
        example: this.getExampleValue(
          p.type,
          p.example,
          p.default,
          p.wireName,
          new Set(),
          4,
        ),
      })),
      ...fields.map((f) => ({ name: f.name, required: f.required, example: f.example })),
    ].sort((a, b) => Number(b.required) - Number(a.required));

    const enumImports = this.collectEnumImports([
      ...method.parameters.path,
      ...method.parameters.query,
      ...method.parameters.header,
    ]);

    const isFileUsed = this.containsFile(method.requestBody?.type) ||
      [...method.parameters.path, ...method.parameters.query, ...method.parameters.header]
        .some((p) => this.containsFile(p.type));

    
    
    const pydanticModelImports = new Map<string, string>();

    const data: Record<string, unknown> = {
      name: this.escapeKeyword(this.toSnakeCase(method.name)),
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
      serviceInstance: this.escapeKeyword(this.toSnakeCase(service.name)),
      exampleParams,
      isFileUsed,
    };

    if (hasBody) {
      this.mergeEnumImports(method.requestBody!.type, enumImports);
      data.isFileUsed = isFileUsed || this.containsFile(method.requestBody!.type);
    }

    if (method.response?.type) {
      this.mergeEnumImports(method.response.type, enumImports);
    }

    if (method.response?.type) {
      const parse = this.getPydanticResponseParse(
        method.response.type,
        pydanticModelImports,
      );

      if (parse) {
        data.responseParse = parse;
      }
    }

    data.pydanticModelImports = [...pydanticModelImports.entries()].map(
      ([name, fileName]) => ({ name, fileName }),
    );

    data.requestHead =
      data.responseParse !== undefined
        ? "data = self._client.request("
        : "return self._client.request(";

    data.enumImports = [...enumImports.values()];

    let bodyModelName: string | undefined;
    let docsBuildupLines: string[] = [];

    if (isMultipart) {
      data.fields = fields;
    } else if (hasBody) {
      const bodyType = method.requestBody!.type;
      let pyType: string;
      let example: string;

      if (bodyType.kind === "object") {
        pyType = this.synthObject(
          bodyType,
          `${this.toPascalCase(method.name)}Body`,
          synthesized,
          names,
        );

        example = this.getExampleValue(bodyType, method.requestBody!.example, undefined, "body", new Set(), 4);
      } else if (bodyType.kind === "model" && !this.isNamedEnumRef(bodyType)) {
        if (this.isPydanticModel(bodyType.name)) {
          pyType = bodyType.name;
          bodyModelName = bodyType.name;
          example = "body";

          docsBuildupLines = [
            `body = ${this.getConstructorExample(
              bodyType.name,
              method.requestBody!.example as Record<string, unknown> | undefined,
              new Set(),
              0,
            )}`,
            "",
          ];

          
          
          data.bodyEncode = this.getPydanticBodyEncode(bodyType.name);
          pydanticModelImports.set(bodyType.name, this.toSnakeCase(bodyType.name));
        } else {
          pyType = this.getTypeName(bodyType);

          example = this.getExampleValue(bodyType, method.requestBody!.example, undefined, "body", new Set(), 4);
        }
      } else {
        pyType = this.getTypeName(bodyType);

        example = this.getExampleValue(bodyType, method.requestBody!.example, undefined, "body", new Set(), 4);
      }

      data.body = {
        pyType,
        required: bodyRequired,
        contentType: method.requestBody!.contentType,
      };
      exampleParams.push({ name: "body", required: bodyRequired, example });
    }

    data.docsBuildupLines = docsBuildupLines;

    
    
    const usageLines = [
      ...exampleParams.map((entry) => entry.example),
      ...docsBuildupLines,
    ];
    const usedEnumNames = [...enumImports.values()]
      .map((entry) => entry.name)
      .filter((name) => usageLines.some((line) => line.includes(`${name}.`)));
    const importNames = ["Client", ...usedEnumNames];

    if (data.isFileUsed) {
      importNames.push("InputFile");
    }

    if (bodyModelName) {
      importNames.push(bodyModelName);
    }

    data.docsImportNames = importNames;

    if (method.response?.type) {
      if (method.response.type.kind === "object") {
        data.response = this.synthObject(
          method.response.type,
          `${this.toPascalCase(method.name)}Response`,
          synthesized,
          names,
        );
      } else {
        data.response = this.getTypeName(method.response.type);
      }
    }

    return data;
  }

  /**
   * Multipart request bodies become flat file/value fields. `format:
   * binary` fields map to InputFile; other fields are passed as data
   * parts the client encodes.
   */
  private getMultipartFields(type: TypeReference): PreparedPythonField[] {
    if (type.kind === "file") {
      return [
        {
          name: "file",
          wireName: "file",
          required: true,
          pyType: "InputFile",
          isFile: true,
          isFileArray: false,
          example: 'InputFile.from_path("./example.pdf")',
        },
      ];
    }

    if (type.kind !== "object") {
      return [];
    }

    return type.properties.map((property) => {
      const name = this.escapeKeyword(this.toSnakeCase(property.wireName));
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
          pyType: "InputFile",
          isFile: true,
          isFileArray: false,
          example: 'InputFile.from_path("./example.pdf")',
        };
      }

      if (fileArray) {
        return {
          ...base,
          pyType: "list[InputFile]",
          isFile: true,
          isFileArray: true,
          example: '[InputFile.from_path("./example.pdf")]',
        };
      }

      return {
        ...base,
        pyType: this.getTypeName(property.type),
        isFile: false,
        isFileArray: false,
        encode:
          property.type.kind === "model" &&
          !this.isNamedEnumRef(property.type) &&
          this.isPydanticModel(property.type.name)
            ? `${property.type.name}.model_validate(${name}).model_dump(mode="json", exclude_unset=True, by_alias=True)`
            : undefined,
        example: this.getExampleValue(
          property.type,
          property.example,
          property.default,
          property.wireName,
          new Set(),
          4,
        ),
      };
    });
  }

  /**
   * Whether any file type appears within a type.
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
   * Synthesizes a named TypedDict for an anonymous object schema and
   * recursively synthesizes its nested objects. Returns the synthesized
   * class name; definitions accumulate in `synthesized` for the file
   * template to render.
   */
  private synthObject(
    type: Extract<TypeReference, { kind: "object" }>,
    baseName: string,
    synthesized: PreparedPythonTypeDef[],
    names: Set<string>,
  ): string {
    let name = baseName;
    let counter = 2;

    while (names.has(name)) {
      name = `${baseName}${counter++}`;
    }
    names.add(name);

    const required: PreparedPythonProperty[] = [];
    const optional: PreparedPythonProperty[] = [];

    for (const property of type.properties) {
      const entry: PreparedPythonProperty = {
        name: this.escapeKeyword(this.toSnakeCase(property.wireName)),
        pyType:
          property.type.kind === "object"
            ? this.synthObject(
                property.type,
                `${name}${this.toPascalCase(property.wireName)}`,
                synthesized,
                names,
              )
            : this.getTypeName(property.type),
        required: property.required,
        description: property.description,
      };

      if (property.required) {
        required.push(entry);
      } else {
        optional.push(entry);
      }
    }

    synthesized.push({
      name,
      baseName:
        required.length > 0 && optional.length > 0
          ? this.splitBaseName(name, names)
          : undefined,
      required,
      optional,
    });

    return name;
  }

  /**
   * When a definition mixes required and optional properties it needs
   * a Required base class; registers a collision-free base name.
   */
  private splitBaseName(name: string, names: Set<string>): string | undefined {
    let candidate = `${name}Required`;
    let counter = 2;

    while (names.has(candidate)) {
      candidate = `${name}Required${counter++}`;
    }

    return candidate;
  }

  /**
   * Python code literal for a docs example value, preferring
   * spec-declared example over default over a synthesized placeholder.
   * Non-empty dicts print multiline at `indent` (4 spaces per level);
   * named enums render as member references (Status.DRAFT).
   */
  private getExampleValue(
    type: TypeReference,
    example: unknown,
    def: unknown,
    placeholder: string,
    seen: Set<string> = new Set(),
    indent = 0,
  ): string {
    if (typeof example !== "undefined") {
      return this.getCodeLiteral(example, indent);
    }

    if (typeof def !== "undefined") {
      return this.getCodeLiteral(def, indent);
    }

    switch (type.kind) {
      case "file":
        return 'InputFile.from_path("./example.pdf")';

      case "model":
        if (this.isNamedEnumRef(type)) {
          const enumType = this.spec?.types.find(
            (named) => named.name === type.name,
          );
          const first =
            enumType && enumType.type.kind === "enum"
              ? enumType.type.values[0]
              : undefined;

          return `${type.name}.${this.getEnumMemberName(first ?? "value")}`;
        }

        return this.getModelExample(type.name, seen, indent);

      case "array":
        return this.wrapArray(
          [
            this.getExampleValue(
              type.items,
              undefined,
              undefined,
              placeholder,
              seen,
              indent + 4,
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
          return "True";
        }

        return "1";

      case "object":
        return this.getObjectExample(type.properties, seen, indent);

      case "union":
      case "intersection": {
        const variant = type.variants.find(
          (candidate) => candidate.kind !== "unknown",
        );

        return variant
          ? this.getExampleValue(variant, undefined, undefined, placeholder, seen, indent)
          : "None";
      }

      case "unknown":
        return JSON.stringify(placeholder);
    }
  }

  /**
   * Docs example dict literal for object properties; keys are wire
   * names so the payload serializes to the API unchanged.
   */
  private getObjectExample(
    properties: ObjectProperty[],
    seen: Set<string> = new Set(),
    indent = 0,
  ): string {
    if (properties.length === 0) {
      return "{}";
    }

    const pad = " ".repeat(indent + 4);
    const lines = properties.map(
      (property) =>
        `${pad}${JSON.stringify(property.wireName)}: ${this.getExampleValue(
          property.type,
          property.example,
          property.default,
          property.wireName,
          seen,
          indent + 4,
        )},`,
    );

    return `{\n${lines.join("\n")}\n${" ".repeat(indent)}}`;
  }

  /**
   * YAML/JSON example values rendered as Python literals; non-empty
   * dicts print multiline at `indent`.
   */
  private getCodeLiteral(value: unknown, indent = 0): string {
    if (value === null) {
      return "None";
    }

    if (typeof value === "string") {
      return JSON.stringify(value);
    }

    if (typeof value === "number") {
      return String(value);
    }

    
    if (typeof value === "boolean") {
      return value ? "True" : "False";
    }

    if (Array.isArray(value)) {
      return this.wrapArray(
        value.map((item) => this.getCodeLiteral(item, indent + 4)),
        indent,
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);

      if (entries.length === 0) {
        return "{}";
      }

      const pad = " ".repeat(indent + 4);
      const lines = entries.map(
        ([key, item]) =>
          `${pad}${JSON.stringify(key)}: ${this.getCodeLiteral(item, indent + 4)},`,
      );

      return `{\n${lines.join("\n")}\n${" ".repeat(indent)}}`;
    }

    return JSON.stringify(value);
  }

  /**
   * Arrays render inline for scalar items and multiline when any item
   * is a multiline dict literal.
   */
  private wrapArray(items: string[], indent: number): string {
    if (items.length === 0) {
      return "[]";
    }

    if (items.every((item) => !item.includes("\n"))) {
      return `[${items.join(", ")}]`;
    }

    const pad = " ".repeat(indent + 4);

    return `[\n${items.map((item) => `${pad}${item},`).join("\n")}\n${" ".repeat(indent)}]`;
  }

  /**
   * Docs example dict literal for a named model, with cycle protection.
   */
  private getModelExample(
    name: string,
    seen: Set<string>,
    indent = 0,
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
      return this.getObjectExample(model.type.properties, seen, indent);
    }

    if (model.type.kind === "intersection") {
      const properties = model.type.variants.flatMap((variant) =>
        variant.kind === "object" ? variant.properties : [],
      );

      return this.getObjectExample(properties, seen, indent);
    }

    return this.getExampleValue(
      model.type,
      undefined,
      undefined,
      name,
      seen,
      indent,
    );
  }

  /**
   * Named enum references used by a method, keyed by type name.
   */
  private collectEnumImports(
    parameters: Parameter[],
    imports: Map<string, PreparedPythonImport> = new Map(),
  ): Map<string, PreparedPythonImport> {
    for (const parameter of parameters) {
      this.mergeEnumImports(parameter.type, imports);
    }

    return imports;
  }

  private mergeEnumImports(
    type: TypeReference,
    imports: Map<string, PreparedPythonImport>,
    seen: Set<string> = new Set(),
  ): void {
    switch (type.kind) {
      case "model":
        if (seen.has(type.name)) {
          return;
        }
        seen.add(type.name);

        if (this.isNamedEnumRef(type)) {
          if (!imports.has(type.name)) {
            imports.set(type.name, {
              name: type.name,
              fileName: this.toSnakeCase(type.name),
            });
          }

          return;
        }

        
        const model = this.spec?.types.find((named) => named.name === type.name);

        if (model) {
          this.mergeEnumImports(model.type, imports, seen);
        }

        return;

      case "array":
        this.mergeEnumImports(type.items, imports, seen);
        return;

      case "object":
        for (const property of type.properties) {
          this.mergeEnumImports(property.type, imports, seen);
        }
        return;

      case "union":
      case "intersection":
        for (const variant of type.variants) {
          this.mergeEnumImports(variant, imports, seen);
        }
        return;

      default:
        return;
    }
  }

  /**
   * Whether a model reference points at a top-level enum schema.
   */
  private isNamedEnumRef(type: TypeReference): boolean {
    return type.kind === "model" && this.isNamedEnum(type.name);
  }

  /**
   * Auth option names: scheme names often end in "Auth" (ApiKeyAuth);
   * stripping it yields idiomatic option keys (api_key). Collisions
   * fall back to the full name, then a numeric suffix.
   */
  private getAuthSchemes(spec: SDKSpec): Record<string, unknown>[] {
    const used = new Set<string>();

    return spec.auth.map((scheme) => {
      const stripped = scheme.name.replace(/Auth$/i, "");
      let candidate = this.escapeKeyword(
        this.toSnakeCase(stripped || scheme.name),
      );

      if (used.has(candidate)) {
        candidate = this.escapeKeyword(this.toSnakeCase(scheme.name));
      }

      let suffix = 2;

      while (used.has(candidate)) {
        candidate = `${candidate}${suffix++}`;
      }

      used.add(candidate);

      return { ...scheme, configName: candidate };
    });
  }

  private isNamedEnum(name: string): boolean {
    const model = this.spec?.types.find((type) => type.name === name);

    return model?.type.kind === "enum";
  }

  /**
   * Whether a named model renders as a pydantic class (object or
   * intersection backing) rather than a plain type alias. Alias-only
   * validation expressions would crash at runtime, so serde helpers
   * skip them.
   */
  private isPydanticModel(name: string): boolean {
    const model = this.spec?.types.find((type) => type.name === name);

    return (
      model?.type.kind === "object" || model?.type.kind === "intersection"
    );
  }

  /**
   * One pydantic model field. Field names are snake_case; a wire key
   * that differs from its field name becomes a Field alias, so
   * request dumps emit wire keys and validation accepts them.
   */
  private getPydanticProperty(property: ObjectProperty): PreparedPythonProperty {
    let name = this.escapeKeyword(this.toSnakeCase(property.wireName));

    
    if (!/^[A-Za-z_]/.test(name)) {
      name = `_${name}`;
    }

    const pyType = this.getTypeName(property.type);
    let defaultLiteral =
      typeof property.default !== "undefined"
        ? this.getCodeLiteral(property.default, 0)
        : undefined;

    
    if (
      typeof defaultLiteral !== "undefined" &&
      property.type.kind === "model" &&
      this.isNamedEnumRef(property.type)
    ) {
      defaultLiteral = `${property.type.name}.${this.getEnumMemberName(
        property.default as string | number | boolean,
      )}`;
    }

    return {
      name,
      pyType,
      required: property.required,
      description: property.description,
      
      
      hasDefault: defaultLiteral !== undefined,
      default: defaultLiteral ?? "None",
      hasAlias: property.wireName !== name,
      alias: property.wireName === name ? "" : JSON.stringify(property.wireName),
    };
  }

  /**
   * Pydantic response validation expression — `Task.model_validate(data)`
   * for named models, list comprehension for model lists; undefined
   * otherwise.
   */
  private getPydanticResponseParse(
    type: TypeReference,
    imports: Map<string, string>,
  ): string | undefined {
    const isModel = (candidate: TypeReference): candidate is Extract<
      TypeReference,
      { kind: "model" }
    > =>
      candidate.kind === "model" &&
      !this.isNamedEnumRef(candidate) &&
      this.isPydanticModel(candidate.name);

    if (isModel(type)) {
      imports.set(type.name, this.toSnakeCase(type.name));

      return `${type.name}.model_validate(data)`;
    }

    if (type.kind === "array" && isModel(type.items)) {
      imports.set(type.items.name, this.toSnakeCase(type.items.name));

      return `[${type.items.name}.model_validate(item) for item in data]`;
    }

    return undefined;
  }

  /**
   * Pydantic-style docs example: a model constructor call built from
   * the spec's properties, preferring operation example data where
   * present. Nested named models recurse; inline objects render as
   * dict literals.
   */
  private getConstructorExample(
    modelName: string,
    data: Record<string, unknown> | undefined,
    seen: Set<string>,
    indent = 0,
  ): string {
    if (seen.has(modelName)) {
      return "{}";
    }

    const model = this.spec?.types.find((type) => type.name === modelName);
    seen.add(modelName);

    const properties =
      model?.type.kind === "object"
        ? model.type.properties
        : model?.type.kind === "intersection"
          ? model.type.variants.flatMap((variant) =>
              variant.kind === "object" ? variant.properties : [],
            )
          : [];

    const args: string[] = [];

    for (const property of properties) {
      const fieldName = this.escapeKeyword(this.toSnakeCase(property.wireName));

      
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fieldName)) {
        continue;
      }

      const value =
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        property.wireName in data
          ? this.getCodeLiteral(data[property.wireName], indent + 4)
          : this.getExampleValue(
              property.type,
              property.example,
              property.default,
              property.wireName,
              seen,
              indent + 4,
            );

      args.push(`${fieldName}=${value}`);
    }

    if (args.length === 0) {
      return `${modelName}()`;
    }

    const pad = " ".repeat(indent + 4);

    return `${modelName}(\n${args
      .map((arg) => `${pad}${arg},`)
      .join("\n")}\n${" ".repeat(indent)})`;
  }

  /**
   * Pydantic serialization expression for a request body value:
   * validate (accepts models and dicts), then dump to wire keys.
   */
  private getPydanticBodyEncode(modelName: string): string {
    return `${modelName}.model_validate(body).model_dump(mode="json", exclude_unset=True, by_alias=True)`;
  }

  prepareModel(
    model: NamedType,
    dependencies: string[],
  ): Record<string, unknown> {
    const { type } = model;

    if (type.kind === "object" || type.kind === "intersection") {
      const parents =
        type.kind === "intersection"
          ? type.variants
              .filter((variant) => variant.kind === "model")
              .map((variant) => variant.name)
          : [];

      const properties =
        type.kind === "object"
          ? type.properties
          : type.variants.flatMap((variant) =>
              variant.kind === "object" ? variant.properties : [],
            );

      
      const fields = properties.map((property) =>
        this.getPydanticProperty(property),
      );

      const serialized = JSON.stringify(fields);
      const typingImports = serialized.includes("Literal[")
        ? ["Literal"]
        : [];

      return {
        name: model.name,
        description: model.description,
        kind: "pydantic",
        parents,
        fields,
        fieldImport: fields.some((field) => field.hasAlias),
        typingImports,
        ...this.getModelImports(dependencies),
      };
    }

    
    const pyType = this.getTypeName(type);

    return {
      name: model.name,
      description: model.description,
      kind: "alias",
      pyType,
      descriptionLines:
        typeof model.description === "string"
          ? model.description.split("\n")
          : undefined,
      typingImports: pyType.includes("Literal[") ? ["Literal"] : [],
      ...this.getModelImports(dependencies),
    };
  }

  /**
   * Imports for a model file: enums at runtime, models under
   * TYPE_CHECKING (annotation-only), InputFile when file-typed
   * properties exist.
   */
  private getModelImports(dependencies: string[]): Record<string, unknown> {
    const enums: PreparedPythonImport[] = [];
    const models: PreparedPythonImport[] = [];
    let fileImport = false;

    for (const name of dependencies) {
      if (name === "InputFile") {
        fileImport = true;
        continue;
      }

      const entry: PreparedPythonImport = {
        name,
        fileName: this.toSnakeCase(name),
      };

      if (this.isNamedEnum(name)) {
        enums.push(entry);
      } else {
        models.push(entry);
      }
    }

    return {
      enumImports: enums,
      modelImports: models,
      fileImport,
    };
  }

  prepareEnum(enumType: NamedType): Record<string, unknown> {
    const values =
      enumType.type.kind === "enum" ? enumType.type.values : [];

    return {
      name: enumType.name,
      description: enumType.description,
      allStrings: values.every((value) => typeof value === "string"),
      values: values.map((value) => ({
        name: this.getEnumMemberName(value),
        literal: this.getLiteral(value),
      })),
    };
  }

  /**
   * Enum member names: SCREAMING_SNAKE, digits prefixed.
   */
  private getEnumMemberName(value: string | number | boolean): string {
    const name =
      typeof value === "string"
        ? this.toSnakeCase(value).toUpperCase()
        : `VALUE_${String(value).toUpperCase()}`;

    return /^[0-9]/.test(name) ? `_${name}` : name;
  }

  private getPrimitiveType(
    type: "string" | "number" | "integer" | "boolean",
  ): string {
    switch (type) {
      case "string":
        return "str";

      case "number":
        return "float";

      case "integer":
        return "int";

      case "boolean":
        return "bool";
    }
  }

  private getLiteral(value: string | number | boolean): string {
    if (typeof value === "string") {
      return JSON.stringify(value);
    }

    if (typeof value === "boolean") {
      return value ? "True" : "False";
    }

    return String(value);
  }

  /**
   * Splits camelCase, kebab-case, snake_case, and spaced strings into
   * words — mirrors the shared renderer's case filters so prepared
   * filenames agree with destination filters.
   */
  private splitWords(value: string): string[] {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .split(/[\s_\-./]+/)
      .filter(Boolean);
  }

  private toSnakeCase(value: string): string {
    return this.splitWords(value).join("_").toLowerCase();
  }

  private toPascalCase(value: string): string {
    return this.splitWords(value)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }
}
