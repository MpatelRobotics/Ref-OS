# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: startup.spec.js >> offline violation is retained and syncs after reconnect
- Location: tests\startup.spec.js:108:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Highlander Summit E2E' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Highlander Summit E2E' })

```

```yaml
- complementary "Desktop navigation":
  - img "Highlander Summit"
  - text: Ref OS v1.2.0 Highlander Summit E2E Live
  - navigation:
    - button "Command Center":
      - img
      - text: Command Center
    - button "Teams":
      - img
      - text: Teams
    - button "Rules":
      - img
      - text: Rules
    - button "Robots":
      - img
      - text: Robots
    - button "Alliances":
      - img
      - text: Alliances
    - button "Judging":
      - img
      - text: Judging
  - button "Field Log":
    - img
    - text: Field Log
  - button "Contacts":
    - img
    - text: Contacts
  - button "Features & Help":
    - img
    - text: Features & Help
  - button "Settings":
    - img
    - text: Settings
- main:
  - button "Highlander Summit E2E 10 quals · top 16":
    - img
    - text: Highlander Summit E2E 10 quals · top 16
    - img
  - img
  - 'textbox "Search team #"'
  - button "Scan":
    - img
    - text: Scan
  - button "Team":
    - img
    - text: Team
  - paragraph: No teams yet
  - paragraph: Add a team, or just log a violation and the team is created for you.
  - img "Highlander Summit"
  - paragraph:
    - text: Made by Maharshi Patel ·
    - link "@mpatel_ref":
      - /url: https://www.instagram.com/mpatel_ref/
    - text: · v1.2.0
