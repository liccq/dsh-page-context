# 发布与上架手册

本文件描述如何把本插件发布成公开包、推上 GitHub、并提交到社区目录
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
（dshmarket 插件市场的列表来源）。它不进 npm 包（`files` 未包含），只给维护者看。

建议顺序：**1 → 2 → 3 → 5（建仓）→ 4（npm）→ 6（可选索引）→ 7（目录 PR）**。

## 0. 外部输入

| 输入 | 用途 | 当前状态 |
|---|---|---|
| GitHub 用户名（下文 `OWNER`） | 仓库地址、条目文件名、PR | 已填 `liccq` |
| npm 登录或 `NPM_TOKEN` | `npm publish` | 未登录（`npm whoami` → `ENEEDAUTH`） |
| GitHub PAT（fine-grained：该仓 contents 写 + 对 awesome-dsh-plugin 的 fork/PR） | 走 API 建仓与提 PR | 待提供 |

本机网络实测：`registry.npmjs.org`、`api.github.com`、`unpkg.com`、`gitee.com` 可达；`github.com:443`
**时通时断**（`git ls-remote` 成功过一次，也超时过），`raw.githubusercontent.com` 一直被重置；
`ssh github.com:22` 不通，`ssh.github.com:443` 通但本机密钥未注册。两条路都留着：GitHub **API** 随时可用，
`git push` 能通就直接推。

## 1. 替换 OWNER

已按 `liccq` 替换完毕（`package.json` 的 `repository`/`homepage`/`bugs` + README 的 Git 安装命令）。
换账号时重跑下面两步：

```powershell
# 查残留（PUBLISHING.md 自身的说明文字不算）
Get-ChildItem -Recurse -File -Include *.md,package.json |
  Where-Object { $_.Name -ne 'PUBLISHING.md' } |
  Select-String -Pattern 'OWNER' | Select-Object Path, LineNumber, Line

# 用 Node 替换。不要用 Get-Content/Set-Content：Windows PowerShell 5.1 默认按 GBK 读写，
# 会把 UTF-8 中文写成乱码（本仓库已经踩过一次，README 整篇被写坏）。
node -e "const fs=require('fs');for(const f of ['package.json','README.md']){const t=fs.readFileSync(f,'utf8');fs.writeFileSync(f,t.replaceAll('OWNER',process.argv[1]))}" 'liccq'
```

`package.json` 的 `repository` 必须指回目录收录的那个仓库，否则 npm 包与仓库不会关联
（条目里**禁止**手写 `npm:`，映射从 registry 自动采集）。

## 2. 版本

首次发布就是 `0.1.0`。之后：

```powershell
npm version patch --no-git-tag-version   # 或 minor / major
```

## 3. 打包自检

```powershell
npm pack --dry-run
```

期望恰好包含：`package.json`、`index.js`、`html.js`、`client.js`、`cordis.patch.yml`、
`locale/en.json`、`locale/zh.json`、`icon.svg`、`README.md`、`LICENSE`。
`PUBLISHING.md`、`.gitignore` 不应出现。想真装一次就 `npm pack` 生成 `.tgz`，
在 DSH 里用绝对路径安装（见第 8 节）。

## 4. 发布到 npm

```powershell
# 方式 A：交互登录（需要浏览器，可能要求 OTP）
npm login

# 方式 B：automation token（不落盘）
$env:NPM_TOKEN = 'npm_xxx'
npm publish --access public --//registry.npmjs.org/:_authToken=$env:NPM_TOKEN
```

发布后核对：

```powershell
npm view dsh-page-context version          # 0.1.0
npm view dsh-page-context repository.url   # 必须是 github.com/OWNER/dsh-page-context
```

注意：
- 包名未加 scope，`--access public` 只是显式声明。
- 若账号开了「auth-only」2FA，automation token 仍可发布；用 OTP 方式发布需要交互。
- 发 npm 不影响目录收录；它只让安装更快（免 `allowBuilds` 构建授权）并让市场显示下载量。

## 5. 建仓库并首次推送

### 路线 A：GitHub API（本机可直接跑）

```powershell
$h = @{
  Authorization = "Bearer $env:GITHUB_TOKEN"
  'User-Agent'  = 'dsh-page-context'
  Accept        = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}
$owner = '<你的GitHub用户名>'

# 1) 建空仓库（不要 auto_init，否则首次 tree/commit 会撞历史）
Invoke-RestMethod -Method Post -Uri 'https://api.github.com/user/repos' -Headers $h \
  -Body (@{ name = 'dsh-page-context'; description = 'DSH plugin: right-sidebar page browser with element picking into the composer, plus a page-reading tool for the agent.'; private = $false } | ConvertTo-Json)

# 2) 逐个文件建 blob（base64）
#    对每个要提交的文件：POST /repos/$owner/dsh-page-context/git/blobs  {content, encoding='base64'}

# 3) 建 tree（path/mode='100644'/type='block'/sha=<blob sha>）
#    POST /repos/$owner/dsh-page-context/git/trees

# 4) 建 commit（parents = @()）
#    POST /repos/$owner/dsh-page-context/git/commits  {message, tree, parents}

# 5) 建分支引用
#    POST /repos/$owner/dsh-page-context/git/refs  {ref='refs/heads/main', sha=<commit sha>}

# 6) 加 topic（目录 PR 的硬性要求）
Invoke-RestMethod -Method Put -Uri "https://api.github.com/repos/$owner/dsh-page-context/topics" -Headers $h \
  -Body (@{ names = @('dsh-plugin','dsh','deepseek-harness','plugin','browser') } | ConvertTo-Json)

# 7) 打 tag
#    POST /repos/$owner/dsh-page-context/git/refs  {ref='refs/tags/v0.1.0', sha=<commit sha>}
```

