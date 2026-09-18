// 盘点：列出哪些模组还有内容没翻成目标语言。
//
//   node cli/scan.mjs [--game <id|路径>] [--lang zh] [游戏根目录]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, contextOrExit } from './_common.mjs';
import { listMods, readI18n } from '../lib/i18n-file.mjs';
import { looksUntranslated } from '../lib/lang.mjs';

const USAGE = 'node cli/scan.mjs [--game <id|路径>] [--lang zh] [游戏根目录]';
const parsed = parseArgs(process.argv.slice(2));
if (parsed.flags.has('help')) { console.log(USAGE); process.exit(0); }

const ctx = contextOrExit(parsed, USAGE);

console.log(`${ctx.game.name} · 目标语言 ${ctx.lang}\n游戏目录：${ctx.gameRoot}\n`);

let totalMissing = 0;
let totalUntranslated = 0;

for (const mod of listMods(ctx.game, ctx.gameRoot).sort()) {
  let source;
  try { source = readI18n(ctx.sourceOf(mod)); }
  catch (e) { console.log(`${mod.padEnd(24)} ✗ 读不了 ${ctx.game.sourceFile}：${e.message}`); continue; }

  const target = ctx.targetOf(mod);
  const total = Object.keys(source).length;

  if (!fs.existsSync(target)) {
    console.log(`${mod.padEnd(24)} ${String(total).padStart(4)} 条  没有 ${ctx.targetFile}，全部待翻译`);
    totalMissing += total;
    continue;
  }

  const translated = readI18n(target);
  const missing = Object.keys(source).filter(k => !(k in translated));
  const untranslated = Object.keys(source).filter(k => k in translated && looksUntranslated(translated[k]));

  totalMissing += missing.length;
  totalUntranslated += untranslated.length;

  const notes = [];
  if (missing.length) notes.push(`缺 ${missing.length} 条`);
  if (untranslated.length) notes.push(`未翻译 ${untranslated.length} 条`);
  console.log(`${mod.padEnd(24)} ${String(total).padStart(4)} 条  ${notes.length ? '⚠ ' + notes.join('，') : '✓ 已完整'}`);
  if (missing.length) console.log(`    缺：${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`);
  if (untranslated.length) console.log(`    未翻译：${untranslated.slice(0, 8).join(', ')}${untranslated.length > 8 ? ' …' : ''}`);
}

console.log(`\n合计：缺 ${totalMissing} 条，未翻译 ${totalUntranslated} 条。`);
console.log(totalMissing + totalUntranslated === 0
  ? '全部模组都已完成。'
  : '把译文放进 games/<游戏>/i18n/ 后运行 node cli/apply.mjs 写回游戏。');
