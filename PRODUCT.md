# 随记 / Jot

## Register

product

## Platform

web

Shared DSH Web UI and official Desktop, targeting DSH 0.2.0-rc.2. Desktop has its own profile and must be verified separately.

Target macOS, Windows and Linux, with separate shortcut and window-chrome validation for Desktop and Web. The shared renderer is not proof of identical native behavior. Version 0.2.2 has bounded real DSH Web UI and macOS Desktop checks recorded separately from older versions. Actual Windows/Linux runtime acceptance remains pending.

## Users and purpose

People working alongside an agent need a place to write, find, and revise their own notes, reminders, lists, ideas, and documents. Users always control their content. Agent collaboration is optional; this is not an agent-only memory store. Product-plan handoff is one example, not the product boundary.

## Confirmed scope

- Name: 随记 / Jot. Package working name: dsh-jot.
- A fixed, labelled entry opens notes without requiring a conversation. During a conversation, a compact editor can dock in the native right sidebar. A wider workbench supports browsing and longer writing.
- Direct document editing supports paragraphs, basic formatting, lists, and checkable tasks. Users do not need to write Markdown syntax.
- Users can create, read, update, and delete notes in both modes. The agent-collaboration switch starts off; turning it on permits the agent's Jot tools to read and maintain notes.
- Search titles and body text, with title matches first. Show a few recently modified notes and an entry to all notes; support pinned notes.
- Show contextual body matches in search results. Group browsing by date with continuous virtual scrolling; keep search ranking intact. Find and replace text within the current note, with replacement disabled in the trash.
- Folders are optional and named by users. Start without seeded categories, and never require a folder to create a note.
- Narrow panels switch between list and editor. Wide panels put the list beside the document.
- Preserve drafts when switching or closing. Version conflicts must keep the user's writing rather than silently replacing it.

## Design principles

Use familiar, quiet controls and the DSH host's visual language. Make new-note and search actions easy to find. Give writing most of the available space. Show saved, failed, and conflicting states clearly. Keep the same document and state across compact and wide views.

Use DSH font and color tokens, font-size scaling, native sidebar row geometry, and a colored notebook icon in bamboo green, warm white and golden apricot. Action controls share the K3 line-icon geometry; text-formatting initials retain the system font. Capture uses a selection mark so it is distinguishable from Cut.

Place the wide-view new-note control beside the Jot title in the top toolbar. Group folder management under Folder actions, and sorting/selection under List options. Narrow editor containers keep Format, Checklist, Find and Table as named, accessible icon controls. Reserve only horizontal space for macOS leading controls when the host sidebar collapses. The note-list separator starts below that toolbar. Compact mode uses the host's tab title, with one row of aligned content controls below it. Use native sidebar entries rather than adding a default composer button that crowds other plugins.

## Current 0.2.3 boundary

Local durable notes, search, optional folders, rich editing with tables and a finite color palette, managed attachments, text capture, note-management actions, document export, native sidebar/global workbench, and gated agent tools. Cloud sync, real-time multi-person editing, version history, drawing/annotation, and a permanent floating-ball launcher remain outside this version. Source implementation, contract tests and complete native acceptance are separate claims.

## 功能清单

整理日期：2026-10-03。当前实现基线：0.2.3，目标宿主 DSH 0.2.0-rc.2。

勾选项表示当前源码已实现；未勾选项表示尚未实现。0.2.3 已完成类型检查、152 项测试和构建。0.2.0 的打包、真实 DSH Web UI 与 macOS Desktop 验收保留为历史记录；新版本的宿主验收单独记录。实际 Windows／Linux、完整原生中文输入与剪贴板仍需补充，实际验证范围见[验证记录](docs/VALIDATION.md)。

### 保持的产品约定

- 人始终可以新建、阅读、修改和删除笔记；AI 协作为可选项，默认关闭。
- 使用普通文档编辑，不要求用户输入 Markdown；适用于日常记录、清单、想法、资料和轻文档，不限定产品经理场景。
- 文件夹可选、由用户自行命名；不预设分类。未来标签也保持可选。
- 主要入口为固定命名的左侧导航与官方右侧栏；界面遵循 DSH 字体、字号和控件样式。
- 切换笔记或从窄栏放大时保留内容与草稿；冲突时保留用户写过的内容。

### 已完成

- [x] 笔记新建、阅读、修改、删除，以及回收站恢复。
- [x] 可选文件夹的新建、改名、筛选、移动笔记和删除；删除文件夹保留其中笔记。
- [x] 置顶、最近修改与全部笔记视图。最近显示全部置顶笔记和最近修改的 5 条非置顶笔记。
- [x] 日期分组、连续虚拟滚动、列表键盘导航，以及当前列表的条数显示；已用 1,200 条笔记验证列表表现。
- [x] 标题与正文搜索，标题命中优先；结果显示命中附近的正文摘要和临时高亮。
- [x] 当前笔记内查找、命中计数、前后跳转、单处／全部替换和撤销；回收站笔记只允许查找。
- [x] 段落、标题、粗体、斜体、下划线、有序／无序列表和可勾选核对清单。
- [x] 自动保存、手动保存、保存状态、草稿恢复、冲突提示与另存草稿。
- [x] 允许 AI 协作的全局开关，以及按版本修改的笔记工具。
- [x] DSH 系统字体与字号适配、彩色笔记本图标、顶部随记标题旁的新建按钮，以及 macOS 窗口控制区的横向避让。
- [x] 从右侧栏打开完整页时传递当前笔记、保存版本和草稿分支；后续刷新或重挂载不重复执行旧的打开请求。

