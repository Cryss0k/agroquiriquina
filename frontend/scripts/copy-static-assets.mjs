import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const builtAssets = resolve(root, 'dist', 'assets');
const staticAssets = resolve(root, 'static', 'app');

await rm(staticAssets, { recursive: true, force: true });
await mkdir(staticAssets, { recursive: true });
await cp(builtAssets, resolve(staticAssets, 'assets'), { recursive: true });
await rm(builtAssets, { recursive: true, force: true });