要提交的首批文件就是 `files` 列出的那些，外加 `LICENSE`、`README.md`、`.gitignore`、`PUBLISHING.md`
（`.gitignore` 与 `PUBLISHING.md` 只进仓库、不进包）。

### 路线 B：普通 git（在能访问 github.com 的网络执行）

```powershell
git init
git add -A
git commit -m "feat: page context plugin 0.1.0"
git branch -M main
git remote add origin https://github.com/$owner/dsh-page-context.git
git tag v0.1.0
git push -u origin main --tags
```

之后给别人装的 Git 形式是
`dsh plugin --profile <profile> add git+https://github.com/$owner/dsh-page-context.git#v0.1.0`。

## 6. 自建市场索引（可选，B 路）

给「不装 dshmarket、只用宿主内置发现页」的人。宿主内置的「插件 → 发现」只读用户自己添加的
**format 1 索引 JSON**；官方没有集中市场，也不需要任何人批准。

1. 新建 `market/index.json`，把 `market/index.json` 加进 `package.json` 的 `files`。
   顶层 `format: 1`、`title`（多语言对象必须含 `en`）；`plugins[0]` 的 `name` 必须等于 npm 包名；
   `versions[]` 每项要 `version`（精确 SemVer）、`publishTimestamp`（Unix **秒**）、
   `source: { "type": "npm" }` 或 `{ "type": "git", "url": ..., "commit": "<40 位 sha>" }`、
   `engines.dsh`。图标写 `./icon.svg`（相对索引 URL 解析）。
2. 校验：`npm i --no-save @deepseek-ai/dsh-plugin-market-index@0.2.1-alpha.4`，
   用 `parseMarketIndex` + `marketInstallTarget` 跑一遍；**最终裁决**是在真实宿主里添加索引源，
   看「发现」页是否出现卡片、`安装` 是否可点。
3. 托管：GitHub Pages（需 github.com 可达）、`https://unpkg.com/dsh-page-context/market/index.json`
   （跟随 latest，本机实测可达）、或自己的 https 静态站。

## 7. 提交社区目录条目

**前提（CI 会查）**：

- 仓库公开且**创建满 1 天**（今天建仓，最早明天提 PR）。
- `package.json` 声明 `dsh.bundle.patch`，旁边有 `cordis.patch.yml`（已满足）。
- 仓库带 `dsh-plugin` topic。
- 是真实可用的代码，不是占位/纯 README 仓库。
- 描述必须与代码一致：不许营销词；提到数字、命令、API 就要真的存在。

**一个 PR 只加一个文件**：`data/plugins/OWNER__dsh-page-context.yml`

```yaml
url: https://github.com/OWNER/dsh-page-context
name: OWNER/dsh-page-context
category: browser
description:
  en: Right-sidebar page browser that inserts a picked element into the composer as context, plus a page-reading tool for the agent.
  zh: 右侧栏页面浏览器：把选中的页面元素插入输入框作为上下文，并提供给智能体读取网页的工具。
```

- 分类用 `browser`（也可 `ui`；选不准维护者会改，不会打回）。
- `description.en` 必填、**以句号结尾**；`zh` 可选，缺了维护者会补。
- **不要改 README**（列表由 `data/plugins/*.yml` 生成）。
- **不要写 `npm:` 字段**（会被校验拒绝）。
- 一个 PR 最多 3 条；只改自己那一条。

提 PR 的两条路：
- API：`POST /repos/awesome-dsh-plugin/awesome-dsh-plugin/forks` → 在 fork 上建 blob/tree/commit →
  `POST /repos/awesome-dsh-plugin/awesome-dsh-plugin/pulls`（`head = OWNER:branch`）。
- 网页：在能访问 github.com 的网络里打开仓库，用 GitHub 的网页编辑器加文件并提 PR。

合并后站点与 dshmarket 会按日构建自动收录，不需要再通知谁。

## 8. 安装验收

```text
plugin_manager · install_bundle · target = dsh-page-context@0.1.0
```

安装后刷新页面，按 README「手工验收」跑一遍（引导页卡片、打开页面、选元素、`page_context` 读渲染 DOM）。

开发态恢复（改代码即时生效）：

```text
plugin_manager · install_bundle · target = D:\dsh-plugins\page-context
```

该路径会被记为 `link:` 依赖，与 npm 版本互斥，二选一。

## 9. 一句话现状

- 官方没有「上传到市场」的入口：官方 on-demand 目录只收 `@deepseek-ai/*`；能被别人看到的市场是社区目录
  awesome-dsh-plugin（dshmarket 读它）与自建索引源。
- 上架 ≠ 安全背书；收录也不代表质量评价。
