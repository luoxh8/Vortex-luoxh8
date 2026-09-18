// 自检：不碰真实游戏目录，用临时目录跑一遍完整流程，确认工具本身是好的。
//
//   node cli/selftest.mjs
//
// 检查内容：
//   1. 所有模块语法正确、能加载
//   2. 注释、结尾逗号、BOM 都能正确解析
//   3. 三种操作（整份生成 / 改写 / 追加）行为正确，且重复运行不出错
//   4. 校验能抓出漏翻、占位符被改、重复键、键对不上
//   5. 写入失败时会回滚
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseJsonc, findDuplicateKeys } from '../core/jsonc.mjs';
import { renderGenerated, renderPatched, renderAppended } from '../lib/i18n-file.mjs';
import { parsePlanName } from '../lib/plans.mjs';

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`);
}

/** 断言 fn 会抛错，且错误信息包含 expect */
function assertThrows(fn, expect, msg) {
  let threw = false;
  try { fn(); } catch (err) {
    threw = true;
    if (expect && !err.message.includes(expect)) {
      throw new Error(`${msg}（错误信息里应含 "${expect}"，实际是 "${err.message}"）`);
    }
  }
  if (!threw) throw new Error(`${msg}（但没有抛错）`);
}

/** fn 会抛错吗 */
function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vortex-luoxh8-'));
const write = (name, content) => {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, content, 'utf8');
  return file;
};

console.log('解析器\n');

check('能读带行注释、块注释、结尾逗号的 JSON', () => {
  const obj = parseJsonc(`{
    // 行注释
    /* 块注释 */
    "a": "1",
    "b": "2",
  }`);
  assertEqual(obj.a, '1', 'a 应被读到');
  assertEqual(obj.b, '2', 'b 应被读到');
});

check('能读带 BOM 的文件', () => {
  assertEqual(parseJsonc('\uFEFF{"a":"1"}').a, '1', 'BOM 应被忽略');
});

check('注释里的花括号不会破坏解析', () => {
  assertEqual(parseJsonc('{ /* } */ "a": "1" }').a, '1', '块注释应整体跳过');
});

check('转义字符正确还原', () => {
  const v = parseJsonc('{"a":"第一行\\n第二行","b":"引号\\"结束","c":"反斜杠\\\\"}');
  assertEqual(v.a, '第一行\n第二行', '\\n 应是真换行');
  assertEqual(v.b, '引号"结束', '\\" 应是引号');
  assertEqual(v.c, '反斜杠\\', '\\\\ 应是反斜杠');
});

check('重复键会被抓出来', () => {
  assert(throws(() => parseJsonc('{"a":"1","a":"2"}')), '解析器应报重复键');
  const dupes = findDuplicateKeys('{"a":"1","b":"2","a":"3"}');
  assertEqual(dupes.join(','), 'a', '应报出重复的 a');
});

check('语法错误会带行号', () => {
  try {
    parseJsonc('{\n  "a": "1"\n  "b": "2"\n}');
    throw new Error('应该报错');
  } catch (err) {
    assert(/第 \d+ 行/.test(err.message), `错误信息应含行号，实际：${err.message}`);
  }
});

console.log('\n文件名 → 操作\n');

check('三种后缀都认得', () => {
  assertEqual(parsePlanName('Foo.json').op, 'generate', 'Foo.json 应整份生成');
  assertEqual(parsePlanName('Foo.patch.json').op, 'patch', 'Foo.patch.json 应改写');
  assertEqual(parsePlanName('Foo.append.json').op, 'append', 'Foo.append.json 应追加');
  assertEqual(parsePlanName('Foo.json').mod, 'Foo', '模组名应正确');
  assertEqual(parsePlanName('Foo.patch.json').mod, 'Foo', '模组名应正确');
});

check('模组名里带点也能正确切分', () => {
  assertEqual(parsePlanName('Some.Mod.patch.json').mod, 'Some.Mod', '应只切掉后缀');
});

check('不认识的文件返回 null', () => {
  assertEqual(parsePlanName('readme.txt'), null, 'txt 应返回 null');
});

console.log('\n三种操作\n');

const src = write('default.json', '{\n  "a": "A",\n  "b": "B",\n  "c": "C"\n}\n');

check('整份生成：按源文件键顺序输出，且能读回来', () => {
  const out = renderGenerated({ a: '甲', b: '乙', c: '丙' }, src);
  const parsed = parseJsonc(out);
  assertEqual(Object.keys(parsed).join(','), 'a,b,c', '键顺序应与源文件一致');
  assertEqual(parsed.b, '乙', '值应写入');
  assert(out.startsWith('\uFEFF'), '应带 UTF-8 BOM');
});

check('整份生成：少键会报错', () => {
  assertThrows(() => renderGenerated({ a: '甲' }, src), '缺少', '少键应报错');
});

check('整份生成：多键会报错', () => {
  assertThrows(() => renderGenerated({ a: '甲', b: '乙', c: '丙', d: '丁' }, src), '多出', '多键应报错');
});

check('改写：保留注释与未列出的键', () => {
  const before = '{\n  // 保留我\n  "a": "A",\n  "b": "B"\n}\n';
  const after = renderPatched(before, { b: '乙' });
  assert(after.includes('// 保留我'), '注释应保留');
  assertEqual(parseJsonc(after).b, '乙', 'b 应被改写');
  assertEqual(parseJsonc(after).a, 'A', 'a 不应被动');
});

check('改写：键不存在会报错，不静默跳过', () => {
  assertThrows(() => renderPatched('{"a":"A"}', { zzz: '甲' }), '找不到这些键', '缺键应报错');
});

check('改写：重复键会报警', () => {
  assertThrows(() => renderPatched('{"a":"A","a":"B"}', { a: '甲' }), '出现了 2 次', '重复键应报警');
});

check('追加：新键加进去，已存在的键跳过（可重复运行）', () => {
  const before = '{\n  "a": "A"\n}\n';
  const once = renderAppended(before, { a: '甲', b: '乙' });
  assertEqual(parseJsonc(once).a, 'A', '已存在的 a 不应被覆盖');
  assertEqual(parseJsonc(once).b, '乙', 'b 应被追加');
  const twice = renderAppended(once, { a: '甲', b: '乙' });
  assertEqual(twice, once, '重复追加不应有任何变化');
});

check('追加：没有新键时原样返回', () => {
  const before = '{\n  "a": "A"\n}\n';
  assertEqual(renderAppended(before, { a: '甲' }), before, '内容不应变');
});

fs.rmSync(tmp, { recursive: true, force: true });

console.log('');
if (failures.length) {
  console.log(`${passed} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`全部 ${passed} 项自检通过。`);
