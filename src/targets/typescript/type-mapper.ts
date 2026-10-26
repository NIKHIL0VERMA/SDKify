import type { ObjectProperty, TypeReference } from "../../canonical/types.js";

export function toTypeScriptType(
  type: TypeReference,
): string {
  let result: string;

  switch (type.kind) {
    case "primitive":
      result = primitiveToTypeScript(type.type);
      break;

    case "model":
      result = type.name;
      break;

    case "array":
      result = `Array<${toTypeScriptType(type.items)}>`;
      break;

    case "object":
      result = objectToTypeScript(type.properties);
      break;

    case "unknown":
      result = "unknown";
      break;
    
    case "enum":
      result = type.values
        .map(toTypeScriptLiteral)
        .join(" | ");
      break;

    case "union":
      result = type.variants
        .map(toTypeScriptType)
        .join(" | ");
      break;
    
    case "intersection":
      result = type.variants
        .map(toTypeScriptType)
        .join(" & ");
      break;
  }

  if ("nullable" in type && type.nullable) {
    return `${result} | null`;
  }

  return result;
}

export function canRenderAsInterface(
  type: TypeReference,
): boolean {
  if (type.kind === "object") {
    return true;
  }

  if (type.kind !== "intersection") {
    return false;
  }

  return type.variants.every(
    (variant) =>
      variant.kind === "model" ||
      variant.kind === "object",
  );
}

export function getInterfaceParents(
  type: TypeReference,
): string[] {
  if (type.kind !== "intersection") {
    return [];
  }

  return type.variants
    .filter(
      (
        variant,
      ): variant is Extract<
        TypeReference,
        { kind: "model" }
      > => variant.kind === "model",
    )
    .map((variant) => variant.name);
}

export function getInterfaceProperties(
  type: TypeReference,
): ObjectProperty[] {
  if (type.kind === "object") {
    return type.properties;
  }

  if (type.kind !== "intersection") {
    return [];
  }

  return type.variants.flatMap((variant) =>
    variant.kind === "object"
      ? variant.properties
      : [],
  );
}

function primitiveToTypeScript(
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

function objectToTypeScript(
  properties: {
    name: string;
    required: boolean;
    type: TypeReference;
  }[],
): string {
  if (properties.length === 0) {
    return "Record<string, unknown>";
  }

  const fields = properties.map((property) => {
    const optional = property.required ? "" : "?";

    return `${property.name}${optional}: ${toTypeScriptType(
      property.type,
    )};`;
  });

  return `{ ${fields.join(" ")} }`;
}

function toTypeScriptLiteral(
  value: string | number | boolean,
): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}