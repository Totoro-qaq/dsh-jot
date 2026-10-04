# 随记 / Jot

## Register

product

## Platform

web

Shared DSH Web UI and official Desktop, compatible with DSH 0.2.0-rc.2 and 0.2.1-alpha.1. Version 0.2.5 uses the current public shortcut APIs; the actual alpha.1 Web checks and separate rc.2 Desktop results are recorded in [docs/VALIDATION.md](docs/VALIDATION.md).

Target macOS, Windows and Linux, with separate shortcut and window-chrome validation for Desktop and Web. The shared renderer is not proof of identical native behavior. Actual Host checks are recorded per version in [docs/VALIDATION.md](docs/VALIDATION.md); Windows/Linux runtime acceptance remains pending.

## Users and purpose

People working alongside an agent need a place to write, find, and revise their own notes, reminders, lists, ideas, and documents. Users always control their content. Agent collaboration is optional; this is not an agent-only memory store. Product-plan handoff is one example, not the product boundary.

## Confirmed scope

- Name: 随记 / Jot. Package name: dsh-jot.
- A fixed, labelled entry opens notes without requiring a conversation. During a conversation, a compact editor can dock in the native right sidebar. A wider workbench supports browsing and longer writing.
- Direct document editing supports paragraphs, basic formatting, lists, and checkable tasks. Users do not need to write Markdown syntax; typing common Markdown shortcuts is optional.
- Users can create, read, update, and delete notes in both modes. The agent-collaboration switch starts off; turning it on permits the agent's Jot tools to read and maintain notes.
- Search titles and body text, with title matches first. Show a few recently modified notes and an entry to all notes; support pinned notes.
- Show contextual body matches in search results. Group browsing by date with continuous virtual scrolling; keep search ranking intact. Find and replace text within the current note, with replacement disabled in the trash.
- Folders are optional and named by users. Start without seeded categories, and never require a folder to create a note.
- Narrow panels switch between list and editor. Wide panels put the list beside the document.
- Preserve drafts when switching or closing. Version conflicts must keep the user's writing rather than silently replacing it. Opening a note never changes it.

## Design principles

Use familiar, quiet controls and the DSH host's visual language. Make new-note and search actions easy to find. Give writing most of the available space. In the workbench, left-align the title, formatting toolbar and body beside the note list, retaining a readable maximum width and spare space on the right. Show saved, failed, and conflicting states clearly. Keep the same document and state across compact and wide views.

Use DSH font and color tokens, font-size scaling, native sidebar row geometry, and a colored notebook icon in bamboo green, warm white and golden apricot. The bookmark rises above the cover and the page carries a check, so the mark stays distinct from file icons at 16px. Action controls share the K3 line-icon geometry; text-formatting initials retain the system font. Capture uses a quotation bar with a plus so it is distinguishable from Cut and from screenshots.

Place the wide-view New button beside the Jot title in the top toolbar. Group folder management under Folder actions, and sorting/selection under Sort and options. Keep bold, italic, underline and checklist one click away; put block styles, colors and less frequent formatting in a floating Style menu that never pushes the document. Destructive menu items come last. Reversible actions (Move to Trash) use Undo instead of confirmation; irreversible ones (Delete permanently, Empty Trash) ask first. Reserve only horizontal space for macOS leading controls when the host sidebar collapses. The note-list separator starts below that toolbar. Compact mode uses the host's tab title, with one row of aligned content controls below it. Use native sidebar entries rather than adding a default composer button that crowds other plugins. Host keyboard commands are registered without default bindings.

Palette colors are stored as a finite set of hex values; dark themes remap them for contrast at render time only.

## 功能清单

勾选项表示当前源码已实现；未勾选项表示尚未实现。源码实现与真实宿主验收分开记录：各版本的实际验收范围见[验证记录](docs/VALIDATION.md)，版本变化见[更新记录](CHANGELOG.md)。

### 保持的产品约定

