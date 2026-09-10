import { test, expect } from "@playwright/test";
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