- button "Log violation":
  - img
  - text: Log violation
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | async function keypadLogin(page, code = "1A23") {
  4   |   await page.goto("/");
  5   |   await page.getByRole("button", { name: "Use event access code" }).click();
  6   |   for (const key of code.split("")) {
  7   |     await page.getByRole("button", { name: key, exact: true }).click();
  8   |   }
  9   | }
  10  | 
  11  | async function passwordLogin(page, credential) {
  12  |   await page.goto("/");
  13  |   await page.getByPlaceholder("Password").fill(credential);
  14  |   await page.getByRole("button", { name: "Enter", exact: true }).click();
  15  | }
  16  | 
  17  | async function finishName(page, first = "Alex", last = "Referee") {
  18  |   await page.getByPlaceholder("e.g. Alex").fill(first);
  19  |   await page.getByPlaceholder("e.g. Rodriguez").fill(last);
  20  |   await page.getByRole("button", { name: "Start logging" }).click();
> 21  |   await expect(page.getByRole("heading", { name: "Highlander Summit E2E" })).toBeVisible();
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
  22  | }
  23  | 
  24  | async function loginAdmin(page) {
  25  |   await keypadLogin(page);
  26  |   await finishName(page, "Admin", "Tester");
  27  | }
  28  | 
  29  | test("login screen renders instead of a blank page", async ({ page }) => {
  30  |   await page.goto("/");
  31  |   await expect(page.getByText("Highlander Summit — Violation Log")).toBeVisible();
  32  |   await expect(page.getByRole("button", { name: "Use event access code" })).toBeVisible();
  33  |   await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();
  34  | });
  35  | 
  36  | test("wrong credential stays locked", async ({ page }) => {
  37  |   await passwordLogin(page, "wrong-password");
  38  |   await expect(page.getByText("Incorrect event credential.")).toBeVisible();
  39  |   await expect(page.getByPlaceholder("Password")).toBeVisible();
  40  | });
  41  | 
  42  | test("permanent keypad admin code reaches split name entry", async ({ page }) => {
  43  |   await keypadLogin(page);
  44  |   await expect(page.getByText("Welcome, ref")).toBeVisible();
  45  |   await expect(page.getByText("First name")).toBeVisible();
  46  |   await expect(page.getByText("Last name")).toBeVisible();
  47  | });
  48  | 
  49  | test("first and last name are both required", async ({ page }) => {
  50  |   await keypadLogin(page);
  51  |   const start = page.getByRole("button", { name: "Start logging" });
  52  |   await page.getByPlaceholder("e.g. Alex").fill("OnlyFirst");
  53  |   await expect(start).toBeDisabled();
  54  |   await page.getByPlaceholder("e.g. Rodriguez").fill("NowLast");
  55  |   await expect(start).toBeEnabled();
  56  | });
  57  | 
  58  | test("referee password enters normal referee workspace", async ({ page }) => {
  59  |   await passwordLogin(page, "test-ref");
  60  |   await finishName(page);
  61  |   await expect(page.getByPlaceholder("Search team #")).toBeVisible();
  62  |   await expect(page.getByRole("button", { name: /Log violation/i })).toBeVisible();
  63  | });
  64  | 
  65  | test("judge advisor password opens judging workflow", async ({ page }) => {
  66  |   await passwordLogin(page, "test-judge");
  67  |   await finishName(page, "Judge", "Tester");
  68  |   await expect(page.getByRole("button", { name: "Sportsmanship Award" })).toBeVisible();
  69  |   await expect(page.getByRole("button", { name: /Nominate a team/i })).toBeVisible();
  70  | });
  71  | 
  72  | test("emcee password does not expose the floating violation button", async ({ page }) => {
  73  |   await passwordLogin(page, "test-emcee");
  74  |   await finishName(page, "Emcee", "Tester");
  75  |   await expect(page.getByPlaceholder("Search team #")).toBeVisible();
  76  |   await expect(page.getByRole("button", { name: /Log violation/i })).toHaveCount(0);
  77  | });
  78  | 
  79  | test("admin can add a team and open its detail page", async ({ page }) => {
  80  |   await loginAdmin(page);
  81  |   await page.getByRole("button", { name: /Team$/ }).click();
  82  |   await page.getByPlaceholder("e.g. 1234A").fill("4610Z");
  83  |   const addTeamButton = page.getByRole("button", { name: "Add team", exact: true }).last();
  84  |   await expect(addTeamButton).toBeVisible();
  85  |   await addTeamButton.scrollIntoViewIfNeeded();
  86  |   await addTeamButton.click();
  87  |   await expect(page.getByText("4610Z", { exact: true })).toBeVisible();
  88  |   await page.getByText("4610Z", { exact: true }).click();
  89  |   await expect(page.getByText("Log violation for 4610Z")).toBeVisible();
  90  | });
  91  | 
  92  | test("violation write appears on the team timeline", async ({ page }) => {
  93  |   await loginAdmin(page);
  94  |   await page.getByRole("button", { name: /Team$/ }).click();
  95  |   await page.getByPlaceholder("e.g. 1234A").fill("4610Z");
  96  |   await page.getByRole("button", { name: "Add team", exact: true }).last().click();
  97  | 
  98  |   await page.getByRole("button", { name: /Log violation/i }).click();
  99  |   await page.getByPlaceholder("What the rule covers").fill("E2E rule description");
  100 |   await page.getByPlaceholder(/What happened/).fill("E2E violation note");
  101 |   await page.getByRole("button", { name: "Save violation" }).click();
  102 | 
  103 |   await page.getByRole("button", { name: /^4610Z\b/ }).click();
  104 |   await expect(page.getByRole("listitem").getByText("E2E rule description", { exact: true })).toBeVisible();
  105 |   await expect(page.getByRole("listitem").getByText("E2E violation note", { exact: true })).toBeVisible();
  106 | });
  107 | 
  108 | test("offline violation is retained and syncs after reconnect", async ({ page, context }) => {
  109 |   await loginAdmin(page);
  110 |   await page.getByRole("button", { name: /Team$/ }).click();
  111 |   await page.getByPlaceholder("e.g. 1234A").fill("4610Q");
  112 |   await page.getByRole("button", { name: "Add team", exact: true }).last().click();
  113 | 
  114 |   await context.setOffline(true);
  115 |   await page.getByRole("button", { name: /Log violation/i }).click();
  116 |   await page.getByPlaceholder("What the rule covers").fill("Offline queue rule");
  117 |   await page.getByRole("button", { name: "Save violation" }).click();
  118 | 
  119 |   await context.setOffline(false);
  120 |   await page.evaluate(() => window.dispatchEvent(new Event("online")));
  121 |   await page.waitForTimeout(500);
```