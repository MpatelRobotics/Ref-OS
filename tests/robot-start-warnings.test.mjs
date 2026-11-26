import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipTiePhotoTeams} from '../src/robotStartWarnings.js';
test('dedicated saved or queued zip-tie pictures flag their team, ordinary configurations do not',()=>{
 const teams=[{number:'1A',photoKeys:['/event/team/1A/ziptie-id.webp']},{number:'2B',_pendingRobotPhotos:[{angle:'ziptie'}]},{number:'3C',photoKeys:['/event/team/3C/configuration-id.jpg','/event/team/3C/front-id.jpg']},{number:'4D',photoKeys:[]}];
 assert.deepEqual(zipTiePhotoTeams(teams),{'1A':true,'2B':true});
 assert.deepEqual(zipTiePhotoTeams([{number:'1A',photoKeys:[]}]),{});
 assert.deepEqual(zipTiePhotoTeams([{number:'1A',photoKeys:['/event/team/1A/s-session/ziptie-id.JPG']}]),{'1A':true});
});

test('enabled toggle warns without a picture, disabled toggle does not suppress an existing picture, and earlier sessions stay separate',()=>{
 const row=(team,zipTieWall,session_id=null)=>({session_id,payload:{recordType:'robot-reference',team,zipTieWall}});
 assert.deepEqual(zipTiePhotoTeams([], [row('1A',true),row('2B',false),row('3C',true,'old')]),{'1A':true});
 assert.deepEqual(zipTiePhotoTeams([{number:'2B',photoKeys:['/event/team/2B/ziptie-id.webp']}],[row('2B',false)]),{'2B':true});
 assert.deepEqual(zipTiePhotoTeams([], [row('3C',true,'old')],'old'),{'3C':true});
 assert.deepEqual(zipTiePhotoTeams([], [row('1A',false)]),{});
});
