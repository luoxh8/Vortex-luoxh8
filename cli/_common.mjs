// 命令行公共部分：解析参数、定位游戏目录与语言。
//
// 支持的写法：
//   node cli/<命令>.mjs --game <游戏根目录> --lang zh
//   node cli/<命令>.mjs --game stardew-valley --lang zh
//   node cli/<命令>.mjs <游戏根目录>              （兼容简写）
//
// 游戏目录也可以放在环境变量里（见 game.json 的 gameDirEnv 字段）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listGames, readGame, resolveGameRoot, joinMods } from '../lib/game.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAMES_DIR = path.join(ROOT, 'games');

const BOOLEAN_FLAGS = ['all', 'dry-run', 'force', 'help'];

/** 把 argv 拆成 { flags, values, positional } */
export function parseArgs(argv) {
  const flags = new Set();
  const values = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const name = arg.slice(2);
    if (BOOLEAN_FLAGS.includes(name)) { flags.add(name); continue; }
    values[name] = argv[++i];
  }
  return { flags, values, positional };
}

/** 找出这次要处理哪个游戏 */
function pickGame(games, wanted) {
  if (!wanted) {
    if (games.length === 1) return games[0];
    const ids = games.map(g => g.id).join(', ');
    throw new Error(`games/ 下有多个游戏（${ids}），请用 --game 指定一个`);
  }
  const byId = games.find(g => g.id === wanted);
  if (byId) return byId;
  // 也接受直接给 games/<id> 这个目录
  if (fs.existsSync(path.join(wanted, 'game.json'))) return readGame(path.resolve(wanted));

  const hint = /[\\/]/.test(wanted)
    ? '--game 认的是游戏 id 或 games/<id> 目录；想直接指定游戏安装目录，请当位置参数传（或设环境变量）。'
    : `可用 id：${games.map(g => g.id).join(', ')}`;
  throw new Error(`找不到游戏 "${wanted}"。${hint}`);
}

/**
 * 解析出本次运行的环境。
 * @returns {{game, gameRoot, lang, locale, i18nDir(mod), targetFile(mod)}}
 */
export function makeContext(parsed) {
  const games = listGames(GAMES_DIR);
  const game = pickGame(games, parsed.values.game);

  const lang = parsed.values.lang ?? game.defaultLang ?? Object.keys(game.languages)[0];
  const locale = game.languages[lang];
  if (!locale) {
    throw new Error(`${game.id} 不支持语言 "${lang}"，可用：${Object.keys(game.languages).join(', ')}`);
  }

  // 位置参数里第一个存在的目录当作游戏根目录
  const cliPaths = parsed.positional;
  const gameRoot = path.resolve(resolveGameRoot(game, cliPaths));

  const targetFile = game.targetFileTemplate.replace('{lang}', locale.code);
  return {
    game,
    gameRoot,
    lang,
    locale,
    targetFile,
    modsDir: joinMods(game, gameRoot),
    /** 模组 i18n 目录 */
    i18nDir: (mod) => path.join(joinMods(game, gameRoot), mod, 'i18n'),
    /** 某个模组的目标语言文件绝对路径 */
    targetOf: (mod) => path.join(joinMods(game, gameRoot), mod, 'i18n', targetFile),
    /** 模组的源文件（一般是英文 default.json）绝对路径 */
    sourceOf: (mod) => path.join(joinMods(game, gameRoot), mod, 'i18n', game.sourceFile),
    /** 该项目里存译文的数据目录 */
    dataDir: path.join(game.dir, 'i18n'),
    /** 权威成品目录 */
    zhDir: path.join(game.dir, lang),
    /** 备份目录 */
    backupDir: path.join(game.dir, 'backup'),
  };
}

/** 解析参数并检查游戏目录存在，失败就打印用法并退出 */
export function contextOrExit(parsed, usage) {
  try {
    const ctx = makeContext(parsed);
    if (!fs.existsSync(ctx.modsDir)) {
      throw new Error(`找不到模组目录：${ctx.modsDir}\n游戏根目录可能不对，用 --game <路径> 指定。`);
    }
    return ctx;
  } catch (err) {
    console.error(`${err.message}\n\n用法：${usage}`);
    process.exit(1);
  }
}
