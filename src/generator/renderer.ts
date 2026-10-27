import * as fs from "node:fs";
import {
  createEnvironment,
  createArrayLoader,
  createFilesystemLoader,
  createFilter,
  createFunction,
} from "twing";
import type { TwingEnvironment, TwingFilter } from "twing";
import type { SDKFilter } from "./types.js";

export class TemplateRenderer {
  private readonly environment: TwingEnvironment;
  private readonly stringEnvironments = new Map<string, TwingEnvironment>();

  constructor(templateDirectories: string[], filters: SDKFilter[] = [], functions: SDKFilter[] = []) {
    const loader = createFilesystemLoader(fs);

    for (const directory of templateDirectories) {
      loader.addPath(directory);
    }

    this.environment = createEnvironment(loader);
    this.register(this.environment, filters, functions);
  }

  render(template: string, context: Record<string, unknown>): Promise<string> {
    return this.environment.render(template, context);
  }

  renderString(template: string, context: Record<string, unknown>): Promise<string> {
    let environment = this.stringEnvironments.get(template);

    if (!environment) {
      environment = createEnvironment(createArrayLoader({ __inline__: template }));
      this.register(environment, [], []);
      this.stringEnvironments.set(template, environment);
    }

    return environment.render("__inline__", context);
  }

  private register(
    environment: TwingEnvironment,
    filters: SDKFilter[],
    functions: SDKFilter[],
  ): void {
    for (const filter of genericFilters) {
      environment.addFilter(filter);
    }

    for (const filter of filters) {
      environment.addFilter(
        createFilter(filter.name, async (_context, ...args) => filter.handler(...args), []),
      );
    }

    for (const fn of functions) {
      environment.addFunction(
        createFunction(fn.name, async (_context, ...args) => fn.handler(...args), []),
      );
    }
  }
}

const genericFilters: TwingFilter[] = [
  caseFilter("caseLower", (value) => value.toLowerCase()),
  caseFilter("caseUpper", (value) => value.toUpperCase()),
  caseFilter("caseCamel", camelCase),
  caseFilter("casePascal", (value) => {
    const camel = camelCase(value);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }),
  caseFilter("caseKebab", (value) => splitWords(value).join("-").toLowerCase()),
  caseFilter("caseSnake", (value) => splitWords(value).join("_").toLowerCase()),
  caseFilter("caseDot", (value) => splitWords(value).join(".").toLowerCase()),
  caseFilter("caseSpace", (value) => splitWords(value).join(" ").toLowerCase()),
  caseFilter("firstLine", (value) => value.split("\n")[0] ?? ""),
];

function caseFilter(
  name: string,
  handler: (value: string) => string,
): TwingFilter {
  return createFilter(name, async (_context, value) => handler(String(value ?? "")), []);
}

function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-./]+/)
    .filter(Boolean);
}

function camelCase(value: string): string {
  const words = splitWords(value);

  return words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}
