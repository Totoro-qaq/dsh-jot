# 社区目录收录

项目：[Totoro-qaq/dsh-jot](https://github.com/Totoro-qaq/dsh-jot) · npm：[`dsh-jot`](https://www.npmjs.com/package/dsh-jot)。

本页记录收录方式与提交材料；准备、提交和已收录是不同状态。状态核对日期：2026-10-04。

| 入口 | 当前状态 |
| --- | --- |
| dsh-market / Awesome DSH Plugin | [PR #6500](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6500) 已提交，等待检查和维护者审核 |
| dshfind | [已公开收录](https://dshfind.com/zh/plugins/Totoro-qaq/dsh-jot)，当前索引识别 0.2.3，后续版本等待同步 |
| DSH Directory | [Issue #334](https://github.com/alexchenzl/dsh-plugin-directory/issues/334) 仍开放，官网搜索尚无结果 |
| DSH Plugin Store | 当前公开目录尚未展示随记；下方保留网站表单材料 |

安装包通过 [GitHub Releases](https://github.com/Totoro-qaq/dsh-jot/releases) 与 [npm](https://www.npmjs.com/package/dsh-jot) 分发；npm 默认安装 `latest`。发行版本、验证结果和社区目录同步各自核对。

## dsh-market / Awesome DSH Plugin

市场读取 [Awesome DSH Plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的目录，插件条目不应向 dsh-market 应用仓库提交。按[贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)，只新增 `data/plugins/Totoro-qaq__dsh-jot.yml`：

```yaml
url: https://github.com/Totoro-qaq/dsh-jot
name: Totoro-qaq/dsh-jot
category: ui
description:
  en: Adds a human-editable notes workspace with folders, full-text search, rich text, checklists, resizable tables, attachments, exports, and opt-in agent collaboration.
  zh: 提供可直接编辑的笔记空间，支持文件夹、全文搜索、富文本、核对清单、可调整列宽的表格、附件、导出和可选的 Agent 协作。
tarball: https://github.com/Totoro-qaq/dsh-jot/releases/latest/download/dsh-jot.tgz
```

分类 `ui` 对应用户直接使用的笔记工作台。目录自动从 npm 的 `repository` 字段关联包，YAML 不添加 `npm:`。预构建 Release 资产保持固定名称 `dsh-jot.tgz`，以免下一次发布后 `latest/download` 链接失效。

截图在本仓库根目录的 [`screenshots.json`](../screenshots.json) 声明，指向真实宿主中的示例内容截图；按目录规则只使用仓库内相对路径。后续更新图片不需要另开收录 PR。

仓库需创建满 1 天。新仓库的年龄检查暂时不通过时，[检查器](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/scripts/check-submission.mjs) 与[重新检查工作流](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/.github/workflows/regate.yml)会自动复检，不必关闭重开 PR 或推送空提交。CI 通过后仍需维护者审阅，不能当作已经收录。

## dshfind

按[作者说明](https://github.com/hikariming/dshfind#submit-your-plugin)，公开仓库添加 `dsh-plugin` topic 即可，每天 02:17 UTC（北京时间 10:17）同步，无需收录 PR。通常约一天可出现；两次同步后仍未出现，可到作者仓库反馈。

GitHub 简介、topics、`package.json` 的 `dsh.bundle`、公开稳定 npm 版本及正确的 `repository` 回链共同提供发现与安装信息。其[公开 API 文档](https://github.com/hikariming/dshfind/blob/main/docs/api-query.md)区分自动推断与验证过的 npm 安装方式；网站显示索引结果后再确认收录，不能仅凭 topic 宣称已上架。

## DSH Directory

使用 [GitHub 插件提交表单](https://github.com/alexchenzl/dsh-plugin-directory/issues/new?template=plugin-submission.yml)，每个包单独一个 Issue。材料如下：

- **Plugin package URL：** `https://github.com/Totoro-qaq/dsh-jot`
- **Primary category：** `UI Enhancements (ui)`
- **One-line description：** `Adds a human-editable notes workspace with folders, full-text search, rich text, checklists, resizable tables, attachments, exports, and opt-in agent collaboration.`
- **Install command：** `dsh plugin --profile web add dsh-jot`

[贡献指南](https://github.com/alexchenzl/dsh-plugin-directory/blob/main/CONTRIBUTING.md)要求公开包目录、`dsh.bundle.patch` 和存在的 patch 文件；有 npm 和 Git 两种安装方式时优先 npm。提交后会自动检查，并在七天内每天重试；接受时会回复目录链接并关闭 Issue。

## DSH Plugin Store：网站表单材料

打开 [Submit a Plugin](https://dshpluginstore.com/submit)，以下内容可以直接粘贴：

- **Repository URL：** `https://github.com/Totoro-qaq/dsh-jot`
- **One sentence on what it does：** `Jot adds human-editable notes, to-dos and lightweight documents to DeepSeek Harness, with folders, full-text search, rich text, resizable tables, attachments, exports and optional agent collaboration.`
- **Category：** `UI & Themes`（笔记工作台属于功能界面增强；实际表单名称以网站当前选项为准）。
- **Anything we should verify before listing：** `Version 0.2.3 fixes Windows lock acquisition and passed 152 tests across hosted Linux, Windows and macOS CI. Its unchanged interface was checked in the real DeepSeek Harness 0.2.0-rc.2 Web UI and macOS Desktop during 0.2.2 validation. Install with dsh plugin --profile web add dsh-jot@0.2.3 (Desktop: --profile desktop), or use the current prebuilt Release asset. AI collaboration is off by default. PNG/JPEG/GIF/WebP preview is supported; PDF preview depends on the host viewer, and other attachments are downloadable. Windows/Linux shortcuts were platform-emulated, not validated on actual systems. See README.en.md and docs/VALIDATION.md for scope. MIT license.`
- **Your email：** 可选，留空即可；不代填个人邮箱。

这是人工审核的官网表单；本次确认的是公开目录尚未展示，不能据此判断用户是否已经提交。

## 当前未覆盖

[dsh.pub](https://github.com/dsh-pub/dsh-pub#submit-a-plugin)检查 Git 内已提交的运行入口与 Client 文件。当前仓库保留源码构建约定，`lib/` 为生成产物，通过 npm 和 Release 分发，未为该目录单独提交生成文件；本轮不提交该目录。此限制不影响 npm 或已配置的预构建 tarball 安装。
