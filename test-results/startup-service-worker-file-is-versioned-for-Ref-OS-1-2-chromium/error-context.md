# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: startup.spec.js >> service worker file is versioned for Ref OS 1.2
- Location: tests\startup.spec.js:161:1

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "refos-v4-1.2.0"
Received string:    "const CACHE = \"refos-v5-1.2.0-offline-rules\";
const APP_SHELL = [\"/\", \"/manifest.webmanifest\", \"/logo.svg\", \"/icon-180.png\", \"/icon-192.png\", \"/icon-512.png\"];·
self.addEventListener(\"install\", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
});·
self.addEventListener(\"message\", (event) => {
  if (event.data?.type === \"SKIP_WAITING\") self.skipWaiting();
});·
self.addEventListener(\"activate\", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(\"refos-\") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});·
self.addEventListener(\"fetch\", (event) => {
  const req = event.request;
  if (req.method !== \"GET\") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || (req.mode === \"navigate\" ? caches.match(\"/\") : undefined)))
  );
});
"
```

# Test source

```ts
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
  103 |   await page.getByRole("button", { name: /^4610Z\\b/ }).click();
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
> 165 |   expect(text).toContain("refos-v4-1.2.0");
      |                ^ Error: expect(received).toContain(expected) // indexOf
  166 | });
  167 | 
  168 | test("manifest remains available", async ({ request }) => {
  169 |   const response = await request.get("/manifest.webmanifest");
  170 |   expect(response.ok()).toBeTruthy();
  171 | });
  172 | 
```