- 人始终可以新建、阅读、修改和删除笔记；AI 协作为可选项，默认关闭。
- 使用普通文档编辑，不要求用户输入 Markdown；适用于日常记录、清单、想法、资料和轻文档，不限定产品经理场景。
- 文件夹可选、由用户自行命名；不预设分类。未来标签也保持可选。
- 主要入口为固定命名的左侧导航与官方右侧栏；界面遵循 DSH 字体、字号和控件样式。
- 切换笔记或从窄栏放大时保留内容与草稿；冲突时保留用户写过的内容；仅打开笔记不会产生修改。
- `jot.json` 的结构保持向后兼容，旧版本插件可以继续读取新版本保存的笔记；附加信息放在独立文件中。

### 入口与布局

- [x] 左侧导航「随记」完整工作台、官方右侧栏标签页，以及带着笔记和草稿从窄栏放大到完整页。
- [x] 工作台重新打开上次查看的笔记；列表宽度可拖动（双击恢复），也可以隐藏列表专注写作。
- [x] 宽版标题、格式工具栏与正文靠左对齐，正文保留阅读限宽，空白留在右侧；表格与正文左对齐，窄栏工具在容器变窄时收起文字标签。
- [x] DSH 系统字体、字号缩放和主题；深色主题下文字颜色、高亮和链接自动换成易读色调。
- [x] macOS 窗口控制区的横向避让；顶部随记标题旁的「新建」按钮。

### 写作

- [x] 段落、标题 1–3、粗体、斜体、下划线、删除线、行内代码、引用、代码块、分割线、有序／无序列表和可勾选核对清单。
- [x] 粗体、斜体、下划线、清单常驻工具栏；其余样式、七种文字颜色、六种高亮和清除格式在浮动的「样式」菜单中。
- [x] 输入 `# `、`- `、`1. `、`[ ] `、`> `、`---`、`**…**` 等写法自动转换格式。
- [x] 新建后焦点在标题，Enter 进入正文；未写内容就离开的新笔记自动删除。
- [x] 表格：插入、编辑单元格、选中后行／列菜单前后插入或删除、末尾「＋」追加、拖动列宽并保存、Escape 取消本次拖动、「自动适应宽度」、行高随内容撑开、容器内横向滚动；自动保存后保留连续撤销／重做；只读笔记不能改变列宽。
- [x] 当前笔记内查找、命中计数、上下跳转、单处／全部替换和撤销；回收站笔记只允许查找。
- [x] 自动保存、可点击的保存状态与 Mod+S、草稿恢复、冲突提示与另存草稿。

### 查找与整理

- [x] 标题与正文搜索，标题命中优先；结果显示命中附近的正文摘要和临时高亮；`/` 聚焦搜索。
- [x] 置顶、最近修改（全部置顶 + 最近 5 条）、全部笔记与回收站视图，以及当前列表条数。
- [x] 日期分组、连续虚拟滚动和列表键盘导航；已用 1,200 条笔记验证列表表现。
- [x] 列表显示清单进度、所在文件夹和「AI 修改」标记；无标题笔记用正文第一行作为显示标题。
- [x] 修改时间、创建时间和标题排序，保留置顶与搜索标题命中优先；最近视图固定按修改时间。
- [x] 可选文件夹的新建、改名、筛选、移动笔记和删除；删除文件夹保留其中笔记。
- [x] 更多／右键菜单统一置顶、移动、复制、导出和删除；多选、当前列表全选、批量移动和软删除。

### 删除与回收站

- [x] 移到回收站后可在提示中撤销，也可以在回收站恢复。
- [x] 永久删除单条笔记和清空回收站，需确认；只被这些笔记引用的附件一并清理，其他笔记仍在引用的附件保留。

### 资料与导出

