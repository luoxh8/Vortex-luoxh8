// 校验：检查译文是否完整、格式是否正确。
//
//   node cli/verify.mjs [--game <id|路径>] [--lang zh] [游戏根目录]
//
// 每个模组检查五件事：
//   1. 目标语言文件能被解析（带注释的 JSON 也认）
//   2. 源文件与译文都没有重复键（重复键会被 JSON 悄悄吞掉）
//   3. 键和源文件完全对得上（不多不少）
//   4. 占位符没被动过（{{名字}} 和 {0} 这类，程序靠它填内容）
//   5. 没有漏翻的条目
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, contextOrExit } from './_common.mjs';
import { listMods, readI18n } from '../lib/i18n-file.mjs';
import { findDuplicateKeys } from '../core/jsonc.mjs';
import { looksUntranslated, placeholdersOf } from '../lib/lang.mjs';

/** 对指定模组做全部检查 */
export function verifyAll(ctx, onlyMods) {
  const mods = listMods(ctx.game, ctx.gameRoot).filter(m => !onlyMods || onlyMods.includes(m));

  return mods.sort().map(mod => {
    const problems = [];
    const sourceFile = ctx.sourceOf(mod);
    const targetFile = ctx.targetOf(mod);

    const dupesOf = (file, label) => {
      const dupes = findDuplicateKeys(fs.readFileSync(file, 'utf8'));
      if (dupes.length) problems.push(`${label} 有重复键：${dupes.slice(0, 5).join(', ')}`);
    };

    let source;
    try { source = readI18n(sourceFile); }
    catch (e) { return { mod, keys: 0, problems: [`${ctx.game.sourceFile} 读不了：${e.message}`] }; }

    if (!fs.existsSync(targetFile)) return { mod, keys: 0, problems: [`没有 ${ctx.targetFile}`] };

    let target;
    try { target = readI18n(targetFile); }
    catch (e) { return { mod, keys: 0, problems: [`${ctx.targetFile} 读不了：${e.message}`] }; }

    dupesOf(sourceFile, ctx.game.sourceFile);
    dupesOf(targetFile, ctx.targetFile);

    const missing = Object.keys(source).filter(k => !(k in target));
    const extra = Object.keys(target).filter(k => !(k in source));
    if (missing.length) problems.push(`缺 ${missing.length} 个键：${missing.slice(0, 5).join(', ')}`);
    if (extra.length) problems.push(`多 ${extra.length} 个键：${extra.slice(0, 5).join(', ')}`);

    const phBad = Object.keys(source).filter(k => k in target && placeholdersOf(source[k]) !== placeholdersOf(target[k]));
    if (phBad.length) problems.push(`占位符不一致 ${phBad.length} 处：${phBad.slice(0, 3).join(', ')}`);

    const untranslated = Object.keys(source).filter(k => k in target && looksUntranslated(target[k]));
    if (untranslated.length) problems.push(`未翻译 ${untranslated.length} 处：${untranslated.slice(0, 5).join(', ')}`);

    return { mod, keys: Object.keys(target).length, problems };
  });
}

// ── 直接运行时作为命令行工具 ─────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const USAGE = 'node cli/verify.mjs [--game <id|路径>] [--lang zh] [游戏根目录]';
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.flags.has('help')) { console.log(USAGE); process.exit(0); }

  const ctx = contextOrExit(parsed, USAGE);
  console.log(`${ctx.game.name} · 目标语言 ${ctx.lang}\n游戏目录：${ctx.gameRoot}\n`);

  const report = verifyAll(ctx);
  for (const r of report) {
    console.log(`${r.mod.padEnd(24)} ${String(r.keys).padStart(4)} 条  ${r.problems.length ? '⚠ ' + r.problems.join('；') : '✓ 通过'}`);
  }
  const bad = report.filter(r => r.problems.length).length;
  console.log(bad ? `\n${bad} 个模组有问题。` : '\n全部通过：键齐全、占位符一致、无重复键、没有漏翻。');
  process.exit(bad ? 1 : 0);
}
