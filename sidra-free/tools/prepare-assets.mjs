import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '..', 'public', 'logo.png');
if (!existsSync(source)) throw new Error('Original Sidra logo not present: public/logo.png');
copyFileSync(source, resolve(root, 'site', 'logo.png'));
console.log('Existing Sidra logo copied; no new or unrelated branding used.');
