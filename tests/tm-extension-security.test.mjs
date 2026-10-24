import test from 'node:test';import assert from 'node:assert/strict';
import {websiteAllowed,hostPattern,hostPatterns,validateRequest,allowedHttp,signedSocketRule,CLOUD} from '../browser-extension/security.js';
test('extension restricts callers, selected origin and fixed API routes',()=>{
 assert.equal(websiteAllowed('https://www.ref-os.fyi/event'),true);assert.equal(websiteAllowed('https://ref-os.fyi.evil.test/'),false);assert.equal(websiteAllowed('http://ref-os.fyi'),false);
 assert.equal(hostPattern('192.168.1.2:8080'),'http://192.168.1.2/*');
 assert.deepEqual(hostPatterns('192.168.1.2:8080'),['http://192.168.1.2/*','ws://192.168.1.2/*']);
 assert.throws(()=>validateRequest('snapshot',{address:'http://other.test'},'http://192.168.1.2:8080'),/allow this TM server/);
 assert.equal(allowedHttp(CLOUD+'/functions/v1/tm-api-token','POST','http://tm.local'),true);
 assert.equal(allowedHttp('http://tm.local/api/fieldsets/1/fields','GET','http://tm.local'),true);
 assert.equal(allowedHttp('http://tm.local/admin/delete','POST','http://tm.local'),false);
 assert.equal(allowedHttp('http://tm.local:99/api/event','GET','http://tm.local'),false);
 const rule=signedSocketRule(1,'ws://192.168.1.2:8080/api/fieldsets/1',{Authorization:'Bearer test'},'extension-id');
 assert.deepEqual(rule.condition.resourceTypes,['websocket']);assert.deepEqual(rule.condition.initiatorDomains,['extension-id']);
 assert.equal(new RegExp(rule.condition.regexFilter).test('ws://192.168.1.2:8080/api/fieldsets/1?other'),false);
 assert.throws(()=>signedSocketRule(1,'ws://tm.local/arbitrary',{},'id'),/Invalid/);
});
