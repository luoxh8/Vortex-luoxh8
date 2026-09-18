// 语言判定：怎么算「这条还没翻」。
//
// scan / verify / dump 三处必须用同一套规则，否则同一个文件在不同命令下会有
// 不同结论。这里集中定义，别在别处再写一份。

/** 中日韩文字（含扩展区、假名、谚文） */
export const CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

/** 取值里的占位符：{{名字}} 由模组替换，{0} {1} 由代码格式化 */
export const PLACEHOLDER = /\{\{[^}]+\}\}|\{\d+(?::[^}]*)?\}/g;

/**
 * 只由占位符和标点组成的「格式模板」吗？
 *
 * 判定标准：把 {{...}} 全部挖掉之后，**一个字母或数字都不剩**。
 *   "{{name}} #{{number}}"        → 是（界面上显示的是游戏内置的名字）
 *   "{{Current}} / {{Total}}"     → 是（显示的是页码数字）
 *   "{{Reaction}} • {{Sort}}"     → 是
 *   "{{name}} is ready"           → 不是（还有 is ready 要翻）
 *   "Send {{Gift}} to {{Npc}}?"   → 不是（还有 Send to 要翻）
 */
export function isPlaceholderOnly(value) {
  const v = String(value).trim();
  if (!/\{\{[^}]+\}\}/.test(v)) return false;
  return !/[A-Za-z0-9]/.test(v.replace(/\{\{[^}]+\}\}/g, ''));
}

/**
 * 原样保留、不该翻译的值。
 *   - 纯占位符 / 格式模板，如 "{{name}} #{{number}}"、"{{Current}} / {{Total}}"
 *   - 纯网址或纯标识符，如 "Modding:Player_Guide"
 */
export function isNotTranslatable(value) {
  const v = String(value).trim();
  if (!v) return false;
  if (isPlaceholderOnly(v)) return true;
  // 纯网址 / 纯标识符
  if (/^(https?:\/\/|www\.)\S+$/i.test(v)) return true;
  if (/^\S*[A-Za-z]+:\S+$/.test(v) && !v.includes(' ')) return true;
  return false;
}

/**
 * 这个值看起来还是没翻吗？
 * 判定：含拉丁字母、且不含中日韩文字、且不是「原样保留」的值。
 */
export function looksUntranslated(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (CJK.test(value)) return false;
  if (isNotTranslatable(value)) return false;
  return /[A-Za-z]{2,}/.test(value);
}

/**
 * 比较两个值的占位符是否一致。
 * 允许调换位置、允许重复，但不允许删掉或改拼写。
 */
export function placeholdersOf(value) {
  return (String(value).match(PLACEHOLDER) || []).sort().join('|');
}
