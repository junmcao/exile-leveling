// Downloads gem icons from the Path of Exile wiki into web/public/gem-icons.
//
//   node tools/seed-gem-icons.mjs
//
// Gems without an icon on the wiki are skipped; the web app falls back to a
// coloured dot for them. Files that already exist are not downloaded again.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "web", "public", "gem-icons");

const API = "https://www.poewiki.net/api.php";
const USER_AGENT = "exile-leveling-fork/0.1 (gem icon seeding, one-off)";
const BATCH_SIZE = 50;
const CONCURRENCY = 4;

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const fileTitle = (name) =>
  `File:${name.replaceAll(" ", "_")}_inventory_icon.png`;

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function mapPool(items, limit, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

const gems = JSON.parse(
  await readFile(join(root, "common", "data", "json", "gems.json"), "utf8"),
);

const idsByName = new Map();
for (const gem of Object.values(gems)) {
  if (!idsByName.has(gem.name)) idsByName.set(gem.name, []);
  idsByName.get(gem.name).push(gem.id);
}

const names = [...idsByName.keys()];
console.log(`${Object.keys(gems).length} gems, ${names.length} unique names`);

// File title on the wiki -> download url
const urlByTitle = new Map();
for (let i = 0; i < names.length; i += BATCH_SIZE) {
  const titles = names.slice(i, i + BATCH_SIZE).map(fileTitle);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url",
    redirects: "1",
    titles: titles.join("|"),
  });
  const data = await getJson(`${API}?${params}`);

  const redirects = new Map(
    (data.query.redirects ?? []).map((x) => [x.from, x.to]),
  );
  const normalized = new Map(
    (data.query.normalized ?? []).map((x) => [x.from, x.to]),
  );
  const pages = Object.values(data.query.pages);

  for (const title of titles) {
    let resolved = normalized.get(title) ?? title;
    resolved = redirects.get(resolved) ?? resolved;

    const page = pages.find((x) => x.title === resolved);
    const url = page?.imageinfo?.[0]?.url;
    if (url) urlByTitle.set(title, url);
  }
}

await mkdir(outDir, { recursive: true });

const manifest = {};
let downloaded = 0;
let reused = 0;
const missing = [];

await mapPool(names, CONCURRENCY, async (name) => {
  const url = urlByTitle.get(fileTitle(name));
  if (!url) {
    missing.push(name);
    return;
  }

  const file = `${slug(name)}.png`;
  const path = join(outDir, file);

  if (await exists(path)) {
    reused++;
  } else {
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (response.ok) break;
    }
    if (!response.ok) {
      missing.push(name);
      return;
    }

    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    downloaded++;
  }

  for (const id of idsByName.get(name)) manifest[id] = file;
});

const sorted = Object.fromEntries(
  Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
);
await writeFile(join(outDir, "index.json"), JSON.stringify(sorted, null, 1));
await writeFile(
  join(outDir, "README.txt"),
  "Gem icons are the property of Grinding Gear Games. They were retrieved\n" +
    "from the Path of Exile Wiki (https://www.poewiki.net) by\n" +
    "tools/seed-gem-icons.mjs.\n",
);

console.log(
  `downloaded ${downloaded}, reused ${reused}, no icon for ${missing.length}`,
);
if (missing.length > 0) console.log(`missing: ${missing.sort().join(", ")}`);
