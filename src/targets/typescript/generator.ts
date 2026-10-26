import { mkdir, writeFile } from "node:fs/promises";
import * as fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEnvironment,
  createFilesystemLoader,
} from "twing";

import type { SDKSpec } from "../../canonical/types.js";
import {
  canRenderAsInterface,
  getInterfaceParents,
  getInterfaceProperties,
  toTypeScriptType,
} from "./type-mapper.js";

export async function generateTypeScript(
  spec: SDKSpec,
  outputDir: string,
): Promise<void> {
  const templatesDir = fileURLToPath(
    new URL("./templates", import.meta.url),
  );

  const loader = createFilesystemLoader(fs);
  loader.addPath(templatesDir);

  const twing = createEnvironment(loader);

  const types = spec.types.map((namedType) => {
    if (canRenderAsInterface(namedType.type)) {
        return {
        name: namedType.name,
        description: namedType.description,
        kind: "interface" as const,

        parents: getInterfaceParents(
            namedType.type,
        ),

        properties: getInterfaceProperties(
            namedType.type,
        ).map((property) => ({
            ...property,
            tsType: toTypeScriptType(
            property.type,
            ),
        })),
        };
    }

    return {
        name: namedType.name,
        description: namedType.description,
        kind: "alias" as const,
        tsType: toTypeScriptType(namedType.type),
    };
  });

  const authSchemes = spec.auth.map((auth) => ({
    ...auth,
    configName: authConfigName(auth.name),
}));

  const output = await twing.render(
    "models.twig",
    {
      types,
    },
  );

  const clientOutput = await twing.render(
    "client.twig",
    {
        baseUrl: spec.servers[0]?.url ?? "",
        authSchemes,
    }
  );

  await mkdir(outputDir, {
    recursive: true,
  });

  await writeFile(
    join(outputDir, "models.ts"),
    output,
    "utf8",
  );

  await writeFile(
    join(outputDir, "client.ts"),
    clientOutput,
    "utf8",
  );
}

function authConfigName(name: string): string {
  return name
    .replace(/Auth$/i, "")
    .replace(/^[A-Z]/, (char) =>
      char.toLowerCase(),
    );
}