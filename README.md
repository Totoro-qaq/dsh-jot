<p align="center"><img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/assets/readme/jot-icon.svg" width="64" height="64" alt=""></p>

<h1 align="center">随记 Jot</h1>

<p align="center"><strong>对话旁边的笔记本。</strong><br>在 DeepSeek Harness 里边聊边记，也能让 AI 把讨论结果记进笔记。</p>

<p align="center"><a href="#安装">安装</a> · <a href="./docs/GUIDE.zh-CN.md">使用指南</a> · <a href="./CHANGELOG.md">更新记录</a> · <a href="./README.en.md">English</a></p>

![在 DSH 对话里让 AI 把周会分工记进随记：右侧笔记出现三条待办和「AI 修改」标记，随后勾掉一条](https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/jot-demo-zh.gif)

## 能做什么

- **边聊边记**：随记就开在对话右侧，输入 `/jot` 可以打开、新建或找到一篇笔记；要写长一点的内容，从左侧导航进入完整页面。
- **像文档一样写**：标题、清单、表格、图片和附件都有，不用会 Markdown。空行输入 `/` 插入内容，按 `?` 查看全部快捷键。
- **让 AI 帮忙**：打开 AI 协作后，AI 可以查找、新建和修改笔记；它改过的地方会标出来，不满意可以撤回。
- **找得到**：标题和正文都能搜。常用的置顶，按文件夹归类，清单在列表里直接显示完成进度。
- **导入导出**：可以导入 Obsidian 等 Markdown 笔记；整个笔记库能导出成 Word、PDF 或 Markdown，导出的压缩包还能原样导回来。
- **存在本机**：笔记保存在 DSH 的数据目录里，不上传云端，卸载插件也不会删除。

## 和 AI 一起用

AI 协作默认关闭，在笔记列表底部打开。之后直接在对话里说：

> 把刚才定的三件事记到随记「周会」，写上负责人。
>
> 把「周会」里的第一条待办勾掉。

AI 只改需要改的地方：改几个字，就只换那几个字，原来的标题、列表和颜色都会保留。AI 改过的已有笔记会标上「AI 修改」，点一下就能撤回这一轮修改。

协作关闭时，随记不会出现在对话可用的工具里；打开以后，AI 也只在你提出要求时才读笔记。

## 安装

```sh
# 桌面客户端
dsh plugin --profile desktop add dsh-jot

# DSH Web
dsh plugin --profile web add dsh-jot
```

装好后重启 DSH，左侧导航会多出「随记」。桌面版和 Web 版需要分别安装。还没有 `dsh` 命令的话，可以在官方桌面应用的菜单「管理 dsh 命令…」里安装，需要 Node.js `^22.19.0 || >=24`。

升级、卸载和备份的方法见[使用指南](./docs/GUIDE.zh-CN.md#安装升级与卸载)。

## 常见问题

**笔记存在哪里？** 默认在 `~/.dsh/jot`；设置了 `DSH_HOME` 时在 `$DSH_HOME/jot`。桌面版和 Web 版指向同一个目录时，笔记是共用的。

**卸载或升级会丢笔记吗？** 不会，笔记和插件分开存放。

**能从 Obsidian 搬过来吗？** 能。在列表的「排序与选项」里选「导入笔记」，选中整个笔记库文件夹即可，图片和附件会一起导入。

## 兼容性

支持 DSH 0.2.0-rc.2（官方 macOS 桌面版）和 0.2.1-alpha.1（Web）。Windows 和 Linux 只做过源码检查，还没有在真机上验收；每个版本实际测过哪些内容，见[验证记录](./docs/VALIDATION.md)。

---

[使用指南](./docs/GUIDE.zh-CN.md) · [更新记录](./CHANGELOG.md) · [反馈问题](https://github.com/Totoro-qaq/dsh-jot/issues) · [npm](https://www.npmjs.com/package/dsh-jot)

[MIT](./LICENSE) · PDF 导出内嵌的字体使用 [SIL Open Font License](./assets/fonts/OFL.txt)
