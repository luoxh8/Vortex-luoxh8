# Vortex-luoxh8

把游戏模组的界面文本翻成中文，并且**保证译文不会被 Vortex 的重新部署冲掉**。

核心工具跟具体游戏无关——它只认一个描述性的 `game.json`；每个游戏的译文、术语表和
备份各自放在 `games/<游戏>/` 下。目前只有星露谷物语（SMAPI 模组）。

- 不带任何第三方依赖，只用 Node 内置模块。
- 改之前自动备份，改完自动校验，校验不过自动回滚。
- 重复运行安全（幂等），Vortex 覆盖多少次就还原多少次。

## 目录结构

```
core/jsonc.mjs          解析「JSON + 注释」的语言文件（JSON.parse 读不了这种）
lib/game.mjs            读 game.json、定位游戏目录
lib/i18n-file.mjs       读写翻译文件、整份生成 / 改写 / 追加
lib/plans.mjs           文件名 → 该做什么操作（apply 与 restore 共用同一份规则）
cli/_common.mjs         命令行公共部分（参数解析、定位游戏与语言）
cli/scan.mjs            ① 盘点：还有哪些没翻
cli/apply.mjs           ② 应用：把译文写回游戏（备份 → 写入 → 快照 → 校验）
cli/verify.mjs          ③ 校验：键对齐、占位符完好、无重复键、无漏翻
cli/restore.mjs         ④ 还原：Vortex 覆盖后按数据重算并拷回
cli/selftest.mjs        ⑤ 自检：不碰游戏，用临时目录验证工具本身（17 项）

games/<游戏>/
  game.json             这个游戏的路径与文件名规则
  i18n/                 译文数据（唯一事实来源，改译文改这里）
  <语言>/               成品快照，例如 zh/ 下每个模组一份（apply 时自动更新，供翻看/对比）
  backup/               原始文件与改动前的版本
  terms.md              术语表（可选）
templates/game/         新增一个游戏时的骨架
```

## 快速开始

```bat
:: 星露谷物语
node cli\scan.mjs    --game stardew-valley          :: 看看还缺什么
node cli\apply.mjs   --game stardew-valley          :: 把译文写回游戏
node cli\verify.mjs  --game stardew-valley          :: 只检查，不改动
node cli\restore.mjs --game stardew-valley --all    :: 覆盖后整份还原

:: 工具本身好不好用（不碰游戏）
node cli\selftest.mjs
```

游戏装的位置和默认的不一样时，用 `--game <路径>` 直接给游戏根目录：

```bat
node cli\apply.mjs --game "E:\Steam\steamapps\common\Stardew Valley"
```

`--game` 既可以给游戏 id，也可以给游戏根目录；位置参数里给一个存在的目录同样认。
也可以设环境变量（星露谷是 `SDV_DIR`）。加 `--help` 看用法。

`npm run sdv:apply` 这类快捷方式见 `package.json`。

## 译文数据怎么组织

`games/<游戏>/i18n/` 下的文件名决定怎么应用，三种后缀：

| 文件名 | 动作 | 什么时候用 |
|---|---|---|
| `<模组>.json` | 整份生成 | 模组原本没有目标语言文件，或旧译文太烂要重做 |
| `<模组>.patch.json` | 只改写列出的键 | 模组自带译文，只补几处漏翻的 |
| `<模组>.append.json` | 只追加列出的键 | 模组更新后多了新条目 |

`.patch.json` / `.append.json` 的内容就是一个普通的键值对：

```json
{
  "tabs.skills": "技能",
  "weather.cannot-change-weather": "游戏已强制明天的天气为{{weather}}，因此无法更改。"
}
```

整份生成的文件必须和模组的默认语言文件**键完全一致**，多一个少一个都会报错——这是
故意的，宁可失败也不要静默漏翻。

`<语言>/` 下的成品快照是 `apply` 跑完自动从游戏目录复制的，不用手工维护；它只是给你
直接翻看和做 diff 用。**改译文永远改 `i18n/`**，否则下次 apply 就被盖掉了。

## 新增一个游戏

1. 复制 `templates/game/` 到 `games/<新游戏>/`。
2. 改 `game.json`：模组目录在哪、源文件叫什么、目标文件叫什么、有哪几种语言。
3. 把译文放进 `i18n/`，文件名按上面三种后缀。
4. 跑 `node cli/apply.mjs --game <新游戏>`。

`game.json` 的字段：

| 字段 | 说明 |
|---|---|
| `id` | 命令行里 `--game` 用的名字 |
| `name` / `nameEn` | 显示用 |
| `defaultDir` | 游戏默认安装位置 |
| `gameDirEnv` | 可用哪个环境变量覆盖路径 |
| `modsDir` | 模组目录相对游戏根目录的路径，如 `Mods` |
| `sourceFile` | 源语言文件名，如 `default.json` |
| `targetFileTemplate` | 目标文件名模板，必须含 `{lang}`，如 `{lang}.json` |
| `defaultLang` | 不指定 `--lang` 时用哪个 |
| `languages` | `{ zh: { code: "zh", name: "简体中文" } }`，`code` 是写进文件名的那个 |

## 工具做了什么保证

`apply.mjs` 的顺序是：**备份 → 写入 → 整体校验**。

- 写入前把原文件复制到 `backup/applied-<时间戳>/`。
- 有任何一个模组写失败，就删掉本次新建的文件并退出，不会留下半拉子状态。
- 写完对本次涉及的模组跑一遍完整校验；不过就报错退出（改动保留，便于排查）。

`verify.mjs` 检查五件事：

1. 目标文件能被解析（带注释的 JSON 也认）。
2. 源文件和译文里都没有**重复键**——重复键会被 JSON 悄悄保留最后一个，最容易导致漏翻。
3. 键和源文件完全对齐，不多不少。
4. **占位符没被动过**：`{{名字}}` 由模组替换、`{0}` `{1}` 由代码格式化，可以调换位置、
   可以重复用，但不能删、不能改拼写。
5. 没有漏翻的条目（值里还是拉丁字母、且不含中文）。

## 为什么需要这套东西

Vortex 每次 Purge / Deploy 都可能把模组的 `i18n` 目录覆盖回英文（它还会顺手把模组
DLL 变成 0 字节，那属于 Vortex 部署本身的问题，跟译文无关）。手工改的译文很难留住，
所以这里把译文单独存一份、并做成一条命令就能还原。

## 许可

MIT
