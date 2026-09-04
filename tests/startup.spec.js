import { test, expect } from "@playwright/test";

test("login screen renders instead of a blank page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Highlander Summit — Violation Log")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use event access code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();
});

test("permanent keypad admin code reaches name entry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use event access code" }).click();
  for (const key of ["1", "A", "2", "3"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  await expect(page.getByText("Welcome, ref")).toBeVisible();
  await expect(page.getByText("First name")).toBeVisible();
  await expect(page.getByText("Last name")).toBeVisible();
});

test("wrong password does not unlock the app", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(page.getByText("Incorrect password.")).toBeVisible();
});
