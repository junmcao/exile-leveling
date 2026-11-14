import { atom } from "jotai";
import { pobAtom } from ".";
import { decodePathOfBuildingCode } from "./process";

export interface GearItem {
  slot: string;
  rarity: string;
  name: string;
  base?: string;
  sockets?: string;
  implicits: string[];
  mods: string[];
}

export interface GearSet {
  title: string;
  items: GearItem[];
}

// Slots shown, in order. Swap weapons and jewel sockets are left out.
const SLOT_ORDER = [
  "Weapon 1",
  "Weapon 2",
  "Helmet",
  "Body Armour",
  "Gloves",
  "Boots",
  "Amulet",
  "Ring 1",
  "Ring 2",
  "Ring 3",
  "Belt",
  "Flask 1",
  "Flask 2",
  "Flask 3",
  "Flask 4",
  "Flask 5",
];

// Lines between the item name and its mods that describe the item itself
const METADATA_KEY =
  /^(Unique ID|Item Level|Quality|Sockets|LevelReq|Requires|Variant|Selected Variant|Has Alt Variant|Selected Alt Variant|League|Crafted|Prefix|Suffix|Catalyst|CatalystQuality|Armour|Evasion|Energy Shield|Ward|Limited to|Radius|Talisman Tier|Cluster Jewel \w+|Source|Note):/i;
const METADATA_FLAG =
  /^(Corrupted|Mirrored|Shaper Item|Elder Item|Crusader Item|Hunter Item|Redeemer Item|Warlord Item|Fractured Item|Synthesised Item|Searing Exarch Item|Eater of Worlds Item|Scourge Item|Replica|Foil)$/i;

const TAGS = /^(\{[^}]*\})+/;

// Mods are prefixed with tags like {crafted} or {variant:1,2}, which unique
// items use to list every possible variant. Only the selected one is shown.
function modText(line: string, selectedVariant: string | undefined) {
  const tags = TAGS.exec(line)?.[0] ?? "";

  const variants = /\{variant:([\d,]+)\}/.exec(tags)?.[1];
  if (variants && selectedVariant && !variants.split(",").includes(selectedVariant))
    return null;

  return line.slice(tags.length).trim() || null;
}

export function parseItem(slot: string, text: string): GearItem | null {
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x !== "");

  const rarity = /^Rarity:\s*(\w+)/i.exec(lines[0] ?? "")?.[1]?.toUpperCase();
  if (!rarity || lines.length < 2) return null;

  let next = 1;
  const name = lines[next++];
  const hasBase = rarity === "RARE" || rarity === "UNIQUE" || rarity === "RELIC";
  const base = hasBase ? lines[next++] : undefined;

  let sockets: string | undefined;
  let selectedVariant: string | undefined;
  let implicitCount = 0;
  let sawImplicits = false;
  const implicits: string[] = [];
  const mods: string[] = [];

  for (const line of lines.slice(next)) {
    const implicitsMatch = /^Implicits:\s*(\d+)/i.exec(line);
    if (implicitsMatch) {
      implicitCount = Number(implicitsMatch[1]);
      sawImplicits = true;
      continue;
    }

    if (!sawImplicits || implicitCount === 0) {
      const socketsMatch = /^Sockets:\s*(.+)/i.exec(line);
      if (socketsMatch) sockets = socketsMatch[1];

      const variantMatch = /^Selected Variant:\s*(\d+)/i.exec(line);
      if (variantMatch) selectedVariant = variantMatch[1];

      if (METADATA_KEY.test(line) || METADATA_FLAG.test(line)) continue;
    }

    const text = modText(line, selectedVariant);
    if (text === null) continue;

    if (sawImplicits && implicits.length < implicitCount) implicits.push(text);
    else mods.push(text);
  }

  return { slot, rarity, name, base, sockets, implicits, mods };
}

export function parseGearSets(pobCode: string): GearSet[] {
  let doc;
  try {
    doc = decodePathOfBuildingCode(pobCode);
  } catch {
    return [];
  }

  const itemText = new Map<string, string>();
  for (const element of Array.from(doc.querySelectorAll("Items > Item"))) {
    const id = element.getAttribute("id");
    if (id) itemText.set(id, element.textContent ?? "");
  }

  const sets: GearSet[] = [];
  for (const setElement of Array.from(doc.getElementsByTagName("ItemSet"))) {
    const itemIdBySlot = new Map<string, string>();
    for (const slot of Array.from(setElement.getElementsByTagName("Slot"))) {
      const name = slot.getAttribute("name");
      const itemId = slot.getAttribute("itemId");
      if (name && itemId && itemId !== "0") itemIdBySlot.set(name, itemId);
    }

    const items: GearItem[] = [];
    for (const slot of SLOT_ORDER) {
      const text = itemText.get(itemIdBySlot.get(slot) ?? "");
      const item = text === undefined ? null : parseItem(slot, text);
      if (item) items.push(item);
    }

    sets.push({
      title: setElement.getAttribute("title") || "Default",
      items,
    });
  }

  return sets;
}

// Read from the saved PoB code, so builds imported earlier work without importing again
export const gearSetsSelector = atom((get) => {
  const pobCode = get(pobAtom);
  return pobCode === null ? [] : parseGearSets(pobCode);
});
