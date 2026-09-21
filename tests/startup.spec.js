import { test, expect } from "@playwright/test";

async function keypadLogin(page, code = "1A23") {
  await page.goto("/");
  await page.getByRole("button", { name: "Use event access code" }).click();
  for (const key of code.split("")) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

async function passwordLogin(page, credential) {
  await page.goto("/");
  await page.getByPlaceholder("Password").fill(credential);
  await page.getByRole("button", { name: "Enter", exact: true }).click();
}

async function finishName(page, first = "Alex", last = "Referee") {
  await page.getByPlaceholder("e.g. Alex").fill(first);
  await page.getByPlaceholder("e.g. Rodriguez").fill(last);
  await page.getByRole("button", { name: "Start logging" }).click();
  await expect(page.getByRole("heading", { name: "Highlander Summit E2E" })).toBeVisible();
}

async function loginAdmin(page) {
  await keypadLogin(page);
  await finishName(page, "Admin", "Tester");
}

test("login screen renders instead of a blank page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Highlander Summit — Violation Log")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use event access code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();
});

test("wrong credential stays locked", async ({ page }) => {
  await passwordLogin(page, "wrong-password");
  await expect(page.getByText("Incorrect event credential.")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
});

test("permanent keypad admin code reaches split name entry", async ({ page }) => {
  await keypadLogin(page);
  await expect(page.getByText("Welcome, ref")).toBeVisible();
  await expect(page.getByText("First name")).toBeVisible();
  await expect(page.getByText("Last name")).toBeVisible();
});

test("first and last name are both required", async ({ page }) => {
  await keypadLogin(page);
  const start = page.getByRole("button", { name: "Start logging" });
  await page.getByPlaceholder("e.g. Alex").fill("OnlyFirst");
  await expect(start).toBeDisabled();
  await page.getByPlaceholder("e.g. Rodriguez").fill("NowLast");
  await expect(start).toBeEnabled();
});

test("referee password enters normal referee workspace", async ({ page }) => {
  await passwordLogin(page, "test-ref");
  await finishName(page);
  await expect(page.getByPlaceholder("Search team #")).toBeVisible();
  await expect(page.getByRole("button", { name: /Log violation/i })).toBeVisible();
});

test("judge advisor password opens judging workflow", async ({ page }) => {
  await passwordLogin(page, "test-judge");
  await finishName(page, "Judge", "Tester");
  await expect(page.getByRole("button", { name: "Sportsmanship Award" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nominate a team/i })).toBeVisible();
});

test("emcee password does not expose the floating violation button", async ({ page }) => {
  await passwordLogin(page, "test-emcee");
  await finishName(page, "Emcee", "Tester");
  await expect(page.getByPlaceholder("Search team #")).toBeVisible();
  await expect(page.getByRole("button", { name: /Log violation/i })).toHaveCount(0);
});

test("admin can add a team and open its detail page", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /Team$/ }).click();
  await page.getByPlaceholder("e.g. 1234A").fill("4610Z");
  const addTeamButton = page.getByRole("button", { name: "Add team", exact: true }).last();
  await expect(addTeamButton).toBeVisible();
  await addTeamButton.scrollIntoViewIfNeeded();
  await addTeamButton.click();
  await expect(page.getByText("4610Z", { exact: true })).toBeVisible();
  await page.getByText("4610Z", { exact: true }).click();
  await expect(page.getByText("Log violation for 4610Z")).toBeVisible();
});

test("violation write appears on the team timeline", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /Team$/ }).click();
  await page.getByPlaceholder("e.g. 1234A").fill("4610Z");
  await page.getByRole("button", { name: "Add team", exact: true }).last().click();

  await page.getByRole("button", { name: /Log violation/i }).click();
  await page.getByPlaceholder("What the rule covers").fill("E2E rule description");
  await page.getByPlaceholder(/What happened/).fill("E2E violation note");
  await page.getByRole("button", { name: "Save violation" }).click();

  await page.getByRole("button", { name: /^4610Z\b/ }).click();
  await expect(page.getByRole("listitem").getByText("E2E rule description", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").getByText("E2E violation note", { exact: true })).toBeVisible();
});

test("offline violation is retained and syncs after reconnect", async ({ page, context }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /Team$/ }).click();
  await page.getByPlaceholder("e.g. 1234A").fill("4610Q");
  await page.getByRole("button", { name: "Add team", exact: true }).last().click();

  await context.setOffline(true);
  await page.getByRole("button", { name: /Log violation/i }).click();
  await page.getByPlaceholder("What the rule covers").fill("Offline queue rule");
  await page.getByRole("button", { name: "Save violation" }).click();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(500);

  await page.getByText("4610Q", { exact: true }).click();
  await expect(page.getByRole("listitem").getByText("Offline queue rule", { exact: true })).toBeVisible();
});

test("permanent rejected write is retained in Failed Sync Items", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /Team$/ }).click();
  await page.getByPlaceholder("e.g. 1234A").fill("4610F");
  await page.getByRole("button", { name: "Add team", exact: true }).last().click();

  await page.getByRole("button", { name: /Log violation/i }).click();
  await page.getByPlaceholder("What the rule covers").fill("PERMANENT_FAIL");
  await page.getByRole("button", { name: "Save violation" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Event Command Center" }).click();
  await expect(page.getByText("Failed Sync Items")).toBeVisible();
  await expect(page.getByText("E2E simulated RLS rejection")).toBeVisible();
});


test("generated volunteer QR is produced locally as a data URL", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Event Command Center" }).click();
  await page.getByRole("button", { name: "Volunteer Access Codes" }).click();

  await page.getByRole("button", { name: "Generate code", exact: true }).first().click();
  await expect(page.getByText("Share this code")).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Show QR" }).first().click();
  const popup = await popupPromise;
  const src = await popup.locator("img").getAttribute("src");
  expect(src).toMatch(/^data:image\/png;base64,/);
});

test("service worker file is versioned for Ref OS 1.2", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  const text = await response.text();
  expect(text).toContain("refos-v74-1.0.0-admin-sms-alerts");
});

test("manifest remains available", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
});
