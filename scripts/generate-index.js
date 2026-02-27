// scripts/generate-index.mjs
import fs from "fs";
import path from "path";

const srcDir = path.resolve("./src");
const indexFile = path.join(srcDir, "index.mts");

let exportLines = [];

/**
 * Recursively scan a folder and collect export lines
 * @param {string} dir - current directory
 * @param {string} relativePath - relative path from srcDir
 */
function scanDir(dir, relativePath = ".") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Recurse into subdirectory
      scanDir(entryPath, path.join(relativePath, entry.name));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".mts") &&
      !entry.name.endsWith(".d.ts") &&
      entry.name !== "index.mts" &&
      entry.name !== "cmd.mts"
    ) {
      if (entry && entry.path && !entry.path.endsWith("schema")) {
        const importPath = './' + path.join(relativePath, entry.name.replace(/\.mts$/, ".mjs"));
        exportLines.push(`export * from "${importPath.replace(/\\/g, "/")}";`);
      }
    }
  }
}

// Start scanning
scanDir(srcDir);

// Write index.ts
const content = `// Auto-generated index.mts\n\n${exportLines.join("\n")}\n`;
fs.writeFileSync(indexFile, content);

console.log(`Generated index.ts with ${exportLines.length} exports.`);
