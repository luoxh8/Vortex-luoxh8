# 新增一个游戏的步骤

1. 把整个 `templates/game/` 目录复制到 `games/<你的游戏>/`。

2. 改 `games/<你的游戏>/game.json`：

   - `id`：命令行里 `--game` 用的名字（建议小写加连字符，如 `stardew-valley`）
   - `defaultDir`：游戏默认安装位置，路径里的反斜杠要写成 `\\`
   - `gameDirEnv`：可选，能用哪个环境变量覆盖路径
   - `modsDir`：模组目录相对游戏根目录的路径（这里写 `Mods`）
   - `sourceFile`：模组的默认语言文件叫什么（用来对齐键）
   - `targetFileTemplate`：目标语言文件名，必须含 `{lang}`
   - `languages`：支持哪些语言，`code` 是写进文件名的那个值

3. 建 `i18n/` 目录，放译文。文件名决定怎么应用：

   - `<模组>.json` —— 整份生成，键必须和 `sourceFile` 完全一致
   - `<模组>.patch.json` —— 只改写列出的键
   - `<模组>.append.json` —— 只追加列出的键

4. 确认无误后运行：

   ```bat
   node cli\scan.mjs    --game <你的游戏>
   node cli\apply.mjs   --game <你的游戏>
   node cli\verify.mjs  --game <你的游戏>
   ```

5. 可选：把该游戏的术语对照写进 `terms.md`，方便以后统一用词。

## 自检

`scan.mjs` 会在目标语言文件不存在时把整个模组标成待翻译，这正好可以用来确认
`game.json` 里的路径写对了——路径错了它会直接报「找不到模组目录」。
