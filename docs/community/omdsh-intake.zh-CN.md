# Oh My DSH 投稿声明

简体中文 | [English](omdsh-intake.md)

这份作者声明草案申请项目收录，不申请组织角色或迁移仓库。源码、Issue、Release 和 npm 发布继续由 Totoro-qaq 管理；草案不等于 Hub 审核通过或安装权限。

## 制品与生命周期

现有包通过 `cordis.patch.yml` 提供 Profile Bundle，不新增 SDK、适配器依赖或运行入口。申报的 `harness-profile` / `profile-bundle` 事务描述 **Workshop 候选 Profile 的安装封装**，不代表用户在当前 Profile 的普通安装有事务保证。尚无故障注入或 Workshop 回滚证据，`failureIsolation` 保持 null。

激活方式保守声明为 `restart-host`，与安装指南一致。`dispose: supported` 涵盖注册的路由、工具和客户端贡献；卸载刻意保留笔记与附件。不认证热重载或免重启升级，`hotReload` 保持 null。

## 权限与数据

- 读写用户选择的本地笔记目录，包括笔记、附件、草稿和 AI 撤销版本。永久删除需要人的操作，不属于卸载。
- 注册经过宿主认证的 HTTP 路由及人控制的可选 Agent 工具。AI 权限默认关闭，逐次检查；不会自动把笔记注入每轮模型请求。
- 通过官方客户端接口注册工作台、会话侧栏、斜杠入口和键盘命令。
- 用户明确操作时用原生应用打开经验证的附件副本、导出文件；不新增第三方云同步、翻译通道或遥测服务。

## 验收与申请门禁

精确实测宿主为官方 macOS Desktop 0.2.0-rc.2 和 Web 0.2.1-alpha.1。[VALIDATION.md](../VALIDATION.md)按插件版本区分证据与原生平台限制。功能断言是保存公开示例笔记，再打开并观察完全一致的文本；不改变原有兼容范围。

作者审阅并将元数据发布到公开的不可变 commit 后，再生成 v2 投稿 JSON。已发布的 npm 0.2.6 不含这份新 `dshWorkshop` 声明。应绑定相符的准确制品/版本和完整 40 位 commit，不把未推送草案当成公开源码事实。

用固定的 Workshop 实现验证后，展示完整 Issue，再取得作者对这一个 Issue 的明确批准。待审核 PR 由 Workshop 生成，不直接编辑 Catalog/Registry。其本次检查基线仍是 0.1.0-rc.6，不在 Jot 支持范围内；现代宿主验收不构成该基线的 Harness 审核，不提出向下兼容降级。

依据：[作者流程](https://hub.omdsh.dev/agent-submission-prompt.zh.md)、[清单 schema](https://github.com/omdsh-dev/dsh-hub-workshop/blob/main/package-manifest.schema.json)、[入库门禁](https://github.com/omdsh-dev/dsh-hub-workshop/blob/main/INTAKE.zh.md)。
