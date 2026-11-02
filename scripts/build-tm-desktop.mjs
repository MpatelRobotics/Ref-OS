import { mkdir, copyFile, writeFile, unlink, cp } from 'node:fs/promises';
import { build } from 'esbuild';
import { build as packageApp, Platform, Arch } from 'electron-builder';
const dir = 'desktop/build';
await unlink('public/tm-connector.mjs').catch(error => { if (error.code !== 'ENOENT') throw error; });
await mkdir(dir, { recursive: true });
await build({ entryPoints: ['desktop/main.mjs'], outfile: `${dir}/main.mjs`, bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['./venue/hostWindow.mjs', 'electron', 'bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as refosRequire } from 'node:module'; const require = refosRequire(import.meta.url);" } });
for (const file of ['preload.cjs', 'launcher.html', 'launcher.js', 'launcher.css']) await copyFile(`desktop/${file}`, `${dir}/${file}`);
await mkdir(`${dir}/venue`,{recursive:true});
for(const file of ['hostWindow.mjs','hostTools.mjs','preload.cjs','index.html','style.css','renderer.js'])await copyFile(`venue-desktop/${file}`,`${dir}/venue/${file}`);
await build({stdin:{contents:"module.exports = require('qrcode');",resolveDir:process.cwd()},outfile:`${dir}/venue/qr.cjs`,bundle:true,platform:'node',format:'cjs'});
await mkdir(`${dir}/resources/venue-server`,{recursive:true});
for(const file of ['server.mjs','store.mjs','validate.mjs','setup-page.mjs','package.json'])await copyFile(`venue-server/${file}`,`${dir}/resources/venue-server/${file}`);
await cp('dist',`${dir}/resources/dist`,{recursive:true,filter:path=>! /\.(zip|exe|apk|map)$/i.test(path)});
await copyFile('public/icon-192.png', `${dir}/icon.png`);
await writeFile(`${dir}/package.json`, JSON.stringify({ name: 'refos-tm-connect', version: process.env.REFOS_DESKTOP_VERSION || '2.0.1', type: 'module', main: 'main.mjs', author: 'Ref OS', description: 'Tournament Manager connector and local venue server in one Windows app' }));
if (!process.argv.includes('--prepare')) {
  await packageApp({ targets: Platform.WINDOWS.createTarget('portable', Arch.x64), config: { appId: 'app.refos.tmconnect', productName: 'Ref OS TM Connect', directories: { app: dir, output: 'desktop/release' }, files: ['main.mjs', 'preload.cjs', 'launcher.html', 'launcher.js', 'launcher.css', 'icon.png', 'package.json', 'venue/**/*', '!node_modules/**/*'], extraResources:[{from:`${dir}/resources`,to:'.'}], asar: true, npmRebuild: false, win: { signAndEditExecutable: false }, portable: { artifactName: 'Ref-OS-TM-Connect.exe' } } });
  await copyFile('desktop/release/Ref-OS-TM-Connect.exe', 'public/Ref-OS-TM-Connect.exe');
}

