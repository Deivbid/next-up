import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("manual entry survives reload; editing, wishlist and invalid restore preserve data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  await page.getByLabel("Game title").fill("My weekend game");
  await page.getByRole("button", { name: "PC", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await expect(page.getByText("Game added to your library.")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "View My weekend game" }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("Paused");
  await page.getByText("Optional details", { exact: true }).click();
  await page.getByLabel("A note for later").fill("Remember the controls");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Paused · PC")).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"games":[]}'),
  });
  await expect(page.getByText(/not a valid Next Up backup/)).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View My weekend game" }),
  ).toBeVisible();
});
for (const width of [320, 390, 768, 1440])
  test(`both themes and views at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Try example library" }).click();
    for (const theme of ["Dark", "Light"]) {
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await page.getByRole("radio", { name: theme, exact: true }).click();
      for (const view of ["Today", "Library", "Settings"]) {
        await page.getByRole("link", { name: view, exact: true }).click();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      }
    }
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "View Balatro" }).click();
    await page
      .getByRole("dialog")
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.screenshot({
      path: `.local/library-${width}.png`,
      fullPage: true,
    });
  });
test("catalog failure still allows manual entry and unsaved changes require a choice", async ({
  page,
}) => {
  await page.route("**/api/catalog?*", (route) => route.fulfill({
    status: 503, json: { error: "catalog_not_configured" },
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  await page.getByLabel("Game title").fill("A manual game");
  await expect(page.getByText(/Catalog search is unavailable/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Discard your changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Game title")).toHaveValue("A manual game");
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
});
test("keyboard skip link and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(
    await page
      .locator(".page-enter")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test('a validated backup requires confirmation; cancel and restore preserve the expected library',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Try example library'}).click();await expect(page.getByText('Example games added. You can edit or remove them.')).toBeVisible();
 await page.getByRole('link',{name:'Settings',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup'}).click();const download=await downloadPromise;const file=await download.path();expect(file).not.toBeNull();
 await page.getByRole('button',{name:'Delete local data'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('link',{name:'Library',exact:true}).click();await expect(page.getByRole('button',{name:'View Balatro'})).toBeVisible();
 await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Delete local data'}).click();await page.getByRole('button',{name:'Delete everything'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByLabel('Choose backup file').setInputFiles(file!);await expect(page.getByRole('heading',{name:'Restore this backup?'})).toBeVisible();await page.getByRole('button',{name:'Replace with backup'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('link',{name:'Library',exact:true}).click();await expect(page.getByRole('button',{name:'View Balatro'})).toBeVisible();
});

test('wishlist stays separate and a finished game is no longer suggested',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add your first game'}).click();await page.getByLabel('Game title').fill('My wishlist game');await page.getByRole('radio',{name:'Wishlist',exact:true}).click();await page.getByRole('button',{name:'Add to library',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('link',{name:'Library',exact:true}).click();await page.getByRole('radio',{name:'Wishlist · 1',exact:true}).click();await page.getByRole('button',{name:'View My wishlist game'}).click();await page.getByRole('radio',{name:'Owned',exact:true}).click();await page.getByRole('button',{name:'PC',exact:true}).click();await page.getByLabel('Status',{exact:true}).selectOption('Finished');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('link',{name:'Today',exact:true}).click();await page.getByLabel('Device',{exact:true}).selectOption('PC');await expect(page.getByText('No games match this occasion yet.')).toBeVisible();
});
