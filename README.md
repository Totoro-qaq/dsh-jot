<p align="center"><img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/assets/readme/jot-icon.svg" width="64" height="64" alt=""></p>

<h1 align="center">随记 Jot</h1>

<p align="center"><strong>对话旁边的笔记本。</strong><br>在 DeepSeek Harness 里边聊边记，也能让 AI 把讨论结果记进笔记。</p>

<p align="center"><a href="#安装">安装</a> · <a href="./docs/GUIDE.zh-CN.md">使用指南</a> · <a href="./CHANGELOG.md">更新记录</a> · <a href="./README.en.md">English</a></p>

<p align="center"><a href="#discover"><img src="https://img.shields.io/badge/Discover-%E6%B7%BB%E5%8A%A0%E6%BA%90-2563eb" alt="Discover · 添加源"></a></p>

![在 DSH 对话里让 AI 把周会分工记进随记：右侧笔记出现三条待办和「AI 修改」标记，随后勾掉一条](https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/jot-demo-zh.gif)

## 能做什么

- **边聊边记**：随记就开在对话右侧，输入 `/jot` 可以打开、新建或找到一篇笔记；要写长一点的内容，从左侧导航进入完整页面。
- **像文档一样写**：标题、清单、表格、链接、图片和附件都有，不用会 Markdown。空行输入 `/` 插入内容，按 `?` 查看全部快捷键。
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

### npm / CLI

```sh
# 桌面客户端
dsh plugin --profile desktop add dsh-jot

# DSH Web
dsh plugin --profile web add dsh-jot
```

装好后重启 DSH，左侧导航会多出「随记」。桌面版和 Web 版需要分别安装。还没有 `dsh` 命令的话，可以在官方桌面应用的菜单「管理 dsh 命令…」里安装，需要 Node.js `^22.19.0 || >=24`。

DSH 0.2.1-alpha.3 Web 升级需先移除随记再重新安装，笔记和附件保留；CLI 操作前先停止对应 Host。官方 macOS Desktop 已验收版本仍为 0.2.0-rc.2，使用自己的 Profile 和内置 CLI。具体升级、卸载和备份方法见[使用指南](./docs/GUIDE.zh-CN.md#安装升级与卸载)。

### Discover

DSH 从 0.2.1-alpha.4 起引入自定义插件市场，也可以通过 Discover 安装：

1. 打开 **插件 → 实验性插件 → 更多**，启用 **自定义插件市场**。
2. 进入 **发现（Discover）→ 添加索引源**，粘贴 `https://raw.githubusercontent.com/Totoro-qaq/dsh-plugin-index/main/index.json`。
3. 选择 **随记 Jot**，核对包名 `dsh-jot`、版本和 npm 来源 `https://registry.npmjs.org/`，确认安装后点 **立即启用**。

这是[作者维护的第三方源](https://github.com/Totoro-qaq/dsh-plugin-index)，不代表 DSH 官方认证或社区审核，不会自动添加给所有用户。本次 Discover 流程在隔离的 alpha.4 WebHost 验收，未新增原生桌面验收；看不到 Discover 时，继续用上面的 npm 方式安装即可。

## 常见问题

**笔记存在哪里？** 默认在 `~/.dsh/jot`；设置了 `DSH_HOME` 时在 `$DSH_HOME/jot`。桌面版和 Web 版指向同一个目录时，笔记是共用的。

**卸载或升级会丢笔记吗？** 不会，笔记和插件分开存放。

**能从 Obsidian 搬过来吗？** 能。在列表的「排序与选项」里选「导入笔记」，选中整个笔记库文件夹即可，图片和附件会一起导入。

## 兼容性

Jot **0.2.13** 支持官方 DSH 0.2.1-alpha.3 Web。Host/Client 运行时与本轮受测的 0.2.12 开发候选包字节一致：与 Bridge 共同完成编辑、搜索、待办、表格、附件与导出验收，禁用恢复、同业务字节卸载重装和正常重启也保留了笔记及附件。具体受测包身份和范围见[验证记录](./docs/VALIDATION.md#0213--dsh-021-alpha3-web-compatibility)。

此前已验收 DSH 0.2.0-rc.2（官方 macOS 桌面版）和 0.2.1-alpha.1 / alpha.2（Web）。本轮未新增 alpha.3 原生桌面、桌面字号快捷键、Windows/Linux 真机或任意其他插件组合的验收，也未认证不同业务代码的热替换。

---

[使用指南](./docs/GUIDE.zh-CN.md) · [更新记录](./CHANGELOG.md) · [反馈问题](https://github.com/Totoro-qaq/dsh-jot/issues) · [npm](https://www.npmjs.com/package/dsh-jot)

[MIT](./LICENSE) · 客户端打包的第三方代码见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) · PDF 导出内嵌的字体使用 [SIL Open Font License](./assets/fonts/OFL.txt)
