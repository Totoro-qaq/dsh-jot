<p align="center">
  <img src="./assets/readme/jot-icon.svg" width="88" height="88" alt="随记的彩色书签图标">
</p>

<h1 align="center">随记 Jot</h1>

<p align="center"><strong>对话旁边的笔记本。</strong><br>想法、待办和轻文档随手记下，内容由你掌控；需要时再请 AI 帮忙整理。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-jot"><img src="https://img.shields.io/npm/v/dsh-jot?label=npm&color=3B8C76" alt="npm 版本"></a>
  <img src="https://img.shields.io/badge/DSH-rc.2%20%2B%20alpha.1-3B8C76" alt="DSH 0.2.0-rc.2 与 0.2.1-alpha.1">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-3B8C76" alt="MIT 许可"></a>
</p>

<p align="center">
  <a href="#安装">安装</a> · <a href="./docs/GUIDE.zh-CN.md">使用指南</a> · <a href="./CHANGELOG.md">更新记录</a> · <a href="./README.en.md">English</a>
</p>

![随记在真实 DSH Web UI 中的完整工作台：笔记列表、核对清单、表格、颜色和高亮](./assets/readme/workbench.jpg)

> **0.2.6 新增：** 空行输入 `/` 插入标题、清单和表格；聊天框输入 `/jot` 直接找到笔记；整库导出 Word、PDF 或 Markdown；一键撤销 AI 对已有笔记的修改。变化详见[更新记录](./CHANGELOG.md)。

## 为什么用随记

| 就在对话旁边 | 你来写，AI 来帮 | 数据在你手里 |
| --- | --- | --- |
| 左侧导航打开完整工作台；聊天时在右侧栏边聊边记，输入 `/jot` 就能找到笔记。 | AI 协作默认关闭。打开后只在你要求时读写；改过的笔记标出「AI 修改」，有修改前版本时可以撤回。 | 笔记存在本机的 DSH 数据目录，不上云；随时整库导出 Word、PDF 或 Markdown。 |

## 安装

```sh
# 桌面客户端
dsh plugin --profile desktop add dsh-jot

# DSH Web UI
dsh plugin --profile web add dsh-jot
```

重启 DSH，左侧导航会出现「随记」，点「新建」就能开始写。Desktop 和 Web 需要分别安装；官方桌面应用的菜单「管理 dsh 命令…」可以启用内置 CLI，CLI 需要 Node.js `^22.19.0 || >=24`。

**升级：** `dsh plugin --profile desktop add dsh-jot@latest` 后重启。**卸载：** `dsh plugin --profile desktop remove dsh-jot`，笔记不会随插件删除。Web 把 `desktop` 换成 `web`。

## 能做什么

**写起来顺手**

- 像普通文档一样写：标题、列表、可勾选的待办、引用、代码、表格、文字颜色和高亮，不需要会 Markdown。
- 在空行输入 `/` 唤出插入菜单，中文输入法下的 `、` 也可以；`/bt` 这样的拼音首字母也能找到「标题」。`# `、`- `、`[ ] ` 等写法同样会自动转换。
- 表格可以增删行列、拖动列宽；待办清单可以用快捷键勾选、调整顺序。

**找得到**

- 搜索标题和正文，标题命中排在前面，结果显示命中的那句话；当前笔记里可以查找和替换。
- 置顶、最近修改、可选的文件夹、排序和多选；列表直接显示清单进度，如 `2/5`。

**收得住**

- 选中的文字一键摘录到新笔记或当前笔记；粘贴截图、拖入文件，用 DSH 官方查看器预览 Word、表格、PDF 和图片。

**靠得住**

- 自动保存、草稿恢复，版本冲突时保留你写的内容；删除笔记（包括批量删除）都可以撤销，永久删除前会再确认。
- 单篇导出 Word、PDF、Markdown 或 TXT；也可以把全部笔记或一个文件夹打包成一个 ZIP，PNG／JPEG 图片直接嵌在 Word 和 PDF 里。

![真实 DSH 对话旁的随记右侧栏，可直接编辑标题、正文和清单](./assets/readme/sidebar.jpg)

## 和 AI 一起用

在列表底部打开「允许 AI 协作」，再明确告诉 AI 要读或改哪篇笔记，例如：

> 把刚才确认的三件事记到随记「周会」里。
>
> 把「会后待办」的第 2 项勾掉。