### 0.2.2 表格操作

- [x] 选中单元格后显示行／列菜单，在前后插入或删除所选行列；末尾「＋」固定追加到表格最后。
- [x] 拖动列边界调整宽度，保存后保留；「表格选项 → 自动适应宽度」清除手动列宽，按可用空间重新布局。
- [x] 行高随文字撑开，多列表格在容器内横向滚动；不增加整体缩放。
- [x] 操作可以撤销／重做；只读笔记不能改变列宽。行列新增和列宽元数据写入保护笔记容量。

### 0.2.1 视觉与操作整理

- [x] 产品图标采用竹青、暖白和金杏彩色笔记本，与 README 图标保持一致；操作图标统一采用 K3 线条语言。
- [x] 摘录图标使用选区标记，避免与系统剪切操作混淆。
- [x] 新建、改名、删除文件夹收进「文件夹操作」，排序与多选收进「列表选项」；多选时显示批量工具条。
- [x] 字体与字号缩放跟随 DSH；标题、列表与摘要使用一致层级。窄正文容器收起格式、查找和表格的文字标签，保留工具提示和可访问名称。
- [x] 继续使用原有公开导航、侧栏与快捷键接口，保留编辑、草稿、附件和保存流程。

这些完成项不等于字体选择器或任意字重设置；列表条数也不是全库总数。完整的原生中文输入、剪贴板快捷键与长期稳定性验收仍需继续，详见验证记录。

### 0.2.0 功能基础

原优先补充清单已进入源码。以下功能在 0.2.3 中保留；0.2.0 的界面和原生键盘验收按版本保存在集成记录中。

| 功能 | 当前实现 |
| --- | --- |
| 表格 | 插入表格、编辑单元格、增删行列或删除整表；支持窄栏内滚动。持久化支持合并结构，未提供合并／拆分控件 |
| 文字颜色与永久高亮 | 七种文字颜色、六种高亮及清除格式；输入颜色规范化为有限色板，默认字体继续跟随 DSH |
| 图片与附件 | 文件选择、粘贴截图和拖入文件；受管理附件 ID、图片显示、图片／PDF 预览及文件下载 |
| 摘录到随记 | 捕获当前窗口选中文字或用户粘贴文字，新建或追加，保留可编辑来源；不强制分类，不自动调用模型总结 |
| 笔记管理操作 | 更多／右键菜单统一置顶、移动、复制、删除和导出；多选、当前列表全选、批量移动和软删除 |
| 排序选择 | 修改时间、创建时间和标题排序，保留置顶与搜索标题命中优先；最近视图固定按修改时间 |
| 导出 | TXT、Markdown、PDF、Word（DOCX）；Markdown 有附件时打包 ZIP；PDF 离线嵌入中文字体。未提供旧 DOC 格式 |

- [x] 当前正文的 Mod+B／I／U、撤销／重做、Mod+F，以及当前笔记保存 Mod+S；系统复制、剪切、粘贴和全选保留原生行为。
- [x] Mac／Windows Desktop 正文聚焦时，通过 DSH 公开 fixed-shortcut 协议暂时保留 Mod+B；退出正文或卸载恢复，不修改用户持久设置。
- [x] Mac Desktop 的 Cmd+Z／Cmd+Shift+Z 使用正文焦点期限内的公开命令路由，已实机验证表格撤销／重做。
- [x] 对话框和菜单通过 Portal 避免侧栏裁剪，处理键盘导航、焦点恢复和视口内定位。

### 当前限制

- 正文 JSON 最多 1 MiB／200,000 个 JavaScript 字符长度单位，笔记库状态最多 32 MiB；单表最多 200 行、50 列，且仍受文档整体上限约束。
- 附件默认单文件 20 MiB、全库 500 MiB／1,000 个；界面每次最多添加 20 个。可配置单文件／总字节额度，未提供附件垃圾回收。删除引用或移到回收站不会立即删除二进制。
- 图片预览支持按字节识别的 PNG／JPEG／GIF／WebP，最多 10,000 像素边长及 4,000 万像素；PDF 预览依赖宿主／浏览器查看器。附件正文不做全文解析、OCR 或搜索索引。
- 摘录保存文字及用户填写的来源。Desktop 的非 HTTP 页面不会自动提供原消息永久链接；未接入聊天消息的专用保存菜单或自动提炼任务。
- 复制笔记复制文档结构并保留附件 ID，不复制一套附件二进制。批量管理逐条执行版本检查，发生失败时保留已成功结果，不是整批事务。
- 导出当前草稿最多使用 100 个不同附件；附件原始字节和最终文件各上限 50 MiB。Markdown ZIP 包含离线本地资源；普通 `.md` 不依赖受认证的 DSH 链接。
- PDF 的正常表格与超高单元格可分页，待办框使用矢量绘制，附淡灰页码。超过 8 列的表格改为带行列标识的文字；合并边框不完全还原。表格内图片带说明放在表格后。Markdown HTML／DOCX 保留合并结构。
- PDF／DOCX 嵌入 PNG／JPEG；其他图片和普通文件保留名称说明。PDF 使用随包 NotoSansSC Regular／Bold 字体，许可见 [OFL](assets/fonts/OFL.txt)；DOCX 显示由阅读器字体决定。文档导出不承诺编辑器的逐像素复现。
- 当前排序选择和多选是面板交互状态；不声明云同步、后台任务、任意色值、字体选择器或每篇笔记的独立 AI 权限。

