import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionFailure} from '../desktop/networkErrors.mjs';
test('network diagnostics explain proxy, certificate and loopback failures without exposing URLs',()=>{
 assert.match(connectionFailure({code:'ERR_PROXY_CONNECTION_FAILED'}),/school proxy/);
 assert.match(connectionFailure({message:'net::ERR_CERT_AUTHORITY_INVALID at https:\/\/private.test/?secret=hidden'}),/filtering certificate/);
 assert.doesNotMatch(connectionFailure({message:'net::ERR_CERT_AUTHORITY_INVALID at https:\/\/private.test/?secret=hidden'}),/private.test|secret|hidden/);
 assert.match(connectionFailure({code:'EACCES'},'local'),/loopback/);
 assert.match(connectionFailure({code:'ERR_ABORTED'}),/redirects/);
});
