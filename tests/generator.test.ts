import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { generate } from "../src/index.js";

const deprecatedSpec = fileURLToPath(
  new URL("./fixtures/deprecated-spec.yaml", import.meta.url),
);

async function withOutput(
  prefix: string,
  run: (output: string) => Promise<void>,
): Promise<void> {
  const output = await mkdtemp(path.join(tmpdir(), prefix));

  try {
    await run(output);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}

describe("generate deprecation annotations", () => {
  it("marks deprecated TypeScript operations, models, and examples", async () => {
    await withOutput("sdkify-ts-deprecated-", async (output) => {
      await generate({
        spec: deprecatedSpec,
        output,
        language: "typescript",
      });

      const service = await readFile(
        path.join(output, "src/services/legacy.ts"),
        "utf8",
      );
      const model = await readFile(
        path.join(output, "src/models/LegacyResource.ts"),
        "utf8",
      );
      const docs = await readFile(
        path.join(output, "docs/examples/legacy/get.md"),
        "utf8",
      );

      expect(service).toContain("@deprecated");
      expect(model).toContain("@deprecated");
      expect(docs).toContain("**Deprecated:**");
    });
  });

  it("marks deprecated Python operations and models", async () => {
    await withOutput("sdkify-py-deprecated-", async (output) => {
      await generate({
        spec: deprecatedSpec,
        output,
        language: "python",
      });

      const service = await readFile(
        path.join(output, "deprecation_api/services/legacy.py"),
        "utf8",
      );
      const model = await readFile(
        path.join(output, "deprecation_api/models/legacy_resource.py"),
        "utf8",
      );
      const docs = await readFile(
        path.join(output, "docs/examples/legacy/get.md"),
        "utf8",
      );

      expect(service).toContain("Deprecated.");
      expect(model).toContain("Deprecated.");
      expect(docs).toContain("**Deprecated:**");
    });
  });
});
