import { test as anonymous, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, mockCloud, apiUrl, userId } from "../helpers/cloud";

anonymous(
  "landing is accessible, private views require login and Google uses PKCE",
  async ({ page }) => {
    await page.goto("/#library");
    await expect(
      page.getByRole("heading", { name: "Your games. One place." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Library", exact: true }),
    ).toHaveCount(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await page.screenshot({ path: ".local/auth-landing.png", fullPage: true });
    await page.route(`${apiUrl}/auth/v1/authorize?*`, async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("provider")).toBe("google");
      expect(url.searchParams.get("code_challenge_method")).toBe("s256");
      expect(url.searchParams.get("redirect_to")).toBe(
        "http://127.0.0.1:3030/",
      );
      await route.fulfill({
        contentType: "text/html",
        body: "<h1>Google handoff</h1>",
      });
    });
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(
      page.getByRole("heading", { name: "Google handoff" }),
    ).toBeVisible();
  },
);

test("another device loads account games; stale edits are rejected and logout hides the library", async ({
  page,
  browser,
  cloud,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try example library" }).click();
  await expect(
    page.getByText("Example games added. You can edit or remove them."),
  ).toBeVisible();
  const other = await browser.newContext();
  await mockCloud(other, cloud);
  const second = await other.newPage();
  try {
    await second.goto("http://127.0.0.1:3030/#library");
    await expect(
      second.getByRole("button", { name: "View Balatro" }),
    ).toBeVisible();
    await second.getByRole("button", { name: "View Balatro" }).click();
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "View Balatro" }).click();
    await page.getByLabel("Game title").fill("Balatro updated");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await second.getByLabel("Game title").fill("Stale name");
    await second.getByRole("button", { name: "Save changes" }).click();
    await expect(
      second.getByRole("dialog").getByText(/library changed on another device/),
    ).toBeVisible();
    expect(
      cloud.get(userId)!.games.some((g) => g.title === "Balatro updated"),
    ).toBe(true);
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View Balatro updated" }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("a different account cannot see another account cached games", async ({
  page,
  browser,
  cloud,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try example library" }).click();
  await expect(
    page.getByText("Example games added. You can edit or remove them."),
  ).toBeVisible();
  const other = await browser.newContext();
  await mockCloud(other, cloud, "22222222-2222-4222-8222-222222222222");
  const second = await other.newPage();
  try {
    await second.goto("http://127.0.0.1:3030/");
    await expect(
      second.getByRole("button", { name: "Add your first game" }),
    ).toBeVisible();
    await expect(
      second.getByRole("button", { name: "View Balatro" }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("an uncertain save keeps the draft and refresh reconciles the committed result", async ({
  page,
  cloud,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first game" }).click();
  await page.getByLabel("Game title").fill("A saved game");
  await page.route(
    `${apiUrl}/rest/v1/rpc/next_up_change_library`,
    async (route) => {
      const args = route.request().postDataJSON();
      cloud.set(userId, {
        games: args.p_games,
        preferences: { id: "preferences", devices: ["PC"], theme: "dark" },
        revision: 1,
      });
      await route.abort("failed");
    },
  );
  await page
    .getByRole("button", { name: "Add to library", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(/Could not confirm/),
  ).toBeVisible();
  await expect(page.getByLabel("Game title")).toHaveValue("A saved game");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View A saved game" }),
  ).toBeVisible();
});

test("local migration requires a backup, preserves cloud edits and keeps the original copy", async ({
  page,
  cloud,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try example library" }).click();
  await expect(
    page.getByText("Example games added. You can edit or remove them."),
  ).toBeVisible();
  const existing = cloud.get(userId)!.games[0];
  const legacy = [
    { ...existing, title: "Older local title" },
    {
      ...existing,
      id: "44444444-4444-4444-8444-444444444444",
      steamId: undefined,
      igdbId: undefined,
      title: "Only in this browser",
    },
  ];
  await page.evaluate(async (games) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("next-up");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("games", "readwrite");
        for (const game of games) tx.objectStore("games").put(game);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, legacy);
  await page.reload();
  const region = page.getByRole("region", { name: "Bring your local library" });
  await expect(
    region.getByRole("button", { name: "Import into my account" }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await region.getByRole("button", { name: "Download local backup" }).click();
  await download;
  await region.getByRole("button", { name: "Import into my account" }).click();
  await expect(region).toHaveCount(0);
  expect(
    cloud.get(userId)!.games.find((g) => g.id === existing.id)!.title,
  ).toBe(existing.title);
  expect(
    cloud.get(userId)!.games.some((g) => g.title === "Only in this browser"),
  ).toBe(true);
  await page.reload();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh library" }),
  ).toBeEnabled();
  await expect(region).toHaveCount(0);
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("next-up");
        request.onsuccess = () => {
          const db = request.result;
          const count = db.transaction("games").objectStore("games").count();
          count.onsuccess = () => {
            db.close();
            resolve(count.result);
          };
          count.onerror = () => reject(count.error);
        };
      }),
  );
  expect(count).toBe(2);
});

test("switching accounts in the same browser does not expose the first account cache", async ({
  page,
  context,
  cloud,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try example library" }).click();
  await expect(
    page.getByText("Example games added. You can edit or remove them."),
  ).toBeVisible();
  await mockCloud(context, cloud, "55555555-5555-4555-8555-555555555555");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add your first game" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "View Balatro" })).toHaveCount(
    0,
  );
});

test("profile stays in Settings and appearance follows the account to another device", async ({
  page,
  browser,
  cloud,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add your first game" }),
  ).toBeVisible();
  for (const view of ["Today", "Library"]) {
    await page.getByRole("link", { name: view, exact: true }).click();
    await expect(page.getByText("player@example.com")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const profile = page.getByRole("region", { name: "Profile", exact: true });
  await expect(profile.getByText("player@example.com")).toBeVisible();
  await expect(
    profile.getByRole("button", { name: "Refresh library" }),
  ).toBeEnabled();
  await page.getByRole("radio", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(cloud.get(userId)?.preferences.theme).toBe("light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/profile-light-mobile.png",
    fullPage: true,
  });
  const other = await browser.newContext();
  await mockCloud(other, cloud);
  try {
    const second = await other.newPage();
    await second.goto("http://127.0.0.1:3030/#settings");
    await expect(second.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
      second.getByRole("radio", { name: "Light", exact: true }),
    ).toBeChecked();
  } finally {
    await other.close();
  }
});

test("loading uses the brand, respects reduced motion and clears when games arrive", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `${apiUrl}/rest/v1/rpc/next_up_read_library`,
    async (route) => {
      await held;
      await route.fallback();
    },
  );
  try {
    await page.goto("/");
    const loading = page.getByRole("status", { name: "Loading Next Up" });
    await expect(loading).toBeVisible();
    await expect(loading.getByText("Next Up", { exact: true })).toBeVisible();
    await expect(loading.locator(".brand-loader-mark")).toHaveCSS(
      "animation-name",
      "brand-breathe",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: ".local/brand-loading-mobile.png",
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(loading.locator(".brand-loader-mark")).toHaveCSS(
      "animation-name",
      "none",
    );
    await expect(loading.locator(".brand-loader-dots span").first()).toHaveCSS(
      "animation-name",
      "none",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    release();
    await expect(loading).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add your first game" }),
    ).toBeVisible();
  } finally {
    release();
  }
});
