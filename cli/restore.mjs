// 还原：按 games/<游戏>/i18n/ 里的译文数据，重新算出目标语言文件并写回模组。
//
//   node cli/restore.mjs [--game <id|路径>] [--lang zh] [游戏根目录]
//   node cli/restore.mjs --all        游戏里已有译文也覆盖（Vortex 重新部署后用这个）
//   node cli/restore.mjs --dry-run    只看会动哪些模组，不真写
//
// 什么时候用它：Vortex 的 Purge/Deploy 会把模组的 i18n 覆盖回英文，跑一次这个就回来了。
//
// 跟 apply 的区别：apply 是「把数据写回去」，restore 是「不管游戏里现在是什么样，
// 都用数据重新算一遍并覆盖」。数据是唯一事实来源，所以它不受游戏目录被改乱的影响。
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, contextOrExit, ROOT } from './_common.mjs';
import { listMods, readI18n, renderGenerated, renderPatched, renderAppended } from '../lib/i18n-file.mjs';
import { readPlans } from '../lib/plans.mjs';

const USAGE = 'node cli/restore.mjs [--all] [--dry-run] [--game <id|路径>] [--lang zh] [游戏根目录]';
const parsed = parseArgs(process.argv.slice(2));
if (parsed.flags.has('help')) { console.log(USAGE); process.exit(0); }

const ctx = contextOrExit(parsed, USAGE);
const all = parsed.flags.has('all');
const dryRun = parsed.flags.has('dry-run');

const plans = readPlans(ctx.dataDir);
if (!plans.length) {
  console.error(`没有任何译文数据：${path.relative(ROOT, ctx.dataDir)}`);
  process.exit(1);
}

const installed = new Set(listMods(ctx.game, ctx.gameRoot));
console.log(`${ctx.game.name} · 目标语言 ${ctx.lang}\n游戏目录：${ctx.gameRoot}\n`);

let written = 0, skipped = 0, notInstalled = 0;

for (const plan of plans) {
  const target = ctx.targetOf(plan.mod);
  if (!installed.has(plan.mod)) {
    console.log(`—  ${plan.mod.padEnd(24)} 游戏里没装这个模组，跳过`);
    notInstalled++;
    continue;
  }

  // 算出「数据认为应该是什么样」
  let wanted;
  try {
    if (plan.op === 'generate') {
      wanted = renderGenerated(plan.data, ctx.sourceOf(plan.mod));
    } else if (!fs.existsSync(target)) {
      throw new Error(`游戏里没有 ${ctx.targetFile}，无法${plan.op === 'patch' ? '改写' : '追加'}；数据里补一份整份生成才能还原`);
    } else {
      const current = fs.readFileSync(target, 'utf8');
      wanted = plan.op === 'patch' ? renderPatched(current, plan.data) : renderAppended(current, plan.data);
    }
  } catch (err) {
    console.log(`✗ ${plan.mod.padEnd(24)} ${err.message}`);
    continue;
  }

  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current === wanted) {
    console.log(`=  ${plan.mod.padEnd(24)} 已经是最新译文`);
    skipped++;
    continue;
  }
  if (current && !all) {
    console.log(`=  ${plan.mod.padEnd(24)} 游戏里的内容和数据不同，未覆盖（要强制覆盖加 --all）`);
    skipped++;
    continue;
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, wanted, 'utf8');
  }
  console.log(`→  ${plan.mod.padEnd(24)} ${dryRun ? '将写入' : '已写入'} ${ctx.targetFile}`);
  written++;
}

console.log(`\n${dryRun ? '（预览，未改动任何文件）' : ''}处理 ${written} 个，跳过 ${skipped} 个${notInstalled ? `，未安装 ${notInstalled} 个` : ''}。`);