- [x] 文件选择、粘贴截图和拖入文件；受管理附件 ID、图片显示；DSH 官方文档／表格／图片／PDF／文本预览，回退弹窗及下载；主机有桌面环境时可用默认应用打开副本。
- [x] 摘录当前窗口选中的文字或粘贴文字，新建或追加，默认追加到当前笔记，保留可编辑来源；不强制分类，不自动调用模型总结。
- [x] 导出 TXT、Markdown、PDF、Word（DOCX）；Markdown 有附件时打包 ZIP；PDF 离线嵌入中文字体。未提供旧 DOC 格式。

### AI 协作

- [x] 「允许 AI 协作」全局开关，默认关闭，每次调用检查最新状态；AI 无法自行开启。
- [x] 六个工具：搜索、读取（含编号待办项）、新建、更新、勾选单个待办、移到回收站；修改与删除要求精确版本。
- [x] AI 写入的文字按简单 Markdown 转换为标题、列表、待办、引用、代码、表格和行内格式；追加的列表并入末尾同类列表。
- [x] 整篇替换在笔记含表格、图片、附件、颜色或下划线时拒绝执行，除非用户同意后显式允许。
- [x] AI 保存的版本在列表和正文标出「AI 修改」，用户编辑后消失；归属记录独立存放。

### 快捷键与宿主集成

- [x] 当前正文的 Mod+B／I／U、撤销／重做、Mod+F，以及当前笔记保存 Mod+S；系统复制、剪切、粘贴和全选保留原生行为。
- [x] Mac／Windows Desktop 正文聚焦时，通过 DSH 公开 fixed-shortcut 协议暂时保留 Mod+B；退出正文或卸载恢复，不修改用户持久设置。
- [x] Mac Desktop 的 Cmd+Z／Cmd+Shift+Z 使用正文焦点期限内的公开命令路由。
- [x] 「打开随记」「新建笔记」「摘录选中的文字」通过当前公开接口注册为 DSH 键盘命令，可在宿主设置中查找和绑定；默认不绑定按键，由用户自行设置。对话可见时使用右侧栏，否则打开工作台；对话框打开时不在背景执行。
- [x] 对话框和菜单通过 Portal 避免侧栏裁剪，处理键盘导航、焦点恢复和视口内定位。

### 当前限制

- 正文 JSON 最多 1 MiB／200,000 个 JavaScript 字符长度单位，笔记库状态最多 32 MiB；单表最多 200 行、50 列，且仍受文档整体上限约束。
- 附件默认单文件 20 MiB、全库 500 MiB／1,000 个；界面每次最多添加 20 个。附件只在永久删除笔记或清空回收站时清理；从正文删掉附件卡片不会立即删除二进制。
- 图片预览支持按字节识别的 PNG／JPEG／GIF／WebP，最多 10,000 像素边长及 4,000 万像素；PDF 预览依赖宿主／浏览器查看器。附件正文不做全文解析、OCR 或搜索索引。
- 摘录保存文字及用户填写的来源。Desktop 的非 HTTP 页面不会自动提供原消息永久链接；未接入聊天消息的专用保存菜单或自动提炼任务。
- 复制笔记复制文档结构并保留附件 ID，不复制一套附件二进制。批量管理逐条执行版本检查，发生失败时保留已成功结果，不是整批事务。
- 导出当前草稿最多使用 100 个不同附件；附件原始字节和最终文件各上限 50 MiB。PDF 超过 8 列的表格改为带行列标识的文字；合并边框不完全还原。PDF／DOCX 嵌入 PNG／JPEG，其他图片和普通文件保留名称说明。文档导出不承诺编辑器的逐像素复现。
- 界面每 3 秒检查更新，无变化时服务端返回「未修改」；仍然一次读取整个笔记库，不是分页加载。
- 排序选择、列表宽度和隐藏状态是本机界面偏好；不声明云同步、后台任务、任意色值、字体选择器或每篇笔记的独立 AI 权限。

### 后续候选

以下仍属于推荐或可选方向，没有确定为下一版必做项。