### 后续候选

以下仍属于推荐或可选方向，没有确定为下一版必做项。

- [ ] 修改记录、改动对比和历史版本恢复，方便查看人或 agent 改过什么。
- [ ] 单篇笔记的 AI 协作设置，细分只读与允许修改。
- [ ] 网页链接的插入／编辑，以及笔记之间的关联链接。
- [ ] 长笔记按标题折叠章节。
- [ ] 自定义标签与智能筛选；分类名称由用户决定，也可以完全不用。
- [ ] 核对清单的拖动排序，以及可选的已完成项整理。
- [ ] 字体／字号选择器；自由字重等更细的格式需求再评估。
- [ ] 可配置的快捷键，覆盖 macOS、Windows、Linux 的 Desktop／Web 环境，兼顾 DSH、系统、浏览器和其他插件的绑定。

### 跨平台快捷键要求

快捷键按动作定义，使用平台主修饰键：macOS 为 Command，Windows／Linux 为 Ctrl。下列常用键已在源码实现或交给系统／编辑器处理；六种目标环境的真实键事件仍需分别验收。

| 操作 | macOS 的常用习惯 | Windows／Linux 的常用习惯 |
| --- | --- | --- |
| 复制／剪切／粘贴／全选 | Command + C／X／V／A | Ctrl + C／X／V／A |
| 撤销／重做 | Command + Z／Shift + Command + Z | Ctrl + Z／Ctrl + Shift + Z；另支持 Ctrl + Y |
| 粗体／斜体／下划线 | Command + B／I／U | Ctrl + B／I／U |
| 当前笔记查找 | Command + F | Ctrl + F |
| 保存当前笔记 | Command + S | Ctrl + S |
| 列表导航与激活 | 方向键、Home／End、Enter／Space；选择模式切换勾选 | 同左 |
| 关闭查找或菜单 | Escape | Escape |
| 新建笔记／搜索笔记库 | 暂未绑定新的全局键 | 暂未绑定新的全局键 |

- 三个平台分别检查 Desktop 与 Web，共六种目标环境。桌面菜单、系统／窗口管理器与浏览器快捷键均可能先于插件处理。
- DSH 桌面默认把平台主修饰键 + N 用于新会话，不能直接交给随记新建。格式键也要查宿主目录；编辑器内置绑定不等于在原生客户端实际可用。
- Mod+B 的 Native 兼容使用公开 `registerFixed` 与冲突仲裁：在焦点期限内暂时禁用同键的 Host 命令，包含用户重新绑定到该键的命令，失焦恢复全部原设置。Web／Linux 不增加此保留项。Native 定义通过异步 IPC 同步，没有公开完成确认接口。
- 格式和撤销／重做按编辑器焦点处理；工作台有选中笔记时 Mod+F／S 用于查找／保存当前笔记，菜单和对话框保留自己的处理。新动作优先使用宿主公开接口，不靠全局键盘监听强行抢键。
- 同一个键按焦点区分列表、正文、表格和菜单，保留输入法候选确认、普通文本输入和系统剪贴板行为。
- 格式按钮提示使用当前平台键位；菜单和对话框保留输入法候选确认。平台特有窗口控制跟随宿主，不照搬 Mac 外观。
- 验收包括键位是否触发、焦点是否正确、是否误触发宿主命令，以及用户改键／关闭绑定后的行为。浏览器 Win32／Linux navigator 模拟已覆盖 Ctrl 格式、撤销／重做、标题区查找与保存；这不是实际 Windows／Linux 系统验收。0.2.0 已做有限的 macOS Native 键盘验收，完整原生输入法与剪贴板覆盖仍待补齐；0.2.1 记录单独保留。

### 暂缓与本轮未纳入

- **自由绘图暂缓**：画笔、橡皮、笔触／线宽、图形选择、签名、文本框和形状不进入近期范围。将来确实存在 Pad／手机版及触屏、手写笔需求时再评估；目前没有承诺开发独立移动版本。
- **桌面批注按需求评估**：如果出现明确的图片／PDF 批注需求，可以再考虑箭头、圈选和文字标注。
- 云同步、多人实时协作、跨设备分享、加密锁定、录音转写、扫描／OCR、数学计算与常驻悬浮球，本轮不确定实现范围。
- GitHub 状态监控、自动修复和插件 doctor 属于另外的插件方向，不混入随记清单。
