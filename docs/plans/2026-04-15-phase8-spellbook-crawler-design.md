# Phase 8：法典库抓取与本地缓存设计

## 目标

将 `nai4.top` 中对 PromptForge 有直接价值的法典内容整合为新的一级页面 `法典库`，并保证法典站内的核心内容以本地缓存形式展示，而不是只保留外链。

本轮先完成一条可用纵切：

1. 从 `法典目录` 发现条目
2. 对站内法典页抓取正文、提示词候选与示例图
3. 将抓取结果写入本地数据库与图片缓存目录
4. 在 `/spellbook` 页面中展示并支持送测到 `/testing`

## 核心决策

- 路由使用 `/spellbook`，页面文案使用 `法典库`
- 不使用 Node 侧直接 HTTP 抓取作为唯一实现
  - 当前机器在某些网络环境下对 `nai4.top` 会出现 `ECONNRESET`
  - 因此抓取主链采用隐藏 `BrowserWindow` 加 DOM 提取
  - 这样使用 Chromium 实际渲染后的 DOM，更接近用户浏览器看到的结构
- 站内内容必须本地缓存：
  - 画师串 / 提示词片段
  - 正文摘要
  - 示例图
- 站外资源首版仍保留为导航卡片，不强求全文抓取

## 数据结构

### spellbook_meta

- 保存：
  - 根目录 URL
  - 总条目数
  - 总图片数
  - 最近同步时间

### spellbook_entries

- 每条资源保存：
  - `id`
  - `parent_entry_id`
  - `title`
  - `summary`
  - `category`
  - `kind`
  - `source_url`
  - `prompt_text`
  - `prompt_candidates_json`
  - `body_text`
  - `sections_json`
  - `related_links_json`
  - `model_hints_json`
  - `tags_json`
  - `cover_image_rel_path`
  - `image_count`
  - `child_count`
  - `synced_at`

### spellbook_images

- 每张缓存图保存：
  - `entry_id`
  - `source_url`
  - `local_rel_path`
  - `caption`
  - `sort_order`

## 抓取流程

### 1. 目录页发现

- 加载 `https://nai4.top/法典/法典目录/`
- 在 `main` 范围内提取：
  - 卡片标题
  - 卡片摘要
  - 链接 URL
  - 是否为站内链接

### 2. 站内详情页抓取

- 对站内链接继续加载页面
- 在主内容区域提取：
  - `title`
  - `summary`
  - `sections`
  - `bodyText`
  - `promptCandidates`
  - `relatedLinks`
  - `images`

### 3. 子页递归

- 对正文里的站内相关链接做一层递归抓取
- 首版限制递归深度为 1，避免一次同步扩散到全站

### 4. 图片缓存

- 对站内页面中的同域图片，使用页面上下文 `fetch()` 拉取二进制并保存到：
  - `userData/spellbook-library/images/...`
- 每个条目首版最多缓存 `8` 张图，用于控制首次同步体积

## 分类策略

首版按启发式规则分类：

- `style_prompt`
  - 默认法典 / 风格 / 融合 / 画师串
- `tool_nav`
  - 工具、网盘、外部入口
- `tag_reference`
  - `tag / 人物 / 角色 / 服装 / characters`

## 与测试页联动

- 新增 `promptSource=spellbook`
- 新增 `spellbookEntryId`
- 测试页读取法典条目的：
  - `promptText`
  - 或 `promptCandidates`
- `NAI / ComfyUI` 继续共用原测试页，只是新增一种提示词来源

## 当前边界

- 首版只做手动同步，不做自动定时更新
- 首版不做收藏、文件夹、批量导出
- 首版对站外文档型资源只做导航卡片，不抓全文
- 首版对子页递归只做一层
- 首版每条只缓存有限数量示例图，不追求整本法典的全量图集离线化
