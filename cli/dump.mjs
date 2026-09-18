// 导出待翻译的原文，给新模组或漏翻的条目录入用。
//
//   node cli/dump.mjs [--game <id|路径>] [--lang zh] [--mod <模组名>] [--missing-only]
//   node cli/dump.mjs --format patch  --mod Foo    > 输出可直接存成 Foo.patch.json 的内容
//   node cli/dump.mjs --format append --mod Foo    > 输出可直接存成 Foo.append.json 的内容
//
// 默认输出人看的对照清单：每条原文配一行 JSON 字符串（复制进译文数据用），
// 已经翻好的标 [OK]，还需要翻的标 [TODO]。
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, contextOrExit } from './_common.mjs';
import { listMods, readI18n } from '../lib/i18n-file.mjs';
import { looksUntranslated } from '../lib/lang.mjs';

const USAGE = 'node cli/dump.mjs [--game <id|路径>] [--lang zh] [--mod <模组名>] [--missing-only] [--format list|patch|append]';
const parsed = parseArgs(process.argv.slice(2));
if (parsed.flags.has('help')) { console.log(USAGE); process.exit(0); }

const ctx = contextOrExit(parsed, USAGE);
const wantMod = parsed.values.mod;
const format = parsed.values.format ?? 'list';

if (!['list', 'patch', 'append'].includes(format)) {
  console.error(`不认识的 --format "${format}"，可用：list、patch、append`);
  process.exit(1);
}

let mods = listMods(ctx.game, ctx.gameRoot).sort();
if (wantMod) {
  if (!mods.includes(wantMod)) {
    console.error(`游戏里没有模组 "${wantMod}"。可用：${mods.join('、')}`);
    process.exit(1);
  }
  mods = [wantMod];
}

const out = [];
let totalMissing = 0;

for (const mod of mods) {
  let source;
  try { source = readI18n(ctx.sourceOf(mod)); }
  catch (e) { console.error(`跳过 ${mod}：读不了 ${ctx.game.sourceFile}（${e.message}）`); continue; }

  const targetFile = ctx.targetOf(mod);
  const target = fs.existsSync(targetFile) ? readI18n(targetFile) : {};

  const entries = Object.entries(source).filter(([k, v]) => {
    if (!parsed.flags.has('missing-only')) return true;
    return !(k in target) || looksUntranslated(target[k]);
  });

  if (!entries.length) continue;
  totalMissing += entries.filter(([k]) => !(k in target) || looksUntranslated(target[k])).length;

  if (format !== 'list') {
    // 输出规范 JSON，可以直接存成 <模组>.patch.json / <模组>.append.json
    out.push(JSON.stringify(Object.fromEntries(entries.map(([k]) => [k, ''])), null, 2));
    continue;
  }

  out.push(`${'#'.repeat(10)} ${mod} ${'#'.repeat(10)}`);
  for (const [key, value] of entries) {
    const done = key in target && !looksUntranslated(target[key]);
    out.push(`${done ? '[OK]  ' : '[TODO]'} ${key}`);
    out.push(`    ${JSON.stringify(value)}`);
  }
  out.push('');
}

if (format !== 'list') {
  console.log(out.join('\n'));
  process.exit(0);
}

console.log(`${ctx.game.name} · ${ctx.lang} · ${mods.length} 个模组`);
console.log(`共 ${totalMissing} 条还需要翻译。\n`);
console.log(out.join('\n'));
console.log(`把译文填进 games/${ctx.game.id}/i18n/<模组>.json 后运行 node cli/apply.mjs。`);
