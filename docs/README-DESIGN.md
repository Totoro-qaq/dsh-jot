# README 设计记录

日期：2026-10-03。当前素材版本：0.2.2。范围：README、品牌素材与图标来源；插件界面继续继承 DSH 主题。

## 参考来源

读取 GitHub 当前默认分支的 README，并查询公开 API 的 stars。数字只是本次快照，不用作设计质量的评分。

| 项目 | 当次 stars | 借鉴 |
| --- | ---: | --- |
| [用户的 Bridge](https://github.com/Totoro-qaq/dsh-plugin-bridge) | 165 | 中英文切换、真实演示、清晰安装路径和可核验的兼容边界 |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy/blob/main/README.md) | 77,078 | 产品界面先于开发细节，用户安装入口明确 |
| [AFFiNE](https://github.com/toeverything/AFFiNE/blob/canary/README.md) | 73,190 | 短定位、产品演示、少量主题组织能力 |
| [Joplin](https://github.com/laurent22/joplin/blob/dev/README.md) | 56,564 | 日常用途、离线数据与截图优先，完整说明另放文档 |
| [Logseq](https://github.com/logseq/logseq/blob/master/README.md) | 45,116 | 版本状态靠近安装路径，开始使用的步骤清楚 |

Bridge 的封面围绕会话迁移流程。随记采用笔记本图标和实际界面来表达用途，独立配色，不沿用其深色流程头图。用户提到 pi 的像素风作为可选风格的例子；本版使用清楚的矢量图形，没有套用像素角色。

## 视觉与内容

- 产品图标采用彩色笔记本：竹青封面 `#3B8C76`、深青书脊 `#185F50`、暖白纸页 `#FFF9EA`、金杏书签 `#E6AD54` 与青色笔迹 `#286B5D`。侧栏激活态使用 `#28765F`；产品图标与 README 共用同一几何。
- 操作图标采用 Open Design K3 的方向 A「墨线 / Inkline」，使用 24×24 网格、2px 圆端描边和 `currentColor`，常用控件显示为 16px。产品图标保留彩色填充，操作图标继承 DSH 主题颜色。
- 图标为可维护的纯 SVG，没有脚本、`foreignObject`、外部字体或外部图片。摘录图标在复核后从剪刀改为选区与文字线，避免与系统剪切混淆；保存动作图标与已保存状态文案分别保留。
- 首页顺序：图标与定位 → 真实完整页 → 能力分组 → 安装与第一条笔记 → 对话侧栏 → 可选 AI → 快捷键与数据边界 → 详细文档。
- 发布首页以 npm 安装为主，源码构建折叠放在后面；GitHub 版本、npm 和问题反馈入口集中列出，不展示未经验证的 CI 徽章或用户规模。
- 存储结构、详细额度、导出还原限制和 Native 快捷键协议留在使用指南／验证记录。

## 素材与检查

默认首页 `README.md` 使用中文，英文页面为 `README.en.md`。两份文档各自使用对应语言的真实宿主界面与示例笔记：

| 文档 | 完整工作台 | 对话侧栏 |
| --- | --- | --- |
| 中文首页 | `assets/readme/workbench.png` | `assets/readme/sidebar.png` |
| English | `assets/readme/workbench-en.png` | `assets/readme/sidebar-en.png` |

截图来自随记 0.2.2 在官方 DSH 0.2.0-rc.2 真实 Web UI 中的示例笔记，采用深色主题；中文截图为 1440×1000。英文截图由真实宿主切换到英文界面后单独拍摄，不通过改图翻译。没有拼造对话或 AI 执行结果，也没有使用私人笔记内容。示例文件夹由测试操作者创建，产品不预设这类分类。Web 截图不代替 macOS、Windows 或 Linux 的原生客户端验收。

图片放在仓库内固定路径。初次 Open Design MCP 连接失败后，通过官方 headless 启动方式恢复；后续 Open Design Cloud 设计请求成功完成。公开运行器诊断中的请求模型与解析模型均为 `kimi-k3`，两项均标记 available / complete，没有改用默认模型。

K3 返回三个视觉方向、推荐方向的 20 枚独立 SVG、16／20／24px 示例、浅深色状态、图标规范和排版建议。采用 Inkline 的构造规范，并结合本地复核保留 DSH 字体与字号缩放、菜单布局、窄栏文字标签收起以及保存／错误／冲突信息。彩色产品图标和摘录语义调整属于本地整合；没有直接移植展示板的 CSS。源设计及复核记录位于被忽略的 `artifacts/design/opendesign-k3`，不随插件发布；其中「设计提案／未实施」描述保留生成时的状态，不代表当前源码状态。

中英文 README 经 GitHub Markdown API 渲染并检查桌面／手机宽度、图片加载与链接的记录属于 **0.2.0**。0.2.2 的中英文 README 已重新经 GitHub Markdown API 渲染，在 1280px 桌面和 390px 手机宽度检查：产品图标及两张截图加载正常，页面无横向溢出；旧版审计不代替本次检查。预览文件位于被忽略的 `artifacts/readme-preview`，不随插件发布。

## 发布文案

GitHub 仓库使用 `Totoro-qaq/dsh-jot`，包名使用 `dsh-jot`。首页首句说明「DSH 中直接写笔记、待办和轻文档，可选 agent 协作」，功能按写、找、资料、保存与导出五组介绍。附件能力明确区分图片预览、依赖宿主的 PDF 预览与普通文件下载，不暗示 Office／飞书式文档预览。兼容声明采用已验证的 DSH 版本和操作系统范围，源码检查通过与发布成功分开记录；注册表命令和外部链接在发布后核验。
