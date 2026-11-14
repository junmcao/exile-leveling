import { expect, test } from "@playwright/test";
import {
  appendToGameLog,
  areaLine,
  connectGameLog,
  installFakeGameLog,
  makePobCode,
  stepCounter,
  stepNumber,
} from "./helpers";

test.describe("focus page", () => {
  test("starts at the first step, and Done and Back move through the route", async ({
    page,
  }) => {
    await page.goto("./");

    await expect(page.getByText("Find and kill")).toBeVisible();
    await expect(stepCounter(page)).toHaveText(/^1 \/ \d+$/);

    await page.getByRole("button", { name: "Done" }).click();
    await expect(stepCounter(page)).toHaveText(/^2 \/ \d+$/);

    await page.getByRole("button", { name: "Previous step" }).click();
    await expect(stepCounter(page)).toHaveText(/^1 \/ \d+$/);
  });

  test("the keyboard moves through the route", async ({ page }) => {
    await page.goto("./");
    await expect(stepCounter(page)).toHaveText(/^1 \/ \d+$/);

    await page.keyboard.press("ArrowRight");
    await expect(stepCounter(page)).toHaveText(/^2 \/ \d+$/);

    await page.keyboard.press("ArrowLeft");
    await expect(stepCounter(page)).toHaveText(/^1 \/ \d+$/);
  });
});

test.describe("route page", () => {
  test("lists the steps by act", async ({ page }) => {
    await page.goto("#/route");

    await expect(
      page.getByRole("button", { name: "Act 1", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Find and kill").first()).toBeVisible();
    await expect(page.getByText("Lioneye's Watch").first()).toBeVisible();
  });
});

test.describe("auto-progress from the game log", () => {
  test.beforeEach(async ({ page }) => {
    await installFakeGameLog(page);
    await page.goto("./");
    await connectGameLog(page);
  });

  test("moves along as new areas are entered", async ({ page }) => {
    await expect(stepCounter(page)).toHaveText(/^1 \/ \d+$/);

    await appendToGameLog(page, areaLine("1_1_town", 1));
    await expect(stepCounter(page)).toHaveText(/^3 \/ \d+$/);
    await expect(page.getByText("Hand in")).toBeVisible();

    await appendToGameLog(page, areaLine("1_1_2", 2));
    await expect(stepCounter(page)).toHaveText(/^5 \/ \d+$/);
  });

  test("handles partial lines and Windows line endings", async ({ page }) => {
    const line = areaLine("1_1_town", 1);
    const half = Math.floor(line.length / 2);

    // Half a line has no ending yet, so nothing should happen until it is complete
    await appendToGameLog(page, line.slice(0, half));
    await page.waitForTimeout(2500);
    await expect(stepCounter(page)).toHaveText(/^1 \/ \d+$/);

    await appendToGameLog(page, line.slice(half));
    await expect(stepCounter(page)).toHaveText(/^3 \/ \d+$/);
  });

  test("catches up when areas are done in a different order", async ({
    page,
  }) => {
    await appendToGameLog(page, areaLine("1_1_town", 1) + areaLine("1_1_2", 2));
    await expect(stepCounter(page)).toHaveText(/^5 \/ \d+$/);
    const before = await stepNumber(page);

    // Nine areas ahead of The Coast, which a window of three would ignore
    await appendToGameLog(page, areaLine("1_1_5", 3));
    await expect.poll(() => stepNumber(page)).toBeGreaterThan(before + 5);
  });

  test("ignores a town that is far ahead, since towns are visited all the time", async ({
    page,
  }) => {
    await appendToGameLog(page, areaLine("1_1_town", 1) + areaLine("1_1_2", 2));
    await expect(stepCounter(page)).toHaveText(/^5 \/ \d+$/);

    await appendToGameLog(page, areaLine("1_2_town", 3));
    await page.waitForTimeout(2500);
    await expect(stepCounter(page)).toHaveText(/^5 \/ \d+$/);
  });

  test("stays connected after the page is reloaded", async ({ page }) => {
    await page.reload();

    await expect(
      page.getByRole("button", { name: "Auto-progress on" }),
    ).toBeVisible();
  });
});

test.describe("build guide", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("#/build");
    await page.getByRole("button", { name: "Import Build" }).click();
    await page.getByRole("textbox", { name: "Path of Building Code" }).fill(makePobCode());
    await page.getByRole("button", { name: "Submit" }).click();

    await page.goto("./");
    await page.getByRole("button", { name: "Open build guide" }).click();
  });

  test("shows the gems of the current level range as cards", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Gems" }).click();

    // The route also mentions the gems, so only the guide panel is looked at
    const guide = page.getByRole("complementary", { name: "Build guide" });
    await expect(guide.getByText("Spectral Throw")).toBeVisible();
    await expect(guide.getByText("Volley Support")).toBeVisible();
    await expect(guide.getByText("Static Strike")).toBeHidden();
  });

  test("picking a level range moves the route, gems and gear together, and can be undone", async ({
    page,
  }) => {
    const guide = page.getByRole("complementary", { name: "Build guide" });

    await page.getByRole("tab", { name: "Gear" }).click();
    await expect(guide.getByText("First Sword")).toBeVisible();

    const before = await stepNumber(page);
    await page
      .getByRole("combobox", { name: "Level range" })
      .selectOption({ label: "12-17" });

    // The route jumped ahead, and the gear and the gems followed
    await expect.poll(() => stepNumber(page)).toBeGreaterThan(before);
    await expect(guide.getByText("Second Sword")).toBeVisible();
    await expect(guide.getByText("First Sword")).toBeHidden();

    await page.getByRole("tab", { name: "Gems" }).click();
    await expect(guide.getByText("Static Strike")).toBeVisible();
    await expect(guide.getByText("Spectral Throw")).toBeHidden();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => stepNumber(page)).toBe(before);
    await expect(guide.getByText("Spectral Throw")).toBeVisible();
  });
});
