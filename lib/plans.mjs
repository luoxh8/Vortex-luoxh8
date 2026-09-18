// 译文计划的公共逻辑：games/<游戏>/i18n/ 里的文件名 → 该做什么操作。
//
//   <模组>.json          整份生成
//   <模组>.patch.json    只改写列出的键
//   <模组>.append.json   只追加列出的键
//
// apply 和 restore 都用这一份，避免两处规则跑偏。
import fs from 'node:fs';
import path from 'node:path';
import { readJsonFile } from './i18n-file.mjs';

/** 解析一个文件名，返回 {op, mod}；不认识就返回 null */
export function parsePlanName(file) {
  if (!file.endsWith('.json')) return null;
  if (file.endsWith('.patch.json')) return { op: 'patch', mod: file.slice(0, -'.patch.json'.length) };
  if (file.endsWith('.append.json')) return { op: 'append', mod: file.slice(0, -'.append.json'.length) };
  return { op: 'generate', mod: file.slice(0, -'.json'.length) };
}

/** 读出数据目录里所有计划，按模组名排序 */
export function readPlans(dataDir) {
  if (!fs.existsSync(dataDir)) return [];
  return fs.readdirSync(dataDir)
    .map(file => {
      const parsed = parsePlanName(file);
      return parsed && { ...parsed, file, data: readJsonFile(path.join(dataDir, file)) };
    })
    .filter(Boolean)
    .sort((a, b) => a.mod.localeCompare(b.mod));
}
