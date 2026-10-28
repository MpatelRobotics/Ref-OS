
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {sampleRobotPhoto,SAMPLE_ROBOT_PHOTOS} from '../src/sampleRobotPhotos.js';
test('only known sample asset paths resolve; uploaded and arbitrary external paths stay private',()=>{
 const event='371654d9-502e-47ad-9de2-78b8c72c1752';
 for(const [key,photo] of Object.entries(SAMPLE_ROBOT_PHOTOS)){
  assert.equal(sampleRobotPhoto(event+'/team/97001A/sample-robot-'+key+'.jpg'),photo);
  assert.ok(existsSync(new URL('../public'+photo.url,import.meta.url)));
 }
 assert.ok(sampleRobotPhoto(event+'/team/97001A/s-'+event+'/sample-robot-blrs.jpg'));
 for(const path of ['https://example.com/robot.jpg',event+'/team/97001A/front-upload.jpg',event+'/team/123A/sample-robot-blrs.jpg',event+'/team/97001A/sample-robot-unknown.jpg'])assert.equal(sampleRobotPhoto(path),null);
});
