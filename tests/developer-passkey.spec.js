import { test, expect } from '@playwright/test';
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';

test('event passkey login requires server-confirmed Developer access for that event',async({page})=>{
 await page.route(/\/src\/developerPasskey\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`export const passkeysSupported=()=>true;export async function developerPasskey(event){window.passkeyEvent=event;}`}));
 await page.route(/\/src\/api(?:\.js)?(?:\?.*)?$/,async route=>{const response=await route.fetch();const source=await response.text();await route.fulfill({response,body:source.replace('export async function getMyEventAccessChecked(eventId) {','export async function getMyEventAccessChecked(eventId) { return window.testAccess;')});});
 await page.route('**/event-passkey-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/auth/LoginScreen.jsx')).default;window.testAccess={role:'admin',developer:false};window.logins=[];DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{eventId:'event-two',eventName:'Event Two',onUnlock:(...args)=>window.logins.push(args),onChooseEvent:()=>{}}));</script>`}));
 await page.goto('/event-passkey-test');
 await page.getByRole('button',{name:'Sign in as Developer with passkey'}).click();
 await expect(page.getByText('Developer access could not be confirmed.')).toBeVisible();
 expect(await page.evaluate(()=>window.logins)).toEqual([]);
 await page.evaluate(()=>{window.testAccess={role:'admin',developer:true};});
 await page.getByRole('button',{name:'Sign in as Developer with passkey'}).click();
 await expect.poll(()=>page.evaluate(()=>window.logins)).toEqual([['ref',true,'admin','',true]]);
 expect(await page.evaluate(()=>window.passkeyEvent)).toBe('event-two');
});

test('Developer passkey page stays unlocked while active and locks after three idle minutes',async({page})=>{
 await page.route(/\/src\/components\/DeveloperPageLock\.jsx(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:`import React from '/node_modules/.vite/deps/react.js';export default function Lock({onUnlock}){return React.createElement('button',{onClick:()=>onUnlock('passkey')},'Test passkey login');}`}));
 await page.clock.install();
 await page.goto('/?page=developer');
 await page.getByRole('button',{name:'Test passkey login'}).click();
 await expect(page.getByRole('button',{name:'Universal Feedback · Developer only'})).toBeVisible();
 await page.clock.runFor(120000);
 await page.getByRole('heading',{name:'Choose VEX Event'}).click();
 await page.clock.runFor(179000);
 await expect(page.getByRole('button',{name:'Test passkey login'})).toHaveCount(0);
 await page.clock.runFor(1001);
 await expect(page.getByRole('button',{name:'Test passkey login'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Universal Feedback · Developer only'})).toHaveCount(0);
});

test('Developer passkey registers and signs in through a verified WebAuthn ceremony', async ({page,context}) => {
 const session=await context.newCDPSession(page);
 await session.send('WebAuthn.enable');
 await session.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
 let challenge, credential, registrations=0, authentications=0;
 await page.route('https://example.supabase.co/functions/v1/refos-developer-passkey',async route=>{
  const body=route.request().postDataJSON();
  let reply;
  if(body.action==='register-options'){
   expect(body.credential).toBe('test-code');
   const options=await generateRegistrationOptions({rpName:'Ref OS',rpID:'localhost',userName:'Developer',authenticatorSelection:{residentKey:'required',userVerification:'required'}});
   challenge=options.challenge;reply={options,challengeId:'registration'};
  }else if(body.action==='register-verify'){
   expect(body.challengeId).toBe('registration');
   const verified=await verifyRegistrationResponse({response:body.response,expectedChallenge:challenge,expectedOrigin:'http://localhost:4173',expectedRPID:'localhost',requireUserVerification:true});
   expect(verified.verified).toBe(true);credential=verified.registrationInfo.credential;registrations++;
   // Invalid origin and challenge must never verify the same response.
   await expect(verifyRegistrationResponse({response:body.response,expectedChallenge:'different',expectedOrigin:'http://localhost:4173',expectedRPID:'localhost'})).rejects.toThrow();
   await expect(verifyRegistrationResponse({response:body.response,expectedChallenge:challenge,expectedOrigin:'https://wrong.example',expectedRPID:'localhost'})).rejects.toThrow();
   reply={ok:true};
  }else if(body.action==='authenticate-options'){
   const options=await generateAuthenticationOptions({rpID:'localhost',userVerification:'required'});challenge=options.challenge;reply={options,challengeId:'authentication'};
  }else{
   const verified=await verifyAuthenticationResponse({response:body.response,expectedChallenge:challenge,expectedOrigin:'http://localhost:4173',expectedRPID:'localhost',requireUserVerification:true,credential});
   expect(verified.verified).toBe(true);authentications++;reply={ok:true};
  }
  await route.fulfill({contentType:'application/json',body:JSON.stringify(reply)});
 });
 await page.route('**/passkey-test',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import '/@vite/client';import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;const React=(await import('/node_modules/.vite/deps/react.js')).default;const DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const View=(await import('/src/components/DeveloperPageLock.jsx')).default;window.unlocks=0;DOM.createRoot(document.getElementById('root')).render(React.createElement(View,{events:[{id:'event'}],onUnlock:()=>window.unlocks++}));</script>`}));
 await page.goto('http://localhost:4173/passkey-test');
 await page.getByLabel('Developer code').fill('test-code');
 await page.getByRole('button',{name:'Set up fingerprint / passkey'}).click();
 await expect.poll(()=>page.evaluate(()=>window.unlocks)).toBe(1);
 await page.getByRole('button',{name:'Sign in with passkey'}).click();
 await expect.poll(()=>page.evaluate(()=>window.unlocks)).toBe(2);
 expect(registrations).toBe(1);expect(authentications).toBe(1);
});
