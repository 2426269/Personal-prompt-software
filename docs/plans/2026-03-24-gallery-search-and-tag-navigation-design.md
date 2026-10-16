# Gallery Search And Tag Navigation Design

日期：2026-03-24

## 目标

在不新增独立标签云页面的前提下，对齐 aitag.win 的浏览方式：

1. 详情页点击原站 tag 或用户 tag，可直接查看同标签作品
2. Gallery 提供两种搜索模式：
   - `basic`：作品/作者/简介/tag
   - `metadata`：Prompt / Workflow / 模型 / LoRA 等元数据
3. 搜索结果覆盖全库，并与分页、排序、类型筛选保持一致

## 方案

采用后端统一搜索，前端只负责模式切换和参数传递。

### 搜索模式

#### basic

命中字段：

- `entries.title`
- `entries.custom_name`
- `entries.author_name`
- `entries.author_id`
- `entries.caption`
- 原站 tags
- 用户 tags

#### metadata

命中字段：

- `images.prompt_text`
- `images.ai_json`
- `entries.raw_json`
- 工作流 / 模型 / LoRA 等元数据关键词

## 详情页标签点击

详情页中的两类标签都可点击：

- 原站 tags
- 用户 tags

点击后跳转到 Gallery，并自动切换到 `basic` 模式，同时将该标签写入搜索词。行为等价于 aitag.win 上“点击标签后执行一次关键词搜索”。

## Gallery 行为

- 顶部保留两个输入框：
  - 输入框 1：基础搜索
  - 输入框 2：元数据搜索
- 一次只激活一种搜索模式
- 搜索结果仍按作品卡片展示，不改成图片级列表
- 类型筛选、排序、分页继续沿用原 Gallery 逻辑

## 后端约束

- 搜索逻辑必须下沉 SQLite
- 不再以“当前页已加载 40 条”的前端本地过滤作为主搜索路径
- `db:entries:list` 扩展搜索模式和搜索词参数

## 验收标准

1. 点击详情页任意原站 tag，可跳回 Gallery 查看同标签作品
2. 点击详情页任意用户 tag，可跳回 Gallery 查看同标签作品
3. `basic` 模式能搜到标题/作者/简介/原站 tag/用户 tag
4. `metadata` 模式能搜到 prompt/workflow/model/lora 关键词
5. 搜索结果与分页、排序、类型筛选不冲突

## 本轮不做

- 独立标签云页面
- 命中高亮
- 复杂布尔搜索
