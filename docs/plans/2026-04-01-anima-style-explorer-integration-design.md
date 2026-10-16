# Phase 7：Anima Style Explorer 集成为独立画师参考页

## 目标

将 `ThetaCursed/Anima-Style-Explorer` 的离线库接入 PromptForge，做成新的一级页面 `画师参考`（`/artists`），用于画师串检索、预览、收藏、文件夹管理与一键送测。

## 设计决策

- 不嵌原项目 `index.html`，只复用：
  - `app/data.js`
  - `images/`
- 离线库采用“导入到 PromptForge 应用数据目录”的方式落地，不依赖运行时继续访问源目录。
- 画师数据不并入现有 `entries`，而是使用独立的 `anima_*` 表与 IPC。
- 收藏和文件夹独立于现有 `/favorites`，避免与作品收藏体系混用。
- 测试页只接收 Anima 输出的画师串，不把 Anima 直接写入提示词预设库。

## 数据结构

- `anima_library_meta`
  - 保存源目录、导入时间、总画师数
- `anima_artists`
  - 保存画师 `id / name / search_name / post_count / uniqueness_score / page_bucket / image_rel_path`
- `anima_favorites`
  - 保存独立画师收藏
- `anima_folders`
  - 保存文件夹定义
- `anima_folder_items`
  - 保存文件夹与画师关联

图片不入库，预览图路径统一按当前 `userData/anima-style-explorer/images/<p>/<id>.webp` 动态拼接。

## 主流程

1. `/artists` 首次进入时读取 `anima_library_meta`
2. 若未导入，则展示导入卡片
3. 导入时：
   - 校验源目录中的 `app/data.js` 与 `images/`
   - 解析 `galleryData`
   - 复制 `images/` 到当前应用数据目录
   - 写入 `anima_artists`
   - 保留已有收藏/文件夹，并按当前数据集做清理
4. 导入完成后，页面支持：
   - 搜索
   - 按名称 / Works / Uniqueness / 收藏时间排序
   - 收藏
   - 文件夹归类
   - TXT / JSON 导出
   - JSON 导入收藏
   - 发送到测试页

## 测试页联动

- `/testing` 新增 `promptSource=anima`
- 携带 `animaArtistIds=<csv>`
- 测试页读取选中的画师名后，直接拼成正向提示词：
  - `artist_a, artist_b, artist_c`
- `ComfyUI` 与 `NovelAI` 都复用同一份画师标签原文
- `img2img` 在 `anima` 模式下不使用来源图，需改用上传图片

## 首版边界

- 保留：导入、列表、详情、收藏、文件夹、导入导出、送测
- 不做：
  - Swipe Mode
  - 原站完整样式复刻
  - 与现有 `/favorites` 合并
  - 并入 `entries`
