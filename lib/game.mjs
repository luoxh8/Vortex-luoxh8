// 读 game.json：每个游戏一个，描述「模组的翻译文件长什么样、放在哪」。
//
// 有了这个文件，根目录的工具就不需要认识任何一个具体游戏。
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = ['id', 'name', 'defaultDir', 'modsDir', 'sourceFile', 'targetFileTemplate'];

/**
 * 读取并校验一个游戏配置。
 * @param {string} dir games/<id> 目录
 */
export function readGame(dir) {
  const file = path.join(dir, 'game.json');
  if (!fs.existsSync(file)) throw new Error(`不是有效的游戏目录（缺 game.json）：${dir}`);

  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`${file} 不是合法 JSON：${e.message}`); }

  const missing = REQUIRED.filter(k => !cfg[k]);
  if (missing.length) throw new Error(`${file} 缺少字段：${missing.join(', ')}`);
  if (!cfg.targetFileTemplate.includes('{lang}')) {
    throw new Error(`${file}: targetFileTemplate 里必须含 {lang} 占位符`);
  }

  return {
    ...cfg,
    dir,
    // 该语言对应的产物文件名，例如 zh.json
    targetFile: (lang) => cfg.targetFileTemplate.replace('{lang}', cfg.languages[lang]?.code ?? lang),
    // 模组 i18n 目录的绝对路径
    i18nDir: (gameRoot, mod) => path.join(...cfg.modsDir.split('/'), mod, 'i18n'),
  };
}

/** 列出 games/ 下所有游戏配置 */
export function listGames(gamesRoot) {
  if (!fs.existsSync(gamesRoot)) throw new Error(`找不到 games 目录：${gamesRoot}`);
  return fs.readdirSync(gamesRoot)
    .map(name => path.join(gamesRoot, name))
    .filter(dir => fs.existsSync(path.join(dir, 'game.json')))
    .map(readGame);
}

/**
 * 决定游戏根目录：命令行给的 > 环境变量 > 配置里的默认值。
 * @param {object} game
 * @param {string[]} cliPaths 用户在命令行里给的候选路径
 */
export function resolveGameRoot(game, cliPaths = []) {
  const fromEnv = game.gameDirEnv ? process.env[game.gameDirEnv] : undefined;
  const candidates = [...cliPaths, fromEnv, game.defaultDir]
    .filter(Boolean)
    .map(p => p.trim());

  for (const c of candidates) {
    if (fs.existsSync(joinMods(game, c))) return c;
  }
  return candidates[0] ?? game.defaultDir;
}

/** 模组目录的绝对路径 */
export function joinMods(game, gameRoot) {
  return path.join(gameRoot, ...game.modsDir.split('/'));
}