- [ ] 修改记录、改动对比和历史版本恢复，方便查看人或 agent 改过什么（现有「AI 修改」标记只标出最近一次）。
- [ ] 单篇笔记的 AI 协作设置，细分只读与允许修改。
- [ ] 网页链接的插入／编辑界面，以及笔记之间的关联链接（目前可粘贴或输入网址自动识别）。
- [ ] 从聊天消息直接「记到随记」（取决于 DSH 是否提供消息操作扩展点）。
- [ ] 长笔记按标题折叠章节。
- [ ] 自定义标签与智能筛选；分类名称由用户决定，也可以完全不用。
- [ ] 核对清单的拖动排序，以及可选的已完成项整理。
- [ ] 字体／字号选择器；自由字重等更细的格式需求再评估。
- [ ] 正文格式键（粗体等）也纳入 DSH 键盘设置，可由用户改键。

### 跨平台快捷键要求

快捷键按动作定义，使用平台主修饰键：macOS 为 Command，Windows／Linux 为 Ctrl。下列常用键已在源码实现或交给系统／编辑器处理；六种目标环境的真实键事件仍需分别验收。

| 操作 | macOS 的常用习惯 | Windows／Linux 的常用习惯 |
| --- | --- | --- |
| 复制／剪切／粘贴／全选 | Command + C／X／V／A | Ctrl + C／X／V／A |
| 撤销／重做 | Command + Z／Shift + Command + Z | Ctrl + Z／Ctrl + Shift + Z；另支持 Ctrl + Y |
| 粗体／斜体／下划线 | Command + B／I／U | Ctrl + B／I／U |
| 当前笔记查找 | Command + F | Ctrl + F |
| 保存当前笔记 | Command + S | Ctrl + S |
| 搜索笔记库 | `/`（随记内、非输入框） | 同左 |
| 列表导航与激活 | 方向键、Home／End、Enter／Space；选择模式切换勾选 | 同左 |
| 关闭查找或菜单 | Escape | Escape |
| 打开随记／新建笔记／摘录 | DSH 键盘设置中的命令，默认不绑定 | 同左 |

- 三个平台分别检查 Desktop 与 Web，共六种目标环境。桌面菜单、系统／窗口管理器与浏览器快捷键均可能先于插件处理。
- DSH 桌面默认把平台主修饰键 + N 用于新会话，不能直接交给随记新建；随记的命令一律不设默认键。
- Mod+B 的 Native 兼容使用公开 `registerFixed` 与冲突仲裁：在焦点期限内暂时禁用同键的 Host 命令，包含用户重新绑定到该键的命令，失焦恢复全部原设置。Web／Linux 不增加此保留项。Native 定义通过异步 IPC 同步，没有公开完成确认接口。
- 格式和撤销／重做按编辑器焦点处理；工作台有选中笔记时 Mod+F／S 用于查找／保存当前笔记，菜单和对话框保留自己的处理。新动作优先使用宿主公开接口，不靠全局键盘监听强行抢键。
- 同一个键按焦点区分列表、正文、表格和菜单，保留输入法候选确认、普通文本输入和系统剪贴板行为。
- 验收包括键位是否触发、焦点是否正确、是否误触发宿主命令，以及用户改键／关闭绑定后的行为。

### 暂缓与本轮未纳入

- **自由绘图暂缓**：画笔、橡皮、笔触／线宽、图形选择、签名、文本框和形状不进入近期范围。将来确实存在 Pad／手机版及触屏、手写笔需求时再评估；目前没有承诺开发独立移动版本。
- **桌面批注按需求评估**：如果出现明确的图片／PDF 批注需求，可以再考虑箭头、圈选和文字标注。
- 云同步、多人实时协作、跨设备分享、加密锁定、录音转写、扫描／OCR、数学计算与常驻悬浮球，本轮不确定实现范围。
- GitHub 状态监控、自动修复和插件 doctor 属于另外的插件方向，不混入随记清单。
