import { loadEnv } from 'vite';
import { spawnSync } from 'node:child_process';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
if (!env.VITE_SUPABASE_URL?.startsWith('https://') || !env.VITE_SUPABASE_ANON_KEY || env.VITE_E2E_MOCK === '1') {
  console.error('Mobile builds need the production VITE_SUPABASE_URL and public VITE_SUPABASE_ANON_KEY. Mock mode must be disabled. Set these in .env or the build environment.');
  process.exit(1);
}
for (const args of [['scripts/check-schema.mjs'], ['node_modules/vite/bin/vite.js', 'build'], ['node_modules/@capacitor/cli/bin/capacitor', 'sync', ...(process.argv.includes('--android') ? ['android'] : [])]]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status || 1);
}
