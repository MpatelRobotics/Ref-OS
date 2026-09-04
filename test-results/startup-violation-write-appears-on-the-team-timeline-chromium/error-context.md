# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: startup.spec.js >> violation write appears on the team timeline
- Location: tests\startup.spec.js:92:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^4610Z\\b/ })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - img "Highlander Summit" [ref=e7]
        - generic [ref=e8]:
          - generic [ref=e9]: Ref-OS
          - generic [ref=e10]: Referee Operating System
      - generic [ref=e11]:
        - generic [ref=e12]:
          - heading "Highlander Summit E2E" [level=1] [ref=e13]
          - generic [ref=e14]: live
        - button "1 teams · 1 violations · synced 29s ago" [ref=e16] [cursor=pointer]
      - button "0 online" [ref=e22] [cursor=pointer]
      - button "By rule" [ref=e23] [cursor=pointer]
      - button "AT Admin Tester" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: AT
        - generic [ref=e28]: Admin Tester
      - button "Settings" [ref=e30] [cursor=pointer]
    - generic [ref=e34]:
      - button "Teams" [ref=e35] [cursor=pointer]
      - button "Robots" [ref=e41] [cursor=pointer]
      - button "Alliances" [ref=e45] [cursor=pointer]
      - button "Judging" [ref=e50] [cursor=pointer]
  - main [ref=e57]:
    - button "Highlander Summit E2E 10 quals · top 16" [ref=e58] [cursor=pointer]:
      - generic [ref=e61]: Highlander Summit E2E
      - generic [ref=e62]: 10 quals · top 16
    - generic [ref=e65]:
      - 'textbox "Search team #" [ref=e70]'
      - button "Scan" [ref=e71] [cursor=pointer]
      - button "Team" [ref=e75] [cursor=pointer]
    - list [ref=e77]:
      - listitem [ref=e78]:
        - button "4610Z 1" [ref=e79] [cursor=pointer]:
          - generic [ref=e80]: 4610Z
          - generic [ref=e81]: "1"
    - generic [ref=e86]:
      - img "Highlander Summit" [ref=e87]
      - paragraph [ref=e88]:
        - text: Made by Maharshi Patel ·
        - link "@mpatel_ref" [ref=e89] [cursor=pointer]:
          - /url: https://www.instagram.com/mpatel_ref/
        - text: · v1.2.0
  - button "Log violation" [ref=e90] [cursor=pointer]
```

# Test source

```ts
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
  21  |   await expect(page.getByRole("heading", { name: "Highlander Summit E2E" })).toBeVisible();
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
> 103 |   await page.getByRole("button", { name: /^4610Z\\b/ }).click();
      |                                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
  104 |   await expect(page.getByRole("listitem").getByText("E2E rule description", { exact: true })).toBeVisible();
  105 |   await expect(page.getByText("E2E violation note")).toBeVisible();
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
  122 | 
  123 |   await page.getByText("4610Q", { exact: true }).click();
  124 |   await expect(page.getByRole("listitem").getByText("Offline queue rule", { exact: true })).toBeVisible();
  125 | });
  126 | 
  127 | test("permanent rejected write is retained in Failed Sync Items", async ({ page }) => {
  128 |   await loginAdmin(page);
  129 |   await page.getByRole("button", { name: /Team$/ }).click();
  130 |   await page.getByPlaceholder("e.g. 1234A").fill("4610F");
  131 |   await page.getByRole("button", { name: "Add team", exact: true }).last().click();
  132 | 
  133 |   await page.getByRole("button", { name: /Log violation/i }).click();
  134 |   await page.getByPlaceholder("What the rule covers").fill("PERMANENT_FAIL");
  135 |   await page.getByRole("button", { name: "Save violation" }).click();
  136 |   await page.waitForTimeout(300);
  137 | 
  138 |   await page.getByRole("button", { name: "Settings" }).click();
  139 |   await page.getByRole("button", { name: "Event Command Center" }).click();
  140 |   await expect(page.getByText("Failed Sync Items")).toBeVisible();
  141 |   await expect(page.getByText("E2E simulated RLS rejection")).toBeVisible();
  142 | });
  143 | 
  144 | 
  145 | test("generated volunteer QR is produced locally as a data URL", async ({ page }) => {
  146 |   await loginAdmin(page);
  147 |   await page.getByRole("button", { name: "Settings" }).click();
  148 |   await page.getByRole("button", { name: "Event Command Center" }).click();
  149 |   await page.getByRole("button", { name: "Volunteer Access Codes" }).click();
  150 | 
  151 |   await page.getByRole("button", { name: "Generate code", exact: true }).first().click();
  152 |   await expect(page.getByText("Share this code")).toBeVisible();
  153 | 
  154 |   const popupPromise = page.waitForEvent("popup");
  155 |   await page.getByRole("button", { name: "Show QR" }).first().click();
  156 |   const popup = await popupPromise;
  157 |   const src = await popup.locator("img").getAttribute("src");
  158 |   expect(src).toMatch(/^data:image\/png;base64,/);
  159 | });
  160 | 
  161 | test("service worker file is versioned for Ref OS 1.2", async ({ request }) => {
  162 |   const response = await request.get("/sw.js");
  163 |   expect(response.ok()).toBeTruthy();
  164 |   const text = await response.text();
  165 |   expect(text).toContain("refos-v4-1.2.0");
  166 | });
  167 | 
  168 | test("manifest remains available", async ({ request }) => {
  169 |   const response = await request.get("/manifest.webmanifest");
  170 |   expect(response.ok()).toBeTruthy();
  171 | });
  172 | 
```