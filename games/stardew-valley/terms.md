# 星露谷物语（Stardew Valley / SMAPI）

## 基本信息

| 项目 | 值 |
|---|---|
| 模组加载器 | SMAPI |
| 模组目录 | `<游戏根目录>\Mods` |
| 语言文件 | 每个模组下的 `i18n\` 目录，源文件 `default.json`，中文文件 `zh.json` |
| 默认安装位置 | `D:\SteamLibrary\steamapps\common\Stardew Valley` |
| 覆盖路径的环境变量 | `SDV_DIR` |

**游戏内语言必须是中文**（`%APPDATA%\StardewValley\startup_preferences` 里的
`<languageCode>zh</languageCode>`），否则 SMAPI 不会加载 `zh.json`。

## 命令

```bat
node cli\scan.mjs    --game stardew-valley
node cli\apply.mjs   --game stardew-valley
node cli\verify.mjs  --game stardew-valley
node cli\restore.mjs --game stardew-valley --all
```

## 当前覆盖情况

15 个模组，共 1329 条。另外这几个没有可翻的界面文本：

- `Console Commands`、`Save Backup`：没有 i18n 文件。
- `Skull Cavern Elevator`：文字写死在编译好的 DLL 里（见下）。

| 模组 | 条数 | 当初的情况 | 数据文件 |
|---|---|---|---|
| Fishing Assistant 3 | 379 | 完全没有中文，全部新译 | `FishingAssistant.json` |
| CJB Cheats Menu | 153 | 补 4 处残留英文 | `.patch.json` |
| Tractor Mod | 142 | 补 2 处残留英文，并修正 1 处丢失的占位符 | `.patch.json` |
| Smart Building | 128 | 补齐新版新增的 6 条；另有 1 条纯网址保留原文 | `SmartBuilding.json` |
| Convenient Inventory | 123 | 旧译文是老版本机翻且带已删除选项，按当前版本重做 | `ConvenientInventory.json` |
| Chests Anywhere | 85 | 补 2 处（纯格式模板，实际无需翻译） | `.patch.json` |
| Mail Services Better Menu | 83 | 完全没有中文，全部新译 | `MailServicesBetterMenu.json` |
| Fast Animations | 79 | 原本已完整 | `FastAnimations.json` |
| Automate | 52 | 补 5 处残留英文 | `.patch.json` |
| Mail Services Mod | 33 | 补齐新版新增的 3 条 | `MailServicesMod.json` |
| CJB Item Spawner | 30 | 原本已完整 | `CJBItemSpawner.json` |
| Carry Chests | 29 | 中文文件整份是英文，全部翻译 | `CarryChests.json` |
| Resource Storage | 27 | 补 10 条缺失项 | `.append.json` |
| Generic Mod Config Menu | 17 | 补 2 处残留英文 | `.patch.json` |
| Recatch Legendary Fish | 13 | 补 8 处残留英文 | `RecatchLegendaryFish.json` |

## 翻不了的模组

**Skull Cavern Elevator**（骷髅洞穴电梯）：作者没有做多语言支持，界面上那几条配置文字
（`Elevator Step`、`ElevatorCostPerStep` 等）是直接写在源码里编译进 DLL 的，游戏目录
里没有语言文件可以改。要改只能反编译改 DLL，不划算也不可持续。如果很在意，建议去
Nexus 给作者留言请他加 i18n 支持。

## 术语表

按游戏官方简体中文的用词，不自己另起名字。查证来源是中文百科
（[wiki.biligame.com/stardewvalley](https://wiki.biligame.com/stardewvalley)）
的中英对照条目。

| 英文 | 中文 | 英文 | 中文 |
|---|---|---|---|
| Junimo Hut | 祝尼魔屋 | Fridge | 冰箱 |
| Mini-Fridge | 迷你冰箱 | Mill | 磨坊 |
| Hopper | 加料器 | Mini-Shipping Bin | 迷你出货箱 |
| Dresser | 梳妆台 | Chest | 箱子 |
| Auto-Grabber | 自动采集器 | Auto-Petter | 自动抚摸机 |
| Cask | 木桶 | Furnace | 熔炉 |
| Recycling Machine | 回收机 | Seed Maker | 种子生产器 |
| Crystalarium | 宝石复制机 | Charcoal Kiln | 煤炭窑 |
| Dehydrator | 烘干机 | Fish Smoker | 熏鱼机 |
| Bee House | 蜂房 | Lightning Rod | 避雷针 |
| Iridium Rod | 铱金鱼竿 | Advanced Iridium Rod | 高级铱金鱼竿 |
| Sonar Bobber | 声纳浮漂 | Quality Bobber | 优质浮标 |
| Trap Bobber | 陷阱浮标 | Cork Bobber | 软木塞浮标 |
| Barbed Hook | 倒刺钩 | Spinner | 旋式鱼饵 |
| Wild Bait | 万能鱼饵 | Magic Bait | 魔法鱼饵 |
| Challenge Bait | 挑战鱼饵 | Deluxe Bait | 高级鱼饵 |
| Fairy Dust | 仙尘 | Treasure Chest | 财宝箱 |
| Milk Pail | 挤奶桶 | Shears | 剪刀 |
| Watering Can | 喷壶 | Pickaxe | 十字镐 |
| Mega Bomb | 超级炸弹 | Starfruit | 杨桃 |
| Legendary Fish | 传说鱼类 | Catch limit | 捕捉次数 |

界面通用词：Quick Stack = 快速堆叠，Tackle = 渔具，Tractor = 拖拉机，
Overburdened = 负重过度，Keybind = 按键 / 快捷键。

好感度相关（邮件服务系列）：Love = 最爱，Like = 喜欢，Neutral = 一般，
Dislike = 不喜欢，Hate = 讨厌；Friendship = 好感度，heart = 颗心。

礼物品质：normal = 普通，silver = 银星，gold = 金星，iridium = 铱星。

## 注意

- **纯占位符模板不要翻**。例如 Chests Anywhere 的 `default-name.other` 值是
  `{{name}} #{{number}}`、Automate 的 `config.chest-override.name` 值是
  `{{chestName}}`。界面上的箱子名走的是游戏内置物品名，游戏本身会翻；硬翻反而出错。
- **`i18n` 里的键名和物品内部名必须保持英文**。Automate 的
  `config.custom-connectors.desc` 明确要求填 `"Wood Path"`、`"(O)405"` 这类内部名，
  译文里只能解释、不能替换。
- 这些模组都装的 `Generic Mod Config Menu`，游戏里改配置时的选项名就来自这些语言文件。
- 文件带 UTF-8 BOM，游戏靠它认编码，保存时别丢。

## 已知情况

Vortex 每次 Purge / Deploy 都可能把模组的 `i18n` 覆盖回英文，重跑
`node cli\restore.mjs --game stardew-valley --all` 即可。同一时刻它还会把模组
DLL 变成 0 字节——那属于 Vortex 部署本身的问题，跟译文无关。

`backup/applied-*` 会自动生成，可以清；`backup/original-en` 和 `backup/original-zh`
是长期资产，别删。
