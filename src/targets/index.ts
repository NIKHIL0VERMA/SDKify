import { TypeScript } from "./typescript/TypeScript.js";
import { Python } from "./python/Python.js";
import type { LanguageContract } from "../generator/contract.js";

type TargetFactory = new () => LanguageContract;

/**
 * Registry of available language targets.
 * Adding a language means implementing LanguageContract and adding one entry here.
 */
const registry: Record<string, TargetFactory> = {
  typescript: TypeScript,
  ts: TypeScript,
  python: Python,
  py: Python,
};

export function getTarget(language: string): LanguageContract {
  const factory = registry[language.toLowerCase()];

  if (!factory) {
    throw new Error(
      `Unknown language "${language}". Available: ${getTargetNames().join(", ")}`,
    );
  }

  return new factory();
}

/**
 * Unique language ids that can be generated.
 *
 * Aliases (`ts`, `py`) resolve to the same contract as their full id,
 * so dedupe happens on the contract name, not the registry key.
 */
export function getTargetNames(): string[] {
  return [...new Set(Object.values(registry).map((factory) => new factory().getName()))];
}
