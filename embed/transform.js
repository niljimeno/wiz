#!/usr/bin/env node

const fs = require("node:fs");

const [input, output = `${input}.module.js`, moduleName = "mymodule"] = process.argv.slice(2);

if (!input) {
  console.error("usage: node transform.js input.js [output.js]");
  process.exit(1);
}

const source = fs.readFileSync(input, "utf8");
const names = new Set();
const depths = [];
let depth = 0;
let quote;
let comment;
let escaped = false;

for (let index = 0; index < source.length; index++) {
  let character = source[index];
  let next = source[index + 1];
  depths[index] = comment || quote ? 1 : depth;

  if (comment == "line") {
    if (character == "\n") comment = undefined;
    continue;
  }
  if (comment == "block") {
    if (character == "*" && next == "/") {
      comment = undefined;
      index++;
    }
    continue;
  }
  if (quote) {
    if (escaped) escaped = false;
    else if (character == "\\") escaped = true;
    else if (character == quote) quote = undefined;
    continue;
  }
  if (character == "/" && next == "/") {
    comment = "line";
    index++;
  } else if (character == "/" && next == "*") {
    comment = "block";
    index++;
  } else if (["'", '"', "`"].includes(character)) {
    quote = character;
  } else if (character == "{") {
    depth++;
  } else if (character == "}") {
    depth--;
  }
}

for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
  if (depths[match.index] == 0)
    names.add(match[1]);
}
for (const match of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
  if (depths[match.index] == 0)
    names.add(match[1]);
}
for (const match of source.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) {
  if (depths[match.index] == 0)
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
