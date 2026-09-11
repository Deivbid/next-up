import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { test, userId } from "../helpers/cloud";
import { newGame, defaultPreferences } from "../../src/domain/game";
const image = readFileSync("public/landing-today.jpg");
const seed = (extra = {}) => ({
  ...newGame(),
  title: "Dead Space",
  status: "Playing" as const,
  devices: ["PC" as const],
  cover:
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1693980/library_600x900.jpg",
  ...extra,
});

test("Steam hero uses panoramic art and places it above readable content on mobile", async ({
  page,
  cloud,
}) => {
  cloud.set(userId, {
    games: [seed({ steamId: 1693980 })],
    preferences: defaultPreferences,
    revision: 1,
  });
  await page.route("**/1693980/library_hero.jpg", (route) =>
    route.fulfill({ contentType: "image/jpeg", body: image }),
  );
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Currently playing" });
  await expect(hero.locator(".hero-artwork-fallback")).toHaveCount(0);
  const art = hero.locator(".hero-artwork > img");
  await expect(art).toHaveAttribute("src", /1693980\/library_hero.jpg$/);
  await page.setViewportSize({ width: 390, height: 844 });
  const artBox = await art.boundingBox();
  const copyBox = await hero.locator(".current-copy").boundingBox();
  expect(artBox!.y + artBox!.height).toBeLessThanOrEqual(copyBox!.y + 1);
  await hero.getByRole("button", { name: "View game" }).click();
  await expect(page.getByLabel("Game title")).toHaveValue("Dead Space");
});

test("catalog games resolve by ID; an image failure keeps the full cover and saved game", async ({
  page,
  cloud,
}) => {
  const game = seed({ igdbId: 1942 });
  cloud.set(userId, {
    games: [game],
    preferences: defaultPreferences,
    revision: 1,
  });
  let requests = 0;
  await page.route("**/api/artwork?igdbId=1942", (route) => {
    requests++;
    return route.fulfill({
      json: {
        url: "https://images.igdb.com/igdb/image/upload/t_1080p/landscape.jpg",
      },
    });
  });
  await page.route("**/t_1080p/landscape.jpg", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/");
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator(".hero-artwork-fallback")).toBeVisible();
  await expect(page.locator(".hero-artwork-fallback img")).toHaveCSS(
    "object-fit",
    "contain",
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(cloud.get(userId)!.games).toEqual([game]);
  await page.getByRole("button", { name: "View game", exact: true }).click();
  await expect(page.getByLabel("Game title")).toHaveValue("Dead Space");
});

for (const response of [
  { url: null },
  { url: "https://attacker.example/art.jpg" },
  null,
]) {
  test(`unavailable artwork keeps the game usable: ${JSON.stringify(response)}`, async ({
    page,
    cloud,
  }) => {
    cloud.set(userId, {
      games: [seed({ igdbId: 1942 })],
      preferences: defaultPreferences,
      revision: 1,
    });
    await page.route("**/api/artwork?igdbId=1942", (route) =>
      route.fulfill(response ? { json: response } : { status: 503 }),
    );
    await page.goto("/");
    await expect(page.locator(".hero-artwork-fallback")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View game", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".hero-artwork > img")).toHaveCount(0);
  });
}
