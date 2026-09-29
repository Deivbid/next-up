import { expect } from "@playwright/test";
import { test } from "../helpers/cloud";
import AxeBuilder from "@axe-core/playwright";

const games = Array.from({ length: 20 }, (_, i) => ({
  igdbId: i + 1,
  title: `Cyberpunk ${i + 1}`,
  cover: "",
  genres: ["RPG"],
}));

test("typing debounces suggestions; the compact list scrolls and works with keyboard", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route("**/api/catalog?*", (route) => {
    queries.push(new URL(route.request().url()).searchParams.get("q")!);
    return route.fulfill({ json: { games } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  const title = page.getByLabel("Game title");
  await title.fill("C");
  await page.waitForTimeout(450);
  expect(queries).toEqual([]);
  await title.pressSequentially("yberpunk", { delay: 30 });
  const results = page.getByRole("region", { name: "Catalog results" });
  await expect(results.getByRole("button")).toHaveCount(20);
  expect(queries).toEqual(["Cyberpunk"]);
  await title.press("Space");
  await expect(results).toBeVisible();
  expect(
    await results.evaluate(
      (el) => el.scrollHeight > el.clientHeight && el.clientHeight <= 240,
    ),
  ).toBe(true);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: ".local/catalog-suggestions-mobile.png" });
  await title.focus();
  await title.press("Tab");
  await expect(results.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("End");
  await results.getByRole("button").last().focus();
  expect(await results.evaluate((el) => el.scrollTop > 0)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(title).toHaveValue("Cyberpunk 20");
  await expect(title).toBeFocused();
  await expect(results).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(queries).toEqual(["Cyberpunk"]);
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await expect(page.getByText("Game added to your library.")).toBeVisible();
});

test("late results cannot replace a newer query and clearing removes suggestions", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/catalog?*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q === "Old") await held;
    await route
      .fulfill({
        json: {
          games: [
            { ...games[0], title: q === "Old" ? "Old result" : "New result" },
          ],
        },
      })
      .catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  const title = page.getByLabel("Game title");
  const oldRequest = page.waitForRequest("**/api/catalog?q=Old");
  await title.fill("Old");
  await oldRequest;
  await title.fill("New");
  await expect(
    page.getByRole("button", { name: "New result", exact: true }),
  ).toBeVisible();
  release();
  await page.waitForTimeout(300);
  await expect(
    page.getByRole("button", { name: "Old result", exact: true }),
  ).toHaveCount(0);
  await title.fill("");
  await expect(
    page.getByRole("region", { name: "Catalog results" }),
  ).toHaveCount(0);
});

test("empty matches explain manual entry and an in-flight search does not block saving", async ({
  page,
}) => {
  await page.route("**/api/catalog?*", (route) =>
    route.fulfill({ json: { games: [] } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  await page.getByLabel("Game title").fill("My game");
  await expect(
    page.getByText("No matches. You can still add this game manually."),
  ).toBeVisible();
  await page.route("**/api/catalog?*", () => {});
  await page.getByLabel("Game title").fill("My other game");
  await expect(page.getByText("Searching…", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await expect(page.getByText("Game added to your library.")).toBeVisible();
});

test("popular games appear without typing, scroll, select and save", async ({
  page,
  cloud,
}) => {
  let calls = 0;
  await page.route("**/api/catalog/popular", (route) => {
    calls++;
    return route.fulfill({ json: { games } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  const results = page.getByRole("region", { name: "Popular games" });
  await expect(results.getByRole("button")).toHaveCount(20);
  await expect(page.getByText(/Popular on IGDB/)).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".local/popular-mobile.png" });
  await results.getByRole("button").last().focus();
  expect(await results.evaluate((el) => el.scrollTop > 0)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Game title")).toHaveValue("Cyberpunk 20");
  await expect(results).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(calls).toBe(1);
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await expect(page.getByText("Game added to your library.")).toBeVisible();
  expect([...cloud.values()][0].games[0].igdbId).toBe(20);
});

test("late popular results never overwrite search; clearing shows popular again", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/catalog/popular", async (route) => {
    await held;
    await route.fulfill({ json: { games } }).catch(() => {});
  });
  await page.route("**/api/catalog?*", (route) =>
    route.fulfill({ json: { games: [{ ...games[0], title: "Kena" }] } }),
  );
  await page.goto("/");
  const requested = page.waitForRequest("**/api/catalog/popular");
  await page.getByRole("button", { name: "Add your first game" }).click();
  await requested;
  await page.getByLabel("Game title").fill("Kena");
  await expect(
    page.getByRole("button", { name: "Kena", exact: true }),
  ).toBeVisible();
  release();
  await page.waitForTimeout(200);
  await expect(page.getByRole("region", { name: "Popular games" })).toHaveCount(
    0,
  );
  await page.getByLabel("Game title").fill("");
  await expect(
    page.getByRole("region", { name: "Popular games" }).getByRole("button"),
  ).toHaveCount(20);
});

test("popular failure keeps manual addition usable", async ({ page }) => {
  await page.route("**/api/catalog/popular", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  await expect(
    page.getByText(
      "Popular games are unavailable. Search or enter a title yourself.",
    ),
  ).toBeVisible();
  await page.getByLabel("Game title").fill("X");
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await expect(page.getByText("Game added to your library.")).toBeVisible();
});
