#!/usr/bin/env node

const fs = require("node:fs");

const [input, output = `${input}.module.js`, moduleName = "mymodule"] = process.argv.slice(2);

if (!input) {
  console.error("usage: node transform.js input.js [output.js]");
  process.exit(1);
}

const source = fs.readFileSync(input, "utf8");
const names = new Set();

for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
  names.add(match[1]);
}
for (const match of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
  names.add(match[1]);
}
for (const match of source.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) {
  names.add(match[1]);
}

const properties = [...names].map((name) =>
  `  get ${name}() { return ${name}; }`
).join(",\n");

const result = `const ${moduleName} = (() => {
${source.trimEnd()}

  return {
${properties}
  };
})();
`;

fs.writeFileSync(output, result);
