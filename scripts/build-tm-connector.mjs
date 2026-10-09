import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/', root), { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL('tm-bridge/bridge.mjs', root))], outfile: fileURLToPath(new URL('public/tm-connector.mjs', root)), bundle: true, platform: 'node', format: 'esm', target: 'node18', packages: 'bundle', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as refosCreateRequire } from 'node:module'; const require = refosCreateRequire(import.meta.url);" } });
console.log('TM connector download prepared.');