- AI 可以搜索、读取、新建和追加笔记，勾选单个待办，或把笔记移到回收站。每次调用都会检查开关，AI 无法自己打开权限。
- 整篇替换会拒绝丢掉表格、附件和颜色，除非你同意。
- AI 改过的笔记标出「AI 修改」。已有笔记保留修改前版本时，点一下可以撤销，回到 AI 改之前的样子；连续几次修改会一起撤销。AI 新建的笔记只有标记，不提供这项撤销。
- 笔记不会自动进入每轮对话，AI 只在用到工具时读取。

工具清单和 Markdown 写法见[使用指南](./docs/GUIDE.zh-CN.md#agent-协作)。

## 键盘快捷键

在随记里按 `?` 可以查看全部快捷键。常用的几个：

| 操作 | macOS | Windows／Linux |
| --- | --- | --- |
| 粗体／斜体／下划线 | ⌘B／⌘I／⌘U | Ctrl+B／I／U |
| 标题 1–3 | ⌥⌘1–3 | Ctrl+Alt+1–3 |
| 待办清单／勾选当前待办 | ⇧⌘9／⌘↩ | Ctrl+Shift+9／Ctrl+Enter |
| 上移／下移列表项 | ⌥⇧↑／⌥⇧↓ | Alt+Shift+↑／↓ |
| 当前笔记查找／立即保存 | ⌘F／⌘S | Ctrl+F／Ctrl+S |
| 搜索笔记库 | `/`（焦点不在输入框时） | 同左 |

「打开随记」「新建笔记」「摘录选中的文字」三条命令默认不占用任何按键，在 DSH 设置的键盘快捷键里搜索「随记」就能绑定。

## 常见问题

**和直接让 AI「记住」有什么区别？** 随记里的内容是你能看到、编辑和导出的文档，不会被悄悄改写，也不会注入每轮对话；AI 只在你打开开关并提出要求时才读写。

**卸载或升级会丢笔记吗？** 不会。笔记存在 DSH 数据目录里，与插件包分开，旧版本也能读取新版本保存的笔记。

**笔记存在哪里，怎么备份？** 默认在 `$DSH_HOME/jot`（未设置时为 `~/.dsh/jot`），备份时保留整个目录。使用同一数据目录的 Desktop 与 Web 共用笔记。附件默认单个 20 MiB、合计 500 MiB。

**为什么提示「还有保留的草稿」？** 另一个面板里有这篇笔记未保存的修改。打开它，载入最新版本或另存为新笔记后再继续，两边写的内容都不会丢。

## 兼容性

支持 DSH 0.2.0-rc.2（官方 macOS Desktop）与 0.2.1-alpha.1（Web）。Windows 和 Linux 通过 CI 源码检查，界面与快捷键尚未实机验收；每个版本的实际验收范围见[验证记录](./docs/VALIDATION.md)。暂不提供云同步、多人实时编辑、历史版本和绘图。

OMDSH 收录材料见[作者投稿声明](./docs/community/omdsh-intake.zh-CN.md)。这是现有 Profile Bundle 的元数据草案，不是市场审核通过或安装授权；不迁移仓库、不改变运行代码或兼容范围。

## 了解更多

- [使用指南](./docs/GUIDE.zh-CN.md)：附件与导出限制、AI 工具细节、数据备份和冲突处理。
- [功能清单](./PRODUCT.md)：产品约定、已实现功能和后续方向。
- [GitHub Releases](https://github.com/Totoro-qaq/dsh-jot/releases) · [npm](https://www.npmjs.com/package/dsh-jot) · [反馈问题](https://github.com/Totoro-qaq/dsh-jot/issues)

<details>
<summary>从源码构建</summary>

准备 Node.js `^22.19.0 || >=24` 和 pnpm 11：

```sh
git clone https://github.com/Totoro-qaq/dsh-jot.git
cd dsh-jot
pnpm install --frozen-lockfile
pnpm check            # 类型检查、测试和构建
pnpm dev              # 本地预览：http://127.0.0.1:4178
pnpm pack --pack-destination artifacts
dsh plugin --profile desktop add "$PWD/artifacts/dsh-jot-<版本>.tgz"
```

Web 使用 `--profile web`。修改 `src/client/icons.tsx` 后运行 `pnpm icons` 同步 `assets/icons`。

</details>

[MIT](./LICENSE) · PDF 内嵌字体使用 [SIL Open Font License](./assets/fonts/OFL.txt)。
