// 公共工具：读写翻译文件、把译文写回模组。
// 这一层不认识任何具体游戏，只认 game.json 里描述的路径与文件名。

import fs from 'node:fs';
import path from 'node:path';
import { parseJsonc } from '../core/jsonc.mjs';

export function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 读一个 i18n 翻译文件（SMAPI 风格：JSON + 注释） */
export function readI18n(file) {
  return parseJsonc(fs.readFileSync(file, 'utf8'));
}

export const detectEol = (txt) => (txt.includes('\r\n') ? '\r\n' : '\n');

/** 列出某个游戏里所有带翻译文件的模组名 */
export function listMods(game, gameRoot) {
  const modsDir = path.join(gameRoot, ...game.modsDir.split('/'));
  if (!fs.existsSync(modsDir)) throw new Error(`找不到模组目录：${modsDir}`);
  return fs.readdirSync(modsDir).filter(name => {
    const i18n = path.join(modsDir, name, 'i18n');
    return fs.existsSync(path.join(i18n, game.sourceFile));
  });
}

/** 改写文件中已存在键的值，保留注释、排版与行尾风格。 */
export function patchValues(file, replacements) {
  const before = fs.readFileSync(file, 'utf8');
  const after = renderPatched(before, replacements);
  fs.writeFileSync(file, after, 'utf8');
  return Object.keys(replacements).length;
}

/**
 * 把新增的键追加到文件末尾（保留原文件的注释与排版）。
 * 已存在的键会跳过，所以重复运行是安全的。
 */
export function appendKeys(file, entries) {
  const before = fs.readFileSync(file, 'utf8');
  const after = renderAppended(before, entries);
  if (after !== before) fs.writeFileSync(file, after, 'utf8');
  return Object.keys(entries).filter(k => !new RegExp(`"${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`).test(before)).length;
}

/**
 * 按源文件（default.json）的键顺序生成一份完整的目标语言文件内容。
 * 译文必须与源文件键集完全一致，多一个少一个都报错。
 */
export function renderGenerated(translations, sourceFile) {
  const src = readI18n(sourceFile);
  const missing = Object.keys(src).filter(k => !(k in translations));
  const extra = Object.keys(translations).filter(k => !(k in src));
  if (missing.length) throw new Error(`缺少 ${missing.length} 个键 -> ${missing.join(', ')}`);
  if (extra.length) throw new Error(`多出这些键 -> ${extra.join(', ')}`);
  const eol = detectEol(fs.readFileSync(sourceFile, 'utf8'));
  const body = Object.entries(translations).map(([k, v], i, arr) =>
    `  ${JSON.stringify(k)}: ${JSON.stringify(v)}${i === arr.length - 1 ? '' : ','}`).join(eol);
  return '\uFEFF{' + eol + body + eol + '}' + eol;
}

/** 把整份译文写成目标语言文件 */
export function generate(target, translations, sourceFile) {
  fs.writeFileSync(target, renderGenerated(translations, sourceFile), 'utf8');
  return Object.keys(translations).length;
}

/** 在既有译文内容上改写指定的键，返回新内容（纯函数，不落盘） */
export function renderPatched(current, replacements) {
  let txt = current;
  const missed = [];
  for (const [key, value] of Object.entries(replacements)) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`("${esc}"\\s*:\\s*)("(?:[^"\\\\]|\\\\.)*")`, 'g');
    const hits = txt.match(re);
    if (!hits) { missed.push(key); continue; }
    if (hits.length > 1) throw new Error(`键 ${key} 出现了 ${hits.length} 次`);
    txt = txt.replace(re, (m, p1) => p1 + JSON.stringify(value));
  }
  if (missed.length) throw new Error(`找不到这些键 -> ${missed.join(', ')}`);
  return txt;
}

/** 在既有译文内容上追加新键，返回新内容（纯函数，不落盘）。已存在的键自动跳过 */
export function renderAppended(current, entries) {
  const existing = new Set([...current.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map(m => m[1]));
  const items = Object.entries(entries).filter(([k]) => !existing.has(k));
  if (!items.length) return current;

  const eol = detectEol(current);
  const idx = current.lastIndexOf('}');
  if (idx < 0) throw new Error('找不到结尾的右花括号');
  const lines = items.map(([k, v], i) =>
    `  ${JSON.stringify(k)}: ${JSON.stringify(v)}${i === items.length - 1 ? '' : ','}`);
  const head = current.slice(0, idx).replace(/\s*$/, '');
  const body = head + (head.endsWith('{') ? '' : ',') + eol + lines.join(eol) + eol;
  return body + current.slice(idx);
}
