import { parseOpenAPI } from "./parser/openapi.js";
import { normalizeOpenAPI } from "./canonical/normalizer.js";
import { generateTypeScript } from "./targets/typescript/generator.js";

const path = process.argv[2];

if (!path) {
  console.error("Usage: sdkify <openapi-file>");
  process.exit(1);
}

const document = await parseOpenAPI(path);
const spec = normalizeOpenAPI(document);

await generateTypeScript(
  spec,
  "generated/typescript/src",
);

console.dir(spec.auth, {
  depth: null,
});

const names = new Set([
  "InboxEmbedCreated",
  "SetupLinkCreated",
]);

console.dir(
  spec.types.filter((type) =>
    names.has(type.name),
  ),
  {
    depth: null,
  },
  
);

const customers = spec.services.find(
  (service) => service.name === "Customers",
);

console.dir(customers, {
  depth: null,
});