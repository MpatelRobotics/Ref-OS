import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeRequiredRobotPhotos,robotPhotoSlots} from '../src/robotPhotoRequirements.js';
test('defaults, explicit empty, deduplication and stable required-first order',()=>{assert.deepEqual(normalizeRequiredRobotPhotos(undefined),['front','side','back','tag']);assert.deepEqual(normalizeRequiredRobotPhotos([]),[]);assert.deepEqual(normalizeRequiredRobotPhotos(['lexan','bogus','front','front']),['front','lexan']);assert.equal(robotPhotoSlots(['lexan'])[0].key,'lexan');assert.equal(robotPhotoSlots(undefined,true).some(s=>s.key==='lexan'),false);assert.equal(robotPhotoSlots(['lexan'],true)[0].required,true);});

test('wall-start and configuration pictures are optional for every event and never change required counts',()=>{
 for(const iq of [true,false]) for(const required of [undefined,[],['front']]) {
  const slots=robotPhotoSlots(required,iq);
  for(const key of ['ziptie','configuration'])assert.equal(slots.find(slot=>slot.key===key).required,false);
  assert.equal(slots.filter(slot=>slot.required).length,normalizeRequiredRobotPhotos(required).length);
 }
});
