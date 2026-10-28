import {test,expect} from '@playwright/test';
test('an accessible event omitted from public discovery stays selected after opening and reloading',async({page})=>{
 const event='77777777-7777-4777-8777-777777777777';
 // The mock directory contains only Highlander; getEvent still returns an accessible row.
 // No mock membership is granted, so the event's login screen is the expected boundary.
 await page.goto('/?page=developer&event='+event);
 await expect(page.getByRole('button',{name:'Choose or configure an event',exact:true})).toBeVisible();
 await expect(page).toHaveURL(new RegExp('event='+event));
 await page.reload();
 await expect(page.getByRole('button',{name:'Choose or configure an event',exact:true})).toBeVisible();
 await expect(page).toHaveURL(new RegExp('event='+event));
});
