import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
const target = new URL('../android/referee/src/main/assets/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(new URL('../android/app/src/main/assets/', import.meta.url), target, { recursive: true, filter: path => !path.endsWith('validation.js') });
const config = JSON.parse(await readFile(new URL('capacitor.config.json', target), 'utf8'));
config.appId = 'com.refos.referee';
config.appName = 'Ref-OS';
await writeFile(new URL('capacitor.config.json', target), JSON.stringify(config, null, 2));
console.log('Prepared standalone Ref-OS Android app.');
