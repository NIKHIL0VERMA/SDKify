import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { validate } from "@scalar/openapi-parser";
import type { OpenAPI } from "@scalar/openapi-types";

export async function parseOpenAPI(
  filePath: string,
): Promise<OpenAPI.Document> {
  const source = await readFile(filePath, "utf8");

  const { valid, errors } = await validate(source);

  if (!valid) {
    console.error(errors);
    throw new Error(`Invalid OpenAPI document: ${filePath}`);
  }

  const document = parse(source) as OpenAPI.Document;

  return document;
}