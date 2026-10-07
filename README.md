<p align="center"><img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/assets/readme/jot-icon.svg" width="56" height="56" alt="Jot"></p>

<h1 align="center">随记 Jot</h1>

<p align="center"><strong>对话旁边的笔记本。</strong><br>给 DeepSeek Harness 的笔记插件。自己写、随手勾，也能让 AI 把聊定的事记下来。</p>

<p align="center"><a href="#开始使用">安装</a> · <a href="./docs/GUIDE.zh-CN.md">使用指南</a> · <a href="./README.en.md">English</a></p>

![在真实 DSH 对话里请 AI 把周会分工记入随记，右侧出现三项待办和 AI 修改标记，再由人勾选一项](https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/jot-demo-zh.gif)

<sub>真实 DSH 操作，生成等待已加速；演示中的人物与事项为虚构。</sub>

## 周会聊完，分工已经在笔记里

林可周四交设计，陈默周五联调，许晨周日回归。聊定之后说一句「把刚才定的三件事记到随记『周会』，写上负责人」，右边就能接着看、改、勾选。

平时也可以直接写笔记，插入表格、图片和附件；找旧内容时，搜标题或正文都行，文件夹按自己的习惯建。

## AI 帮忙整理，你保留最后一笔

「允许 AI 协作」默认关闭，需要它参与时再打开。AI 改过的已有笔记会标出「AI 修改」；不合意，点这个标记撤销这一轮改动，接着自己写。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/undo-zh-dark.png">
  <img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/undo-zh-light.png" width="600" alt="点击周会笔记上的 AI 修改，确认撤销这一轮 AI 改动">
</picture>

## 旧笔记带进来，整理好了带出去

旧笔记不用从头抄。选择 Obsidian 的 Markdown 笔记库、整个文件夹或一批 TXT 导入，笔记引用的图片和附件一起带上。周会后导出一份 Word 或 PDF 发给同事；也可以导出 Markdown、TXT，或把整个笔记库打包为可恢复的 ZIP。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/transfer-zh-dark.png">
  <img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/transfer-zh-light.png" width="1100" alt="随记的笔记库菜单同时提供导入笔记与导出这些笔记，旁边是完整的周会内容">
</picture>

## 开始使用

```sh
# 桌面客户端
dsh plugin --profile desktop add dsh-jot

# Web UI
dsh plugin --profile web add dsh-jot
```

重启 DSH，点左侧「随记」开始写。聊天时输入 `/jot`，就能在右边打开、新建或找到一篇笔记。

Desktop 和 Web 分别安装；官方桌面应用可在菜单「管理 dsh 命令…」中启用内置 CLI。CLI 需要 Node.js `^22.19.0 || >=24`。升级、卸载和源码构建见[使用指南](./docs/GUIDE.zh-CN.md#安装升级与卸载)。

<details>
<summary>兼容性与数据</summary>

支持 DSH 0.2.0-rc.2 与 0.2.1-alpha.1。已在官方 macOS Desktop 和 DSH Web 中验收；Windows／Linux 通过 CI 源码检查，原生界面与快捷键尚未实机验收。各版本的具体范围见[验证记录](./docs/VALIDATION.md)。

笔记保存在 DSH 的本地数据目录，与插件包分开，卸载插件会保留笔记。AI 工具读取的内容会进入当前模型对话；不使用 AI 时也能正常写笔记。当前没有云同步、多人实时编辑、完整版本历史或绘图。AI 撤销、附件预览、导入导出和备份的具体范围见[使用指南](./docs/GUIDE.zh-CN.md)。

</details>

[快捷键](./docs/GUIDE.zh-CN.md#快捷键) · [AI 协作](./docs/GUIDE.zh-CN.md#agent-协作) · [数据与备份](./docs/GUIDE.zh-CN.md#数据与冲突) · [反馈问题](https://github.com/Totoro-qaq/dsh-jot/issues)

[版本更新](https://github.com/Totoro-qaq/dsh-jot/releases) · [npm](https://www.npmjs.com/package/dsh-jot) · [MIT](./LICENSE) · [字体许可](./assets/fonts/OFL.txt)
