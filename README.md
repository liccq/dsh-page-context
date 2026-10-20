# dsh-page-context

右侧栏网页浏览器 + 选择元素 + 上下文插入 + 智能体浏览器工具。

## 安装

- **插件市场（dshmarket）**：搜索 `dsh-page-context`，一键安装（收录后生效）。
- **DSH Desktop**：设置 → **插件** → **添加插件** → 输入 `dsh-page-context`。
- **CLI**：`dsh plugin --profile <profile> add dsh-page-context`。
- **从 Git 源码**：`dsh plugin --profile <profile> add git+https://github.com/liccq/dsh-page-context.git#v0.1.0`。

要求 DSH `>=0.2.1-rc.2`（`package.json` 的 `engines.dsh`），没有运行时依赖。桌面端用真实浏览器内核渲染
并注入拾取器；Web GUI 或桌面桥不可用时是静态预览——见 [限制](#限制)。维护者看 [PUBLISHING.md](PUBLISHING.md)。

## 入口

- **右侧栏引导页（guide）**：右侧栏的「+」/引导页里有一张「页面上下文」卡片（地球+拾取图标），点击即在当前面板打开本标签页。
- **输入框工具行**：地球按钮（`aria-label` = 打开页面上下文浏览器）→ 在右侧栏打开/聚焦 `页面上下文` 标签页。
- **右侧栏标签页**：地址栏（回车或「打开」）、后退 / 前进 / 刷新、「选择元素」开关。
- **智能体工具** `page_context`：按 URL 读取网页正文，或列出带选择器的交互元素；也能按选择器只取一个元素。只读，不执行页面脚本、不点击、不输入。

## 用法

1. 打开右侧栏的引导页，点「页面上下文」卡片（或点输入框左侧的地球按钮），右侧栏出现「页面上下文」。
2. 输入网址，例如 `https://example.com`，回车。
3. 点「选择元素」，鼠标悬停会高亮页面元素；点击后，输入框光标处会插入一行：

   ```
   【页面元素】https://example.com/ | selector=#main > h1 | tag=h1 | text=Example Domain | page=Example Domain
   ```

4. 继续写你的问题并发送。模型可用工具 `page_context`（`url` + 可选 `selector`）继续读取该页面或该元素。

## 工作原理

- **桌面端（DSH Desktop）走真实浏览器内核**：Client 通过外壳的 `dshDesktop.browser`（与官方「浏览器」标签页同一套 guest lease）申请一个隔离的 `<webview>`，在 `dom-ready` 后 `loadURL`。页面脚本、样式、fetch、cookie 全部真实执行，SPA 正常渲染；访客被主进程强制 `sandbox`、无 Node、无 preload、独立分区。
- **元素拾取**：向访客注入一段拾取脚本（`executeJavaScript`，不受页面 CSP 限制），用 CSSOM 直接设置悬停描边（不用 `<style>`，避免被 `style-src` 拦截）；点击后脚本记录选择器 / tag / 文本 / HTML，面板轮询取回并插入输入框。
- **渲染后 DOM 回传**：页面加载完成（以及每次拾取后）把 `document.documentElement.outerHTML` POST 到 `/page-context/snapshot`；Host 净化后按 origin+path 缓存 10 分钟，`page_context` 工具优先读这份渲染结果，因此 SPA 也能被模型读到。
- **Web GUI / 回退**：没有桌面桥时仍用同源代理 iframe（静态 HTML、不执行脚本）。代理路由先走 `ctx.web.fetch`，当 provider 因“地址非公网”拒绝（`WEB_BLOCKED_URL`）时回退到进程内直连 `fetch`，并注入 `<base>`、高亮样式和 CSP。
- 插入走插件的标准 props `inputActions.captureInsertion()` + `insertText(text, span)`，是一次可撤销的纯文本编辑。

## 限制

- **输入框里是文本而不是原子 chip**：DSH 的 composer 只对第三方公开纯文本插入，file/folder/session/command 之外的 chip 节点没有公开注册点。面板底部保留「已插入」小标签作为可视反馈。
- **只有桌面端执行页面脚本**：Web GUI（以及桌面桥不可用时的回退）是静态预览，SPA 可能只显示骨架。
- **桌面桥是宿主能力**：`dshDesktop.browser` 由 DSH Desktop 提供，官方 Browser 标签页也在用，但不是公开的第三方插件 API；插件做了特性探测，失败时自动切回静态预览并在状态行提示。
- **渲染快照的边界**：只回传主文档 `outerHTML`，不含 shadow DOM、iframe 内容、canvas；超过 1.5 MiB 会截断；缓存 10 分钟、最多 16 条；含登录态的页面在访客分区里是独立会话。
- **不带浏览器的登录态 / Cookie**：静态预览模式不发送 Cookie；桌面端访客分区有自己独立的 Cookie，不等于你系统浏览器的登录态。
- **本机 / 局域网页面可用**：桌面端直接放行（主进程允许非 DSH 端口的回环地址）；静态预览对回环与私有地址在 provider 拒绝后直接抓取。模型工具只读取“用户在面板里实际打开过”的 origin，其它私有地址会被拒绝并提示先打开面板。`localhost`、`127.0.0.1`、`[::1]` 可直接输入；不带 scheme 的回环地址按 `http://` 打开。
- **自签名 HTTPS 会失败**：静态预览的直连 `fetch` 不跳过证书校验；桌面端由 Chromium 处理，同样会拦截无效证书。
- **`localhost` 解析差异**：若 `localhost` 解析到 `::1` 而服务只监听 IPv4，请改用 `127.0.0.1`。
- **文档大小上限** 2 MiB（快照与静态抓取）；超出会显示「已截断」。

## 安全

- 桌面端访客由主进程强制：`sandbox`、`contextIsolation`、无 Node / preload、独立分区，权限、下载、弹窗全部拒绝；只能导航 http(s)，且不能访问 DSH 应用自身端口。
- 静态代理只接受 `http`/`https`，只允许 `GET`；快照接口只接受 `POST application/json`、上限 2 MiB。
- 带 `Sec-Fetch-Site` 且为 `cross-site` 的请求返回 403。
- 静态返回文档带 `Content-Security-Policy: script-src 'none'; …`，iframe 不含 `allow-scripts`，页面脚本无法执行，也无法读取 DSH 的 DOM / 存储 / API。
- 快照会先经过 `sanitizeHtml()` 清洗再存储；工具把它当作外部内容并加上提示行。

## 手工验收

1. 输入框左侧出现地球按钮；点击后右侧栏出现「页面上下文」标签。
2. 载入 `https://example.com`，页面渲染出内容（Web GUI 与 Desktop 都要验证：Desktop 的渲染进程地址是 `dsh-app://app/`，不应再出现「需要 Web 模式」的提示）。
3. 载入本机页面 `http://localhost:5000/` 与 `http://127.0.0.1:5000/`，两者都应渲染（不再出现 “Could not load the page”）；地址栏只输入 `localhost:5000` 也应能打开。
4. 打开需要 JavaScript 的页面（例如「热榜工坊」）：桌面端应完整渲染，不再出现「需要启用 JavaScript」；Web GUI 仍是静态预览。
5. 「选择元素」→ 悬停出现高亮 → 点击 `h1` → 输入框出现 `【页面元素】…`。
6. 发送后模型能在上下文里看到该行；模型调用 `page_context` 时返回渲染后的正文（输出含 `Source: rendered DOM`），本机页面在同一次面板打开之后可用。
7. 浅色 / 深色主题下工具栏、状态行、面板底色跟随宿主。

## 文件

| 文件 | 作用 |
|---|---|
| `index.js` | Host：代理路由 + 渲染快照接口 + `page_context` 工具 |
| `html.js` | Host：HTML 净化、解析、文本 / 元素 / 选择器 |
| `client.js` | Client：标签类型、面板、拾取器、输入框按钮 |
| `cordis.patch.yml` | 插入 `page-context` 插件行 |
| `locale/*.json` | Plugin Manager 展示用的标题与描述 |
| `icon.svg` | 原创图标（地球 + 拾取箭头） |
| `LICENSE` | MIT |
| `PUBLISHING.md` | 发 npm、推 GitHub、提交社区目录的操作手册（不进 npm 包） |
