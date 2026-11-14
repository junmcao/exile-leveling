import { expect, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";

// The browser's file picker is a native dialog that tests can't click, so it is
// replaced by one that hands over a private file the tests can write to, the
// same way the game writes to Client.txt
export async function installFakeGameLog(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      writable: true,
      value: async () => {
        const root = await navigator.storage.getDirectory();
        return [await root.getFileHandle("Client.txt", { create: true })];
      },
    });
  });
}

export function areaLine(areaId: string, index = 0) {
  return `2026/01/01 12:00:00 ${index} abc [INFO Client 1] Generating level 1 area "${areaId}" with seed ${index}\r\n`;
}

export async function appendToGameLog(page: Page, text: string) {
  await page.evaluate(async (text) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle("Client.txt", { create: true });
    const size = (await handle.getFile()).size;
    const writable = await handle.createWritable({ keepExistingData: true });
    await writable.seek(size);
    await writable.write(text);
    await writable.close();
  }, text);
}

// Connects the fake game log through the app's own dialog. Lines that are
// already in the file are ignored by the app, so it waits for the first poll.
export async function connectGameLog(page: Page) {
  await page.getByRole("button", { name: /auto-progress/i }).click();
  await page.getByRole("button", { name: "Choose Client.txt" }).click();
  await expect(
    page.getByRole("button", { name: "Auto-progress on" }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
}

// "12 / 488", the position in the route
export function stepCounter(page: Page) {
  return page.getByText(/^\d+ \/ \d+$/);
}

export async function stepNumber(page: Page) {
  const text = await stepCounter(page).textContent();
  return Number(text!.split("/")[0]);
}

// A small Path of Building export with two level ranges, each with its own
// gems and gear, so the build guide can be tried without anyone's real build
export function makePobCode() {
  const gem = (id: string, name: string) =>
    `<Gem gemId="Metadata/Items/Gems/${id}" enabled="true" nameSpec="${name}" level="1" quality="0"/>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="1" className="Duelist" ascendClassName="None" bandit="None"/>
  <Skills activeSkillSet="1">
    <SkillSet id="1" title="lvl 1-11">
      <Skill enabled="true" label="">
        ${gem("SkillGemThrownWeapon", "Spectral Throw")}
        ${gem("SupportGemParallelProjectiles", "Volley Support")}
      </Skill>
    </SkillSet>
    <SkillSet id="2" title="12-17">
      <Skill enabled="true" label="">
        ${gem("SkillGemStaticStrike", "Static Strike")}
        ${gem("SupportGemRuthless", "Ruthless Support")}
      </Skill>
    </SkillSet>
  </Skills>
  <Items activeItemSet="1">
    <Item id="1">
Rarity: RARE
First Sword
Jade Chopper
Implicits: 0
+10 to Strength
    </Item>
    <Item id="2">
Rarity: RARE
Second Sword
Jade Chopper
Implicits: 0
+20 to Dexterity
    </Item>
    <ItemSet id="1" title="lvl 1-11"><Slot name="Weapon 1" itemId="1"/></ItemSet>
    <ItemSet id="2" title="12-17"><Slot name="Weapon 1" itemId="2"/></ItemSet>
  </Items>
</PathOfBuilding>`;

  return deflateSync(Buffer.from(xml))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
