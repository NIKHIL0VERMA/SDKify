import { mkdir, writeFile } from "node:fs/promises";
import * as fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { kebabCase } from "./naming.js";

import {
  createEnvironment,
  createFilesystemLoader,
} from "twing";

import type { SDKSpec } from "../../canonical/types.js";
import {
  canRenderAsInterface,
  getTypeDependencies,
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
  const clientOutput = await twing.render(
    "client.twig",
    {
        baseUrl: spec.servers[0]?.url ?? "",
        authSchemes,
    }
  );

  const modelsDir = join(outputDir, "models");

await mkdir(modelsDir, {
  recursive: true,
});

for (const namedType of spec.types) {
  const fileName = kebabCase(namedType.name);

  const dependencyNames = getTypeDependencies(
    namedType.type,
  ).filter(
    (dependency) =>
      dependency !== namedType.name,
  );

  const dependencies = dependencyNames.map(
    (name) => ({
      name,
      fileName: kebabCase(name),
    }),
  );

  if (canRenderAsInterface(namedType.type)) {
    const properties = getInterfaceProperties(
      namedType.type,
    ).map((property) => ({
      ...property,

      tsType: toTypeScriptType(
        property.type,
      ),
    }));

    const output = await twing.render(
      "model.twig",
      {
        name: namedType.name,
        description: namedType.description,

        kind: "interface",

        parents: getInterfaceParents(
          namedType.type,
        ),

        properties,
        dependencies,
      },
    );

    await writeFile(
      join(modelsDir, `${fileName}.ts`),
      output,
      "utf8",
    );

    continue;
  }

  const output = await twing.render(
    "model.twig",
    {
      name: namedType.name,
      description: namedType.description,

      kind: "alias",

      tsType: toTypeScriptType(
        namedType.type,
      ),

      dependencies,

      parents: [],
      properties: [],
    },
  );
await mkdir(outputDir, {
    recursive: true,
  });

  await writeFile(
    join(modelsDir, `${fileName}.ts`),
    output,
    "utf8",
  );
}

  
  const modelsIndex = await twing.render(
  "models-index.twig",
  {
    models: spec.types.map((namedType) => ({
      name: namedType.name,
      fileName: kebabCase(namedType.name),
    })),
  },
);

await writeFile(
  join(modelsDir, "index.ts"),
  modelsIndex,
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