<p align="center">
  <img src="./assets/readme/jot-icon.svg" width="80" height="80" alt="随记的笔记本图标">
</p>

<h1 align="center">随记 / Jot</h1>

<p align="center">在 DSH 里直接写笔记、待办和轻文档，按需要让 agent 一起维护。</p>

<p align="center">
  中文 · <a href="./README.en.md">English</a> · <a href="./docs/GUIDE.zh-CN.md">使用指南</a> · <a href="./docs/VALIDATION.md">验证记录</a> · <a href="./LICENSE">MIT</a>
</p>

**0.2.4** · 验证宿主 **DeepSeek Harness 0.2.0-rc.2** · [更新记录](https://github.com/Totoro-qaq/dsh-jot/releases)

![随记在真实 DSH Web UI 中的完整工作台：笔记列表、核对清单、表格、颜色和高亮](./assets/readme/workbench.png)

*完整页用来浏览和整理，右侧栏用来边聊边记。截图为真实宿主中的示例笔记；文件夹名称由用户自行决定。*

## 从一句想法开始

- **直接写。** 段落、标题、粗体、斜体、下划线、核对清单、表格、文字颜色和高亮，无需输入 Markdown 语法。表格支持增删行列、末尾「＋」追加、列宽拖动和自动适应宽度。
- **随手找。** 搜索笔记标题和正文，在笔记内查找与替换，置顶常用笔记，查看最近修改；文件夹按需创建，也可以排序、多选、移动和复制。
- **把资料留下。** 摘录文字，添加图片与文件。附件复用 DSH 官方查看器，支持 Word／PPT、表格、图片、PDF 和文本预览；有桌面环境时，可用默认应用打开。
- **安心接着写。** 自动保存并保留恢复草稿，遇到版本冲突时提醒；删除的笔记进入回收站。
- **带到别处。** 支持导出为 Markdown、TXT、PDF 或 Word（DOCX）；包含附件的 Markdown 导出为可离线使用的 ZIP 压缩包。

彩色笔记本是随记的入口；操作图标保持统一，字体、字号缩放与主题跟随 DSH。

## 安装并写下第一条笔记

安装到需要使用的 Profile：

```sh
# 桌面客户端
dsh plugin --profile desktop add dsh-jot

# DSH Web UI
dsh plugin --profile web add dsh-jot
```

安装后重启对应 Host。Desktop 和 Web 的插件安装相互独立；官方桌面应用菜单「管理 dsh 命令…」可启用内置 CLI。当前验证版本为 DSH 0.2.0-rc.2；CLI 的 Node.js 要求为 `^22.19.0 || >=24`。

1. 点击左侧「随记」，新建笔记。完整工作台不需要先选会话。
2. 选中会话后，在右侧栏的新标签页指引中打开「随记」，把重点记在对话旁边。
3. 想请 AI 帮忙时，打开「允许 AI 协作」，再明确告诉它读取或维护哪篇笔记。

## 对话旁边，留一点地方给笔记

![真实 DSH 对话旁的随记右侧栏，可直接编辑标题、正文和清单](./assets/readme/sidebar.png)

右侧栏的标签页、浮出和停靠由 DSH 管理；可以放大到完整页继续编辑。随记使用独立入口和局部样式，字体与主题跟随宿主。

**AI 协作默认关闭。** 开启后，agent 可以搜索、读取、创建、修改笔记或将其移到回收站；每次调用都检查最新开关。笔记由人控制，也不会自动注入每轮对话或自动生成总结。

## 常用快捷键

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 复制／剪切／粘贴／全选 | ⌘C / X / V / A | Ctrl+C / X / V / A |
| 撤销／重做 | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Shift+Z，另支持 Ctrl+Y |
| 粗体／斜体／下划线 | ⌘B / I / U | Ctrl+B / I / U |
| 当前笔记查找／保存 | ⌘F / S | Ctrl+F / S |

## 数据与当前范围

数据保存在本地 `$DSH_HOME/jot`，未设置时为 `~/.dsh/jot`。备份时保留整个目录；界面的恢复草稿另保存在 Local Storage。人和 agent 的修改都会检查版本，避免静默覆盖。

附件默认单文件 20 MiB、全库 500 MiB。官方预览需要选中会话及对应查看器；从完整工作台预览会切回该会话，没有会话时保留图片／PDF 弹窗和下载。默认应用打开的是 DSH 主机上的附件副本，外部修改需另存后重新添加。当前不提供云同步、多人实时协作、绘图或历史版本；导出不保证与编辑器逐像素一致。

0.2.4 增加官方附件预览与应用打开，已通过本地类型检查、197 项测试、构建及打包检查。真实 DSH Web UI 验收了 Word、CSV、PDF、TXT；默认应用打开在 macOS 文本编辑中实测成功。CI 配置覆盖 Linux、macOS 和 Windows，具体结果和历史桌面验收见[验证记录](./docs/VALIDATION.md)。Windows/Linux 应用打开尚未实机验收；完整原生输入法、剪贴板、长期稳定性和具体第三方插件组合仍需继续验证。

## 继续了解

- [GitHub Releases](https://github.com/Totoro-qaq/dsh-jot/releases) · [npm 包](https://www.npmjs.com/package/dsh-jot) · [反馈问题](https://github.com/Totoro-qaq/dsh-jot/issues)
- [使用指南](./docs/GUIDE.zh-CN.md)：AI 工具、附件与导出限制、数据备份、冲突和开发预览。
- [功能清单](./PRODUCT.md)：已实现功能、产品约定和后续候选。
- [验证记录](./docs/VALIDATION.md)：实际宿主、快捷键和插件共存的测试范围。

<details>
<summary>从源码构建</summary>

准备 Node.js `^22.19.0 || >=24` 和 pnpm 11：

```sh
git clone https://github.com/Totoro-qaq/dsh-jot.git
cd dsh-jot
pnpm install --frozen-lockfile
pnpm check
pnpm pack:check
pnpm pack --pack-destination artifacts
dsh plugin --profile desktop add /absolute/path/to/dsh-jot/artifacts/dsh-jot-0.2.4.tgz
```

将最后一行替换为实际文件路径；Web 使用 `--profile web`。

</details>

[MIT](./LICENSE) · PDF 内嵌字体使用 [SIL Open Font License](./assets/fonts/OFL.txt)。
