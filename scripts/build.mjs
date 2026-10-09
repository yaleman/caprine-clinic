import { build } from 'esbuild';
import { cp, mkdir, rm, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { packageInfo } from './package_info.mjs';
import { execFileSync } from 'node:child_process';
const info = packageInfo();
const out = `output/${info.appId}`;
await rm('output/caprine_clinic', { recursive: true, force: true });
await cp('splunk-app', out, { recursive: true });
await mkdir(`${out}/appserver/static`, { recursive: true });
await build({ entryPoints: ['frontend/main.tsx'], bundle: true, minify: true,
  outfile: `${out}/appserver/static/clinic.js`, target: ['es2022'],
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info',
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.woff': 'file', '.woff2': 'file' } });
let template = await readFile(`${out}/appserver/templates/clinic.html`, 'utf8');
for (const extension of ['js', 'css']) {
  const source = `${out}/appserver/static/clinic.${extension}`;
  const hash = createHash('sha256').update(await readFile(source)).digest('hex').slice(0, 12);
  const filename = `clinic-${hash}.${extension}`;
  await rename(source, `${out}/appserver/static/${filename}`);
  template = template.replace(`clinic.${extension}`, filename);
}
await writeFile(`${out}/appserver/templates/clinic.html`, template);
execFileSync('python3', ['scripts/archive.py', 'pack', out, info.archive], { stdio: 'inherit' });
execFileSync('python3', ['scripts/archive.py', 'validate', info.archive, info.appId, info.version], { stdio: 'inherit' });
await cp(info.archive, 'caprine-clinic.spl');
console.log(`Packaged ${info.archive} and local caprine-clinic.spl alias`);

await rm('output/clinic_test_fixtures', { recursive: true, force: true });
await cp('tests/splunk-fixture-app', 'output/clinic_test_fixtures', { recursive: true });
execFileSync('python3', ['scripts/archive.py', 'pack', 'output/clinic_test_fixtures', 'output/clinic-test-fixtures.spl']);
