import { test, expect } from "@playwright/test";

async function openEvent(page){
 await page.route('https://example.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async r=>{const res=await r.fetch();let source=await res.text();source=source.replace('export async function getMyEventRole(eventId) {','export async function getMyEventRole(eventId) { return window.fixtureRole||null;').replace('const value = String(credential || "");','const value = String(credential || ""); window.fixtureRole=["1A23","test-admin"].includes(value)?"admin":"ref";').replace('if (String(row.rule_desc || "").includes("PERMANENT_FAIL"))','if (String(row.notes || "").includes("PERMANENT_FAIL"))');await r.fulfill({response:res,body:source});});
 await page.goto('/?page=events');await page.getByRole('button',{name:'Expand all',exact:true}).click();await page.getByRole('button',{name:/Highlander Summit/}).first().click();
}
async function keypadLogin(page,code='1A23'){await openEvent(page);await page.getByRole('textbox',{name:'Event access code',exact:true}).fill(code);}
async function passwordLogin(page,credential){await openEvent(page);await page.getByRole('button',{name:'Admin login',exact:true}).click();await page.getByPlaceholder('Admin password').fill(credential);await page.getByRole('button',{name:'Enter',exact:true}).click();}
async function finishName(page,first='Alex',last='Referee'){
 await page.getByPlaceholder('e.g. Maharshi').fill(first);await page.getByPlaceholder('Required for exports').nth(0).fill(first);await page.getByPlaceholder('Required for exports').nth(1).fill(last);await page.getByRole('button',{name:'Start logging',exact:true}).click();await page.getByRole('button',{name:'Close Quick Start'}).click();
}
async function selectRule(page){await page.getByRole('button',{name:'Select rules',exact:true}).click();await page.getByPlaceholder('Search code or description').fill('SG1');await page.getByRole('button',{name:'<SG1> Starting a Match',exact:true}).click();await page.getByRole('button',{name:/^Done/}).click();}
async function loginAdmin(page){await keypadLogin(page);await finishName(page,'Admin','Tester');await page.getByRole('button',{name:'Teams',exact:true}).click();}
test('landing explains the app and event selection opens access screen',async({page})=>{await page.goto('/');await expect(page.getByRole('main',{name:'About Ref-OS'})).toBeVisible();await openEvent(page);await expect(page.getByRole('textbox',{name:'Event access code',exact:true})).toBeVisible();});

test("wrong credential stays locked", async ({ page }) => {
  await passwordLogin(page, "wrong-password");
  await expect(page.getByText("Incorrect event credential.")).toBeVisible();
  await expect(page.getByPlaceholder("Admin password")).toBeVisible();
});

test("permanent keypad admin code reaches split name entry", async ({ page }) => {
  await keypadLogin(page);
  await expect(page.getByRole("heading",{name:"Set up your profile"})).toBeVisible();
  await expect(page.getByText("First name",{exact:true})).toBeVisible();
  await expect(page.getByText("Last name",{exact:true})).toBeVisible();
});

test("first and last name are both required", async ({ page }) => {
  await keypadLogin(page);
  await page.getByPlaceholder("e.g. Maharshi").fill("Tester");
  const start = page.getByRole("button", { name: "Start logging" });
  await page.getByPlaceholder("Required for exports").nth(0).fill("OnlyFirst");
  await expect(start).toBeDisabled();
  await page.getByPlaceholder("Required for exports").nth(1).fill("NowLast");
  await expect(start).toBeEnabled();
});

test("referee password enters normal referee workspace", async ({ page }) => {
  await keypadLogin(page, "1B23");
  await finishName(page);
  await page.getByRole("button",{name:"Teams",exact:true}).click();
  await expect(page.getByPlaceholder("Search team #")).toBeVisible();
  await page.getByRole('button',{name:'Team',exact:true}).click();await page.getByPlaceholder('e.g. 1234A').fill('100A');await page.getByRole('button',{name:'Add team',exact:true}).last().click();await page.getByRole('button',{name:/^100A\b/}).click();await expect(page.getByRole('button',{name:'Log violation for 100A'})).toBeVisible();
});

test("judge advisor password opens judging workflow", async ({ page }) => {
  await keypadLogin(page, "1C23");
  await finishName(page, "Judge", "Tester");
  await page.getByRole("button",{name:"Nominations",exact:true}).click();
  await expect(page.getByRole("button", { name: "Sportsmanship Award" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nominate a team/i })).toBeVisible();
});

test("emcee password does not expose the floating violation button", async ({ page }) => {
  await keypadLogin(page, "1D23");
  await finishName(page, "Emcee", "Tester");
  await page.getByRole("button",{name:"Teams",exact:true}).click();
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

  await page.getByRole("button",{name:/^4610[ZQF]\b/}).click();
  await page.getByRole("button", { name: /Log violation/i }).click();
  await selectRule(page);
  await page.getByPlaceholder(/What happened/).fill("E2E violation note");
  await page.getByRole("button", { name: "Save violation" }).click();


  await expect(page.getByRole("listitem").getByText("E2E violation note", { exact: true })).toBeVisible();
});

test("offline violation is retained and syncs after reconnect", async ({ page, context }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /Team$/ }).click();
  await page.getByPlaceholder("e.g. 1234A").fill("4610Q");
  await page.getByRole("button", { name: "Add team", exact: true }).last().click();

  await context.setOffline(true);
  await page.getByRole("button",{name:/^4610[ZQF]\b/}).click();
  await page.getByRole("button", { name: /Log violation/i }).click();
  await selectRule(page);
  await page.getByPlaceholder(/What happened/).fill("Offline queue rule");
  await page.getByRole("button", { name: "Save violation" }).click();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(500);


  await expect(page.getByRole("listitem").getByText("Offline queue rule", { exact: true })).toBeVisible();
});

test("permanent rejected write is retained in Failed Sync Items", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: /Team$/ }).click();
  await page.getByPlaceholder("e.g. 1234A").fill("4610F");
  await page.getByRole("button", { name: "Add team", exact: true }).last().click();

  await page.getByRole("button",{name:/^4610[ZQF]\b/}).click();
  await page.getByRole("button", { name: /Log violation/i }).click();
  await selectRule(page);
  await page.getByPlaceholder(/What happened/).fill("PERMANENT_FAIL");
  await page.getByRole("button", { name: "Save violation" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Event Command Center" }).click();
  await expect(page.getByText("Failed Sync Items")).toBeVisible();
  await expect(page.getByText("E2E simulated RLS rejection")).toBeVisible();
});


test('event role access management validates and saves a code',async({page})=>{
 await loginAdmin(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Event Command Center',exact:true}).click();await page.getByRole('button',{name:/^Volunteer Access /}).click();await page.getByRole('button',{name:/^Manage access codes/}).click();
 await expect(page.getByRole('heading',{name:'Event Access Management'})).toBeVisible();await page.getByRole('button',{name:'Set Code',exact:true}).first().click();await expect(page.getByText('Code must be number, letter A-Z, number, number. Example: 3S23.')).toBeVisible();
 await page.getByPlaceholder('3S23').first().fill('3S23');await page.getByRole('button',{name:'Set Code',exact:true}).first().click();await expect(page.getByText('Admin access code updated.')).toBeVisible();await expect(page.getByPlaceholder('3S23').first()).toHaveValue('');
});

test("service worker file has a versioned cache", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  const text = await response.text();
  expect(text).toMatch(/refos-v\d+/);
});

test("manifest remains available", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
});
