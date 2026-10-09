import { readFileSync } from 'node:fs';
export function packageInfo() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const appId = pkg.splunk.appId;
  if (!/^[a-z][a-z0-9_]*$/.test(appId) || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Invalid app identity or version');
  if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) throw new Error('Package lock version mismatch');
  const config = readFileSync('splunk-app/default/app.conf', 'utf8');
  const sections = Object.fromEntries([...config.matchAll(/^\[([^\]]+)\]\s*\n([^]*?)(?=^\[|$(?![^]))/gm)].map(m => [m[1], Object.fromEntries(m[2].split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(v => v.trim())))]));
  if (sections.id?.name !== appId || sections.package?.id !== appId || sections.id?.version !== pkg.version || sections.launcher?.version !== pkg.version) throw new Error('app.conf identity/version mismatch');
  return { appId, version: pkg.version, tag: `v${pkg.version}`, archive: `dist/${appId}-${pkg.version}.tar.gz` };
}
