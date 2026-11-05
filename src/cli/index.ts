#!/usr/bin/env node
import { parseOpenAPI } from "../parser/openapi.js";
import { normalizeOpenAPI } from "../canonical/normalizer.js";
import { SDKProject } from "../project/SDKProject.js";
import { filterSpecByTags } from "../project/filter.js";
import { Generator } from "../generator/generator.js";
import { getTarget, getTargetNames } from "../targets/index.js";
import path from "node:path";

function usage(): never {
  console.log(`SDKify — generate developer-friendly SDKs from API specifications

Usage:
  sdkify <spec> [--language <lang>] [--output <dir>] [--name <name>] [--version <version>]
               [--tag <tags>] [--exclude-tag <tags>]

Options:
  --spec, -s     Path to an OpenAPI specification (yaml/json) — also positional
  --language, -l Target language (default: all available: ${getTargetNames().join(", ")})
  --output, -o   Output directory (default: generated)
  --name         SDK name override (default: spec title)
  --version      SDK version override (default: spec version)
  --tag          Only generate operations with one of these tags (comma-separated)
  --exclude-tag  Skip operations with any of these tags (comma-separated)
  --help, -h     Show this help
`);
  process.exit(0);
}

function getFlag(args: string[], ...flags: string[]): string | undefined {
  for (const flag of flags) {
    const index = args.indexOf(flag);

    if (index >= 0 && index + 1 < args.length) {
      return args[index + 1];
    }
  }

  return undefined;
}

function getTags(
  args: string[],
  ...flags: string[]
): string[] | undefined {
  return getFlag(args, ...flags)?.split(",");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
  }

  const positional = args.filter(
    (arg, index) =>
      !arg.startsWith("--") &&
      (index === 0 || !args[index - 1]!.startsWith("--")),
  );

  const specPath = getFlag(args, "--spec", "-s") ?? positional[0];
  const language = getFlag(args, "--language", "-l");
  const output = getFlag(args, "--output", "-o") ?? "generated";
  const name = getFlag(args, "--name");
  const version = getFlag(args, "--version");
  const includeTags = getTags(args, "--tag");
  const excludeTags = getTags(args, "--exclude-tag");

  if (!specPath) {
    console.error("Error: no specification provided");
    usage();
  }

  const document = await parseOpenAPI(specPath);
  const spec = filterSpecByTags(normalizeOpenAPI(document), {
    includeTags,
    excludeTags,
  });
  const project = new SDKProject(spec);
  const languages = language ? [language] : getTargetNames();

  for (const target of languages) {
    const contract = getTarget(target);

    const generator = new Generator(
      project,
      contract,
      { name, version },
    );

    const outputDir = path.join(output, contract.getName());

    const files = await generator.generate(outputDir);

    console.log(`Generated ${contract.getName()} SDK`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
