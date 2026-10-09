import { appendFileSync, existsSync } from 'node:fs';
import { packageInfo } from './package_info.mjs';
const info = packageInfo();
if (!existsSync(info.archive) || !existsSync(`${info.archive}.sha256`)) throw new Error('Build package before reading release metadata');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${info.tag}\narchive=${info.archive}\n`);
else console.log(JSON.stringify(info, null, 2));
