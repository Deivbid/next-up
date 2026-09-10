import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("offline library, draft recovery and explicit update protect saved games", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try example library" }).click();
  await expect(
    page.getByText("Example games added. You can edit or remove them."),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little time. A good game." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View Balatro" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Balatro" }).click();
  await page.getByLabel("Game title").fill("Balatro — saved offline");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "View Balatro — saved offline" }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Add game", exact: true }).click();
  await page.getByLabel("Game title").fill("A draft worth keeping");
  const path = "dist/sw.js";
  const original = await readFile(path, "utf8");
  try {
    await writeFile(
      path,
      original + "\n// Browser update acceptance check " + Date.now(),
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await expect(
      page.getByRole("button", { name: "Update now" }),
    ).toBeDisabled();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.reload();
    await expect(page.getByLabel("Game title")).toHaveValue(
      "A draft worth keeping",
    );
    await page
      .getByRole("button", { name: "Add to library", exact: true })
      .click();
    await page.getByRole("button", { name: "Update now" }).click();
    await expect(
      page.getByRole("button", { name: "View A draft worth keeping" }),
    ).toBeVisible();
  } finally {
    await writeFile(path, original);
  }
});
