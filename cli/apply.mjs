// 应用：把 games/<游戏>/i18n/ 里的译文写回模组。
//
//   node cli/apply.mjs [--game <id|路径>] [--lang zh] [游戏根目录]
//
// i18n 目录里的文件按名字决定怎么应用（规则见 lib/plans.mjs）：
//   <模组>.json          整份生成（模组原本没有目标语言文件时用）
//   <模组>.patch.json    只改写列出的那几个键（保留其余译文与注释）
//   <模组>.append.json   只追加列出的新键（已存在的键自动跳过）
//
// 流程：先备份 → 再写入 → 最后整体校验；任何一步失败都会回滚本次新建的文件，
// 不会留下半拉子状态。重复运行是安全的。
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, contextOrExit } from './_common.mjs';
import { listMods, readI18n, renderGenerated, renderPatched, renderAppended } from '../lib/i18n-file.mjs';
import { readPlans } from '../lib/plans.mjs';
import { verifyAll } from './verify.mjs';

const USAGE = 'node cli/apply.mjs [--game <id|路径>] [--lang zh] [游戏根目录]';
const parsed = parseArgs(process.argv.slice(2));
if (parsed.flags.has('help')) { console.log(USAGE); process.exit(0); }

const ctx = contextOrExit(parsed, USAGE);

// ── 收集要做的操作 ──────────────────────────────────────────────────
const plans = readPlans(ctx.dataDir);
if (!plans.length) {
  console.error(`没有找到译文数据：${ctx.dataDir}\n先按 templates/game/README.md 的说明把译文放进去。`);
  process.exit(1);
}

const installed = new Set(listMods(ctx.game, ctx.gameRoot));
const todo = plans.filter(p => installed.has(p.mod));
const notInstalled = plans.filter(p => !installed.has(p.mod)).map(p => p.mod);
const noData = [...installed].filter(m => !plans.some(p => p.mod === m));

if (!todo.length) {
  console.log(`没有可应用的译文（游戏里装了 ${installed.size} 个模组，数据里匹配到 0 个）。`);
  process.exit(0);
}

// ── 备份 ────────────────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = path.join(ctx.backupDir, `applied-${stamp}`);
let backedUp = 0;
for (const { mod } of todo) {
  const src = ctx.targetOf(mod);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(src, path.join(backupDir, `${mod}.${ctx.targetFile}`));
  backedUp++;
}
console.log(`${ctx.game.name} · 目标语言 ${ctx.lang}\n游戏目录：${ctx.gameRoot}`);
console.log(backedUp ? `原文件已备份到 ${path.relative(process.cwd(), backupDir)}/（${backedUp} 个）\n` : '（没有可备份的原文件）\n');

// ── 写入 ────────────────────────────────────────────────────────────
const created = [];
const results = [];

for (const plan of todo) {
  const target = ctx.targetOf(plan.mod);
  const existed = fs.existsSync(target);
  try {
    if (plan.op === 'generate') {
      const content = renderGenerated(plan.data, ctx.sourceOf(plan.mod));
      if (!existed) created.push(target);
      fs.writeFileSync(target, content, 'utf8');
      results.push(`✓ ${plan.mod.padEnd(24)} ${String(Object.keys(plan.data).length).padStart(4)} 条  整份生成`);
      continue;
    }

    if (!existed) throw new Error(`没有 ${ctx.targetFile}，无法${plan.op === 'patch' ? '改写' : '追加'}（改用整份生成）`);
    const before = readI18n(target);
    const current = fs.readFileSync(target, 'utf8');
    const after = plan.op === 'patch'
      ? renderPatched(current, plan.data)
      : renderAppended(current, plan.data);

    const changed = after !== current;
    if (changed) fs.writeFileSync(target, after, 'utf8');
    if (plan.op === 'patch') {
      results.push(`✓ ${plan.mod.padEnd(24)} ${String(Object.keys(plan.data).length).padStart(4)} 条  改写${changed ? '' : '（值本来就一样）'}`);
    } else {
      const added = Object.keys(plan.data).filter(k => !(k in before));
      results.push(`✓ ${plan.mod.padEnd(24)} ${String(added.length).padStart(4)} 条  追加${added.length ? '' : '（已是最新）'}`);
    }
  } catch (err) {
    for (const f of created) if (fs.existsSync(f)) fs.unlinkSync(f);
    console.error(`✗ ${plan.mod} 失败：${err.message}`);
    console.error(`已回滚本次新建的文件${backedUp ? `；原文件在 ${path.relative(process.cwd(), backupDir)}/` : ''}。`);
    process.exit(1);
  }
}

// ── 快照 ────────────────────────────────────────────────────────────
// games/<游戏>/<语言>/ 是给人看的成品快照（方便直接翻看、diff、手工拷走）。
// 它是从游戏目录里刚写好的内容复制的，所以永远和应用结果一致。
let snapshots = 0;
for (const { mod } of todo) {
  const src = ctx.targetOf(mod);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(ctx.zhDir, { recursive: true });
  fs.copyFileSync(src, path.join(ctx.zhDir, `${mod}.${ctx.targetFile}`));
  snapshots++;
}

// ── 校验 ────────────────────────────────────────────────────────────
const report = verifyAll(ctx, todo.map(p => p.mod));
const bad = report.filter(r => r.problems.length);

console.log(results.join('\n'));
console.log(`\n成品快照已更新：${path.relative(process.cwd(), ctx.zhDir)}/（${snapshots} 个）`);
if (notInstalled.length) console.log(`跳过（游戏里没装）：${notInstalled.join('、')}`);
if (noData.length) console.log(`提示：这些模组还没有译文数据，会被跳过：${noData.join('、')}`);

if (bad.length) {
  console.error(`\n校验没通过：`);
  for (const r of bad) console.error(`  ${r.mod}: ${r.problems.join('；')}`);
  process.exit(1);
}
console.log('\n校验通过：键齐全、占位符一致、无重复键、没有漏翻。');
