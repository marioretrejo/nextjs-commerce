// Thin production launcher — tsx loads only these lines, then the pre-compiled
// ESM bundle is imported without tsx transpilation overhead. This keeps both
// the parent worker and every supervised child process under 10 s startup
// (LiveKit's hard limit for child initialization).
//
// To rebuild after editing agent/worker_core.ts:
//   pnpm build:worker
//
// For local TypeScript development (live reload via tsx):
//   pnpm agent
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dynamic import() works in CJS; top-level await does NOT — hence the .catch()
// instead of await. The process stays alive because worker.mjs starts servers.
import(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'worker.mjs')).catch(
  (err: Error) => {
    process.stderr.write(`[worker-launcher] ${err.stack ?? err.message}\n`);
    process.exit(1);
  },
);
