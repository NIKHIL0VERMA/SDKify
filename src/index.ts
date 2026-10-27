export * from "./parser/index.js";
export * from "./canonical/index.js";
export * from "./project/index.js";
export * from "./generator/index.js";
export * from "./targets/index.js";

import { parseOpenAPI } from "./parser/openapi.js";
import { normalizeOpenAPI } from "./canonical/normalizer.js";
import { SDKProject } from "./project/SDKProject.js";
import { getTarget, getTargetNames } from "./targets/index.js";
import { Generator, type SDKMetadata } from "./generator/generator.js";
import path from "node:path";

export async function generate(options: {
  spec: string;
  output: string;
  language?: string;
  metadata?: SDKMetadata;
}): Promise<string[]> {
  const document = await parseOpenAPI(options.spec);
  const spec = normalizeOpenAPI(document);
  const project = new SDKProject(spec);
  const languages = options.language
    ? [options.language]
    : getTargetNames();

  const written: string[] = [];

  for (const language of languages) {
    const contract = getTarget(language);
    const generator = new Generator(project, contract, options.metadata);
    const outputDir =
      options.language === undefined
        ? path.join(options.output, contract.getName())
        : options.output;

    written.push(...(await generator.generate(outputDir)));
  }

  return written;
}
