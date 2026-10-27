import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
if(!existsSync('dist/index.html'))throw Error('Build Ref OS first with npm run build.');
const assets='android/venue/src/main/assets';
await mkdir(assets,{recursive:true});
await build({entryPoints:['venue-server/validate.mjs'],outfile:assets+'/validation.js',bundle:true,format:'iife',globalName:'VenueValidation',target:'es2015'});
await cp('dist',assets+'/public',{recursive:true,filter:path=>! /\.(zip|exe|apk|map)$/i.test(path)});
console.log('Android venue host includes the production web app and shared input validation.');
