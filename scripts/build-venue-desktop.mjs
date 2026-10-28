import {mkdir,copyFile,writeFile,cp} from 'node:fs/promises';
import {build,Platform,Arch} from 'electron-builder';
import {build as bundle} from 'esbuild';
const dir='venue-desktop/build';
await mkdir(dir,{recursive:true});
for(const file of ['main.mjs','hostTools.mjs','preload.cjs','index.html','style.css','renderer.js'])await copyFile('venue-desktop/'+file,dir+'/'+file);
await bundle({stdin:{contents:"module.exports = require('qrcode');",resolveDir:process.cwd()},outfile:dir+'/qr.cjs',bundle:true,platform:'node',format:'cjs'});
await mkdir(dir+'/resources/venue-server',{recursive:true});
for(const file of ['server.mjs','store.mjs','validate.mjs','setup-page.mjs','package.json'])await copyFile('venue-server/'+file,dir+'/resources/venue-server/'+file);
await cp('dist',dir+'/resources/dist',{recursive:true,filter:path=>! /\.(zip|exe|apk|map)$/i.test(path)});
await writeFile(dir+'/package.json',JSON.stringify({name:'refos-venue-server',version:'2.0.0',type:'module',main:'main.mjs',author:'Ref OS',description:'Local event sharing for Ref OS'}));
if(!process.argv.includes('--prepare')){
 await build({targets:Platform.WINDOWS.createTarget('portable',Arch.x64),config:{appId:'app.refos.venueserver',productName:'Ref OS Venue Server',directories:{app:dir,output:'venue-desktop/release'},files:['*.mjs','*.cjs','*.html','*.css','*.js','package.json'],extraResources:[{from:dir+'/resources',to:'.'}],asar:true,npmRebuild:false,win:{signAndEditExecutable:false},portable:{artifactName:'Ref-OS-Venue-Server.exe'}}});
 await copyFile('venue-desktop/release/Ref-OS-Venue-Server.exe','public/Ref-OS-Venue-Server.exe');
 await copyFile('venue-desktop/release/Ref-OS-Venue-Server.exe','dist/Ref-OS-Venue-Server.exe');
}
