import { parseOpenAPI } from "./parser/openapi.js";
import { normalizeOpenAPI } from "./canonical/normalizer.js";

const path = process.argv[2];

if (!path) {
  console.error("Usage: sdkify <openapi-file>");
  process.exit(1);
}

const document = await parseOpenAPI(path);
const spec = normalizeOpenAPI(document);

console.log(`\n${spec.name} v${spec.version}`);
console.log("=".repeat(60));

let operationCount = 0;

for (const service of spec.services) {
  console.log(`\n${service.name}`);

  for (const operation of service.operations) {
    operationCount++;

    console.log(
      `  ${operation.method.padEnd(7)} ${operation.name.padEnd(30)} ${operation.path}`,
    );
  }
}

console.log("\n" + "=".repeat(60));
console.log(`Services:   ${spec.services.length}`);
console.log(`Operations: ${operationCount}`);