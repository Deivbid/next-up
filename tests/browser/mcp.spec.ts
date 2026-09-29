import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, apiUrl, userId } from "../helpers/cloud";
const clientId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const details = {
  authorization_id: "test-authorization",
  redirect_uri: "http://127.0.0.1:45999/callback",
  client: { id: clientId, name: "Test AI" },
  scope: "openid offline_access",
  user: { id: userId, email: "player@example.com" },
};

base(
  "public guide is readable without sign-in at mobile and desktop widths",
  async ({ page }) => {
    await page.goto("/connect");
    await page
      .locator(".connect-intro")
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Your backlog",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await page.screenshot({
      path: ".local/mcp-guide-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: ".local/mcp-guide-mobile.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Connect in three steps" }).click();
    await expect(page).toHaveURL(/#setup$/);
  },
);
base(
  "consent requires a request and retains it through Google login",
  async ({ page }) => {
    await page.goto("/oauth/consent");
    await expect(page.getByRole("alert")).toContainText(
      "No connection request",
    );
    let redirect = "";
    await page.route(`${apiUrl}/auth/v1/authorize?**`, (route) => {
      redirect = route.request().url();
      return route.fulfill({ body: "Google sign-in placeholder" });
    });
    await page.goto("/oauth/consent?authorization_id=test-authorization");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect.poll(() => redirect).not.toBe("");
    expect(new URL(redirect).searchParams.get("redirect_to")).toBe(
      "http://127.0.0.1:3030/oauth/consent",
    );
  },
);
test("consent defaults to read only, persists explicit choice, and loads once", async ({
  page,
}) => {
  let loads = 0;
  const actions: unknown[] = [];
  await page.route(`${apiUrl}/auth/v1/oauth/authorizations/**`, (route) => {
    if (route.request().method() === "GET") {
      loads++;
      return route.fulfill({ json: details });
    }
    actions.push(route.request().postDataJSON());
    return route.fulfill({
      json: { redirect_url: details.redirect_uri + "?code=test&state=test" },
    });
  });
  await page.route(
    `${apiUrl}/rest/v1/rpc/next_up_set_mcp_connection`,
    (route) => {
      actions.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    },
  );
  await page.route("http://127.0.0.1:45999/callback**", (route) =>
    route.fulfill({ body: "Connected" }),
  );
  await page.goto("/oauth/consent?authorization_id=test-authorization");
  await expect(
    page.getByRole("heading", { name: "Connect Test AI?" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Read only" })).toBeChecked();
  await expect(page.getByText(/stay connected between sessions/)).toBeVisible();
  await page
    .locator(".consent-panel")
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".local/mcp-consent-mobile.png",
    fullPage: true,
  });
  await page.getByRole("radio", { name: "Read & edit" }).click();
  await page.getByRole("button", { name: "Allow connection" }).click();
  await expect(page).toHaveURL(/45999\/callback/);
  expect(loads).toBe(1);
  expect(actions).toEqual([
    {
      p_client_id: clientId,
      p_client_name: "Test AI",
      p_permission: "write",
      p_resource: "http://127.0.0.1:3030/api/mcp",
    },
    { action: "approve" },
  ]);
});
test("denial does not create a library grant", async ({ page }) => {
  let grant = false;
  await page.route(`${apiUrl}/rest/v1/rpc/next_up_set_mcp_connection`, (r) => {
    grant = true;
    return r.fulfill({ status: 204 });
  });
  await page.route(`${apiUrl}/auth/v1/oauth/authorizations/**`, (r) =>
    r.fulfill({
      json:
        r.request().method() === "GET"
          ? details
          : { redirect_url: details.redirect_uri + "?error=access_denied" },
    }),
  );
  await page.route("http://127.0.0.1:45999/callback**", (r) =>
    r.fulfill({ body: "Canceled" }),
  );
  await page.goto("/oauth/consent?authorization_id=test-authorization");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/access_denied/);
  expect(grant).toBe(false);
});
test("invalid callback cannot navigate or authorize", async ({ page }) => {
  await page.route(`${apiUrl}/auth/v1/oauth/authorizations/**`, (r) =>
    r.fulfill({ json: { ...details, redirect_uri: "javascript:alert(1)" } }),
  );
  await page.goto("/oauth/consent?authorization_id=test-authorization");
  await expect(page.getByRole("alert")).toContainText("Unsupported callback");
  await expect(
    page.getByRole("button", { name: "Allow connection" }),
  ).toHaveCount(0);
});
test("omitted provider metadata is accepted; failed permission save never approves OAuth", async ({
  page,
}) => {
  let approvals = 0;
  await page.route(`${apiUrl}/auth/v1/oauth/authorizations/**`, (r) => {
    if (r.request().method() !== "GET") approvals++;
    return r.fulfill({
      json: {
        authorization_id: details.authorization_id,
        redirect_uri: details.redirect_uri,
        client: { id: clientId },
        user: { id: userId },
      },
    });
  });
  await page.route(`${apiUrl}/rest/v1/rpc/next_up_set_mcp_connection`, (r) =>
    r.fulfill({ status: 503, json: { message: "Unavailable" } }),
  );
  await page.goto("/oauth/consent?authorization_id=test-authorization");
  await expect(
    page.getByRole("heading", { name: "Connect this AI app?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allow connection" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save this permission",
  );
  expect(approvals).toBe(0);
});
test("unknown provider scopes are not silently approved", async ({ page }) => {
  await page.route(`${apiUrl}/auth/v1/oauth/authorizations/**`, (r) =>
    r.fulfill({ json: { ...details, scope: "openid unknown-permission" } }),
  );
  await page.goto("/oauth/consent?authorization_id=test-authorization");
  await expect(page.getByRole("alert")).toContainText("unsupported permission");
  await expect(
    page.getByRole("button", { name: "Allow connection" }),
  ).toHaveCount(0);
});
test("settings revokes DB access before provider tokens; both themes stay accessible", async ({
  page,
}) => {
  const actions: string[] = [];
  await page.route(`${apiUrl}/rest/v1/mcp_connections?**`, (r) =>
    r.fulfill({
      json: [
        {
          client_id: clientId,
          client_name: "Test AI",
          permission: "read",
          resource: "http://127.0.0.1:3030/api/mcp",
          granted_at: new Date().toISOString(),
        },
      ],
    }),
  );
  await page.route(`${apiUrl}/rest/v1/rpc/next_up_set_mcp_connection`, (r) => {
    actions.push("db");
    expect(r.request().postDataJSON().p_permission).toBe(null);
    return r.fulfill({ status: 204 });
  });
  await page.route(`${apiUrl}/auth/v1/user/oauth/grants?**`, (r) => {
    actions.push("oauth");
    return r.fulfill({ status: 204 });
  });
  await page.goto("/#settings");
  const panel = page.getByRole("region", { name: "AI connections" });
  await expect(panel.getByText("Test AI", { exact: true })).toBeVisible();
  for (const theme of ["dark", "light"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
    }, theme);
    expect(
      (await new AxeBuilder({ page }).include(".ai-connections").analyze())
        .violations,
    ).toEqual([]);
  }
  await panel
    .getByRole("button", { name: "Remove access for Test AI" })
    .click();
  await expect(panel.getByText("No AI apps connected yet.")).toBeVisible();
  expect(actions).toEqual(["db", "oauth"]);
});
