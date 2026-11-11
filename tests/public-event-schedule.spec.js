import { test, expect } from "@playwright/test";

test("audience opens and searches schedules and rankings without staff login", async ({ page }) => {
  const eventId = "11111111-1111-4111-8111-111111111111";
  const matches = [
    { phase: "qual", num: 1, red: ["123A"], blue: ["456B"], redScore: 0, blueScore: 28 },
    { phase: "qual", num: 2, red: ["456B"], blue: ["789C"], redScore: null, blueScore: null },
  ];
  await page.route("**/rest/v1/rpc/get_public_event_schedule", route => {
    const { p_preview } = route.request().postDataJSON();
    return route.fulfill({ json: p_preview ? { available: true } : {
      available: true, program: "v5", timezone: "UTC",
      teams: { "123A": "Circuit Team", "456B": "Bot Team" },
      schedules: [{ session: null, division: 0, matches, times: [], ranks: { "456B": 1, "123A": 2 } }],
    } });
  });

  await page.goto("/?event=" + eventId);
  await expect(page.getByRole("button", { name: "Staff login", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Access schedule", exact: true }).click();
  await expect(page.getByText("0 – 28", { exact: true })).toBeVisible();
  await expect(page.getByText("Awaiting score", { exact: true })).toBeVisible();
  await page.getByLabel("Search by team").fill("Circuit");
  await expect(page.getByText("Qualification 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Qualification 2", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Rankings", exact: true }).click();
  await expect(page.getByRole("row", { name: /2 123A/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /456B/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to event", exact: true }).click();
  await page.getByRole("button", { name: "Staff login", exact: true }).click();
  await expect(page.getByText(/Enter the 4 character access code/)).toBeVisible();
});
