// 读取 SMAPI 风格的语言文件。
//
// SMAPI 的 i18n 文件是「JSON + 注释」：允许 // 行注释、/* */ 块注释和结尾多余逗号。
// 标准 JSON.parse 读不了，所以这里自己写一个最小解析器，不依赖任何第三方包。
//
// 支持范围（覆盖 SMAPI 模组的实际用法）：
//   行注释、块注释、结尾逗号、双引号字符串（含 \" \\ \n \t \uXXXX 转义）、
//   嵌套对象、字符串数组、数字、true/false/null。

const ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

class Reader {
  constructor(text) {
    this.text = text.replace(/^\uFEFF/, '');
    this.i = 0;
  }

  error(msg) {
    const line = this.text.slice(0, this.i).split('\n').length;
    return new Error(`第 ${line} 行: ${msg}`);
  }

  /** 跳过空白与注释 */
  skip() {
    for (;;) {
      const c = this.text[this.i];
      if (c === undefined) return;
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { this.i++; continue; }
      if (c === '/' && this.text[this.i + 1] === '/') {
        this.i += 2;
        while (this.i < this.text.length && this.text[this.i] !== '\n') this.i++;
        continue;
      }
      if (c === '/' && this.text[this.i + 1] === '*') {
        const end = this.text.indexOf('*/', this.i + 2);
        if (end < 0) throw this.error('块注释没有闭合');
        this.i = end + 2;
        continue;
      }
      return;
    }
  }

  parseString() {
    if (this.text[this.i] !== '"') throw this.error('期望一个字符串');
    this.i++;
    let out = '';
    for (;;) {
      const c = this.text[this.i];
      if (c === undefined) throw this.error('字符串没有闭合');
      if (c === '"') { this.i++; return out; }
      if (c === '\\') {
        const e = this.text[this.i + 1];
        this.i += 2;
        if (e === 'u') {
          out += String.fromCharCode(parseInt(this.text.slice(this.i, this.i + 4), 16));
          this.i += 4;
        } else if (e in ESCAPES) out += ESCAPES[e];
        else out += e;
        continue;
      }
      out += c;
      this.i++;
    }
  }

  parseValue() {
    this.skip();
    const c = this.text[this.i];
    if (c === '{') return this.parseObject();
    if (c === '[') return this.parseArray();
    if (c === '"') return this.parseString();
    for (const [word, value] of [['true', true], ['false', false], ['null', null]]) {
      if (this.text.startsWith(word, this.i)) { this.i += word.length; return value; }
    }
    const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(this.text.slice(this.i));
    if (m) { this.i += m[0].length; return Number(m[0]); }
    throw this.error(`无法识别的值: ${JSON.stringify(this.text.slice(this.i, this.i + 20))}`);
  }

  parseObject() {
    this.i++; // {
    const out = {};
    for (;;) {
      this.skip();
      if (this.text[this.i] === '}') { this.i++; return out; }
      const key = this.parseString();
      this.skip();
      if (this.text[this.i] !== ':') throw this.error(`键 ${key} 后面缺少冒号`);
      this.i++;
      if (key in out) throw this.error(`重复的键: ${key}`);
      out[key] = this.parseValue();
      this.skip();
      if (this.text[this.i] === ',') { this.i++; continue; }
      if (this.text[this.i] === '}') { this.i++; return out; }
      throw this.error(`键 ${key} 后面缺少逗号或右花括号`);
    }
  }

  parseArray() {
    this.i++; // [
    const out = [];
    for (;;) {
      this.skip();
      if (this.text[this.i] === ']') { this.i++; return out; }
      out.push(this.parseValue());
      this.skip();
      if (this.text[this.i] === ',') { this.i++; continue; }
      if (this.text[this.i] === ']') { this.i++; return out; }
      throw this.error('数组元素后面缺少逗号或右方括号');
    }
  }
}

/** 解析「JSON + 注释」文本 */
export function parseJsonc(text) {
  const r = new Reader(text);
  const value = r.parseValue();
  r.skip();
  if (r.i !== r.text.length) throw r.error('文件末尾有多余内容');
  return value;
}

/**
 * 列出文本里重复出现的键。
 * JSON 遇到重复键会悄悄保留最后一个，翻译时容易漏掉一条，所以单独查一遍。
 */
export function findDuplicateKeys(text) {
  const seen = new Map();
  const dupes = [];
  for (const m of text.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)) {
    const key = m[1];
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) dupes.push(key);
  }
  return dupes;
}
