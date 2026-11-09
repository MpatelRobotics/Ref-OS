import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {build,Platform,Arch} from 'electron-builder';
const directory='judging-desktop/build';
await mkdir(directory,{recursive:true});
await copyFile('judging-desktop/main.mjs',`${directory}/main.mjs`);
await copyFile('public/icon-192.png',`${directory}/icon.png`);
await writeFile(`${directory}/package.json`,JSON.stringify({name:'refos-judging-portal',version:process.env.REFOS_JUDGING_VERSION||'1.0.0',main:'main.mjs',type:'module',author:'Ref-OS',description:'Judge Advisor workspace, interviews, judge groups and live Ref-OS nominations'}));
const store=process.argv.includes('--store');
await build({targets:Platform.WINDOWS.createTarget(store?'appx':'portable',Arch.x64),config:{
 appId:'app.refos.judgingportal',productName:'Ref-OS Judging Portal',
 directories:{app:directory,output:'judging-desktop/release',buildResources:'desktop/windows-assets'},
 files:['main.mjs','icon.png','package.json','!node_modules/**/*'],asar:true,npmRebuild:false,
 win:{signExecutable:false,icon:'desktop/windows-assets/icon.ico'},forceCodeSigning:false,
 portable:{artifactName:'Ref-OS-Judging-Portal-${version}-x64.exe'},
 appx:{identityName:'Ref-OS.Ref-OSJudgingPortal',publisher:'CN=1198D67D-A624-4A34-A75B-347E42DB5607',publisherDisplayName:'Ref-OS',applicationId:'RefOSJudgingPortal',displayName:'Ref-OS Judging Portal',languages:['en-US'],minVersion:'10.0.19041.0',maxVersionTested:'10.0.26100.0',capabilities:['runFullTrust','internetClient'],artifactName:'Ref-OS-Judging-Portal-${version}-x64.appx'}
}});
