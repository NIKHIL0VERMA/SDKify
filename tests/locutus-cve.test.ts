import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function resolvedLocutusVersion(): string {
  const lockfilePath = fileURLToPath(
    new URL("../package-lock.json", import.meta.url),
  );
  const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
  const locutus = lockfile.packages["node_modules/locutus"];

  if (!locutus) {
    throw new Error("locutus is missing from package-lock.json");
  }

  return locutus.version;
}

describe("locutus CVE pin", () => {
  it("pins locutus to the fixed version 3.0.14 (GHSA-fp25-p6mj-qqg6, GHSA-vh9h-29pq-r5m8)", () => {
    expect(resolvedLocutusVersion()).toBe("3.0.14");
  });
});
