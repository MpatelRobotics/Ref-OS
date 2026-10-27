import test from 'node:test';
import assert from 'node:assert/strict';
import {uuid} from '../src/uuid.js';
const pattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('plain HTTP without randomUUID generates valid unique IDs',()=>{
 const httpCrypto={getRandomValues:bytes=>crypto.getRandomValues(bytes)};
 const ids=Array.from({length:1000},()=>uuid(httpCrypto));assert.ok(ids.every(id=>pattern.test(id)));assert.equal(new Set(ids).size,1000);
});
test('native UUID and defensive fallback are supported',()=>{
 assert.equal(uuid({randomUUID:()=> 'native-id'}),'native-id');assert.match(uuid({}),pattern);assert.match(uuid({randomUUID:()=>{throw Error('unsupported');}}),pattern);
});
