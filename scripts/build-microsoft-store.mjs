import {spawnSync} from 'node:child_process';
import {build,Platform,Arch} from 'electron-builder';
const prepared=spawnSync(process.execPath,['scripts/build-tm-desktop.mjs','--prepare'],{stdio:'inherit'});
if(prepared.status!==0)process.exit(prepared.status||1);
await build({targets:Platform.WINDOWS.createTarget('appx',Arch.x64),config:{
 appId:'app.refos.tmconnect',productName:'Ref OS TM Connect',
 directories:{app:'desktop/build',output:'desktop/store-release'},
 files:['main.mjs','preload.cjs','launcher.html','launcher.js','launcher.css','icon.png','package.json','venue/**/*','!node_modules/**/*'],
 extraResources:[{from:'desktop/build/resources',to:'.'}],asar:true,npmRebuild:false,
 win:{signAndEditExecutable:false},forceCodeSigning:false,
 appx:{identityName:'Ref-OS.Ref-OSConnect',publisher:'CN=1198D67D-A624-4A34-A75B-347E42DB5607',publisherDisplayName:'Ref-OS',applicationId:'RefOSConnect',displayName:'Ref-OS Connect',languages:['en-US'],minVersion:'10.0.19041.0',maxVersionTested:'10.0.26100.0',capabilities:['runFullTrust','internetClient','privateNetworkClientServer'],artifactName:'Ref-OS-Connect-${version}-x64.appx'}
}});
