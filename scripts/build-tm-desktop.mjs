import { mkdir, copyFile, writeFile, unlink } from 'node:fs/promises';
import { build } from 'esbuild';
import { build as packageApp, Platform, Arch } from 'electron-builder';
const dir = 'desktop/build';
await unlink('public/tm-connector.mjs').catch(error => { if (error.code !== 'ENOENT') throw error; });
await mkdir(dir, { recursive: true });
await build({ entryPoints: ['desktop/main.mjs'], outfile: `${dir}/main.mjs`, bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['electron', 'bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as refosRequire } from 'node:module'; const require = refosRequire(import.meta.url);" } });
for (const file of ['preload.cjs', 'launcher.html', 'launcher.js', 'launcher.css']) await copyFile(`desktop/${file}`, `${dir}/${file}`);
await copyFile('public/icon-192.png', `${dir}/icon.png`);
await writeFile(`${dir}/package.json`, JSON.stringify({ name: 'refos-tm-connect', version: '2.0.0', type: 'module', main: 'main.mjs', author: 'Ref OS', description: 'Share local Tournament Manager data with Ref OS Cloud' }));
if (!process.argv.includes('--prepare')) {
  await packageApp({ targets: Platform.WINDOWS.createTarget('portable', Arch.x64), config: { appId: 'app.refos.tmconnect', productName: 'Ref OS TM Connect', directories: { app: dir, output: 'desktop/release' }, files: ['main.mjs', 'preload.cjs', 'launcher.html', 'launcher.js', 'launcher.css', 'icon.png', 'package.json', '!node_modules/**/*'], asar: true, npmRebuild: false, win: { signAndEditExecutable: false }, portable: { artifactName: 'Ref-OS-TM-Connect.exe' } } });
  await copyFile('desktop/release/Ref-OS-TM-Connect.exe', 'public/Ref-OS-TM-Connect.exe');
}

