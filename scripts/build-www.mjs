import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "www");

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
cpSync(join(root, "src"), www, { recursive: true });
cpSync(join(root, "data"), join(www, "data"), { recursive: true });

const appJs = join(www, "app.js");
writeFileSync(appJs, readFileSync(appJs, "utf8").replace('"../data/', '"data/'));

console.log("Built www/ from src/ + data/");
