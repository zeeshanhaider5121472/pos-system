const fs = require("fs");
const path = require("path");

const SKIP_DIRS = ["node_modules", ".next", ".git", "dist", "build"];
const SKIP_FILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
const EXTENSIONS = [
  ".tsx",
  ".ts",
  ".js",
  ".jsx",
  ".css",
  ".scss",
  ".json",
  ".md",
];

let output = "";
let count = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.includes(entry.name)) walk(full);
    } else if (
      !SKIP_FILES.includes(entry.name) &&
      EXTENSIONS.includes(path.extname(entry.name))
    ) {
      output += `\n\n================ FILE: ${path.relative(".", full)} ================\n\n`;
      output += fs.readFileSync(full, "utf8");
      count++;
    }
  }
}

walk(".");
fs.writeFileSync("all-files.txt", output);
console.log(`✅ Done! Combined ${count} files into all-files.txt`);
