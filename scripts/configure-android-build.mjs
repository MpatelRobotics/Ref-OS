import { loadEnv } from 'vite';
import { spawnSync } from 'node:child_process';

// Only public client configuration is copied. Backend secrets remain in Supabase.
const env = loadEnv('production', process.cwd(), 'VITE_');
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_VAPID_PUBLIC_KEY']) {
  if (!env[name]) continue;
  if (/YOUR-PROJECT|your-anon/.test(env[name])) throw Error('Production public configuration is missing.');
  const result = spawnSync(process.platform === 'win32' ? 'gh.exe' : 'gh', ['variable', 'set', name, '--repo', 'MpatelRobotics/Ref-OS'], { input: env[name], stdio: ['pipe', 'ignore', 'pipe'] });
  if (result.status !== 0) throw Error('Could not configure ' + name);
}
console.log('Public Android build configuration saved.');
