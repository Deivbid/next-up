import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const steamGames = Array.from({ length: 80 }, (_, index) => ({
  steamId: index + 1,
  title: `Game ${String(index + 1).padStart(3, "0")}`,
}));

async function connect(page: Page, games = steamGames) {
  await page.route("**/api/providers", (route) =>
    route.fulfill({
      json: {
        catalog: true,
        steam: true,
        connected: true,
      },
    }),
  );
  await page.route("**/api/steam/library", (route) =>
    route.fulfill({ json: { games } }),
  );
  await page.route("https://shared.fastly.steamstatic.com/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#354635"/></svg>',
    }),
  );
  await page.goto("/#settings");
  await page.getByRole("button", { name: "Choose games to import" }).click();
}

test("scroll appends games; selections survive filtering and re-import preserves edits", async ({
  page,
}) => {
  await connect(page);
  const region = page.getByRole("region", { name: "Steam games", exact: true });
  await expect(region.getByRole("checkbox")).toHaveCount(24);
  await page.getByRole("checkbox", { name: "Game 001", exact: true }).check();
  await region.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(region.getByRole("checkbox")).toHaveCount(48);
  await page.getByRole("checkbox", { name: "Game 040", exact: true }).check();
  await page.getByLabel("Find a Steam game").fill("Game 080");
  await expect(region.getByRole("checkbox")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Game 080", exact: true }).check();
  await page.getByLabel("Find a Steam game").fill("Missing title");
  await expect(
    page.getByText("No matching games. Try another title."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 3 games", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Find a Steam game").fill("");
  await expect(region.getByRole("checkbox")).toHaveCount(24);
  await expect(
    page.getByRole("checkbox", { name: "Game 001", exact: true }),
  ).toBeChecked();
  expect(await region.evaluate((el) => el.scrollTop)).toBe(0);
  await page
    .getByRole("button", { name: "Import 3 games", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page
    .getByRole("button", { name: "View Game 001", exact: true })
    .click();
  await page.getByLabel("Status", { exact: true }).selectOption("Paused");
  await page.getByText("Optional details", { exact: true }).click();
  await page.getByLabel("A note for later").fill("Keep this note");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Choose games to import" }).click();
  await expect(
    page.getByRole("button", { name: "Import 0 games", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator(".steam-game")
      .filter({ hasText: "Game 001" })
      .getByText("Already added"),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Game 001", exact: true }).check();
  await page
    .getByRole("button", { name: "Import 1 game", exact: true })
    .click();
  await page.reload();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page.getByRole("button", { name: /^View Game/ })).toHaveCount(3);
  await page
    .getByRole("button", { name: "View Game 001", exact: true })
    .click();
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "Paused",
  );
  await page.getByText("Optional details", { exact: true }).click();
  await expect(page.getByLabel("A note for later")).toHaveValue(
    "Keep this note",
  );
});

test("cover fallback, keyboard selection and manual paging without IntersectionObserver", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).IntersectionObserver;
  });
  await connect(page);
  await page.route("https://shared.fastly.steamstatic.com/**", (route) =>
    route.abort(),
  );
  await page.getByLabel("Find a Steam game").fill("Game 080");
  await expect(page.locator(".steam-game .cover-fallback")).toBeVisible();
  const checkbox = page.getByRole("checkbox", {
    name: "Game 080",
    exact: true,
  });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  await page.getByLabel("Find a Steam game").fill("");
  const more = page.getByRole("button", { name: "Show more Steam games" });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("checkbox")).toHaveCount(48);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Choose games to import" }).click();
  await expect(page.getByLabel("Find a Steam game")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Import 0 games", exact: true }),
  ).toBeDisabled();
});

test("empty provider library never enables importing", async ({ page }) => {
  await connect(page, []);
  await expect(
    page.getByText("No games were returned. Nothing will be imported."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 0 games", exact: true }),
  ).toBeDisabled();
});

for (const width of [320, 390, 768, 1440])
  test(`Steam picker accessible in both themes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await connect(page, [
      {
        steamId: 1,
        title:
          "A very long game title that wraps without hiding the selection or actions",
      },
      ...steamGames.slice(1),
    ]);
    for (const theme of ["Dark", "Light"]) {
      if (theme === "Light") {
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("radio", { name: theme, exact: true }).click();
        await page
          .getByRole("button", { name: "Choose games to import" })
          .click();
      }
      await page.getByRole("checkbox").first().check();
      await page
        .getByRole("dialog")
        .evaluate((el) =>
          Promise.all(
            el.getAnimations({ subtree: true }).map((a) => a.finished),
          ),
        );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const actions = await page
        .getByRole("button", { name: "Import 1 game", exact: true })
        .boundingBox();
      expect(actions!.y + actions!.height).toBeLessThanOrEqual(844);
      await page.screenshot({
        path: `.local/steam-${width}-${theme.toLowerCase()}.png`,
      });
    }
  });
