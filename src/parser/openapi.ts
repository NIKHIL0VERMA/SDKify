import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { validate } from "@scalar/openapi-parser";
import type { OpenAPI } from "@scalar/openapi-types";

export interface Parser<T = unknown> {
  name: string;
  parse(input: string | object): Promise<T>;
}

export class OpenAPIParser implements Parser<OpenAPI.Document> {
  name = "openapi";

  async parse(input: string | object): Promise<OpenAPI.Document> {
    let content: string;

    if (typeof input === "object") {
      content = JSON.stringify(input);
    } else if (input.includes("\n") || input.trim().startsWith("{") || input.trim().startsWith("openapi:") || input.trim().startsWith("swagger:")) {
      content = input;
    } else {
      content = await readFile(input, "utf8");
    }

    const { valid, errors } = await validate(content);

    if (!valid) {
      throw new Error(`Invalid OpenAPI document: ${JSON.stringify(errors)}`);
    }

    return parseYaml(content) as OpenAPI.Document;
  }
}

export async function parseOpenAPI(
  filePath: string,
): Promise<OpenAPI.Document> {
  return new OpenAPIParser().parse(filePath);
}
