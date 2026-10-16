# PromptForge 交接文档 · 2026-03-27

## 当前状态

项目主干功能已经基本打通，当前重点从“新增底层能力”转向“产品收口与稳定性修复”。

当前工作区状态：
- `git status` 干净
- 最新提交：`9405a1e` `fix(settings): preserve llm defaults and saved keys`
- 最新打包可用目录：`E:\生图提示词积累\out-app-ai-api-fix\win-unpacked\PromptForge.exe`

## 已完成的大阶段

### Phase 0
- Electron + React + TypeScript + Vite 脚手架
- 严格 TS / ESLint / Prettier
- main / renderer / preload / shared 目录结构
- SQLite 初始化与迁移
- 强类型 IPC + preload bridge

### Phase 1
- 类型自动检测器
- NAI / SD / ComfyUI 解析器
- aitag 导入与图片缓存
- 作品列表 / 详情 / 收藏 / 删除 IPC
- 图片缓存管理

### Phase 2
- LLM Service + OpenAI Compatible Provider
- Prompt 模板 CRUD
- 分析结果入库
- 标签系统 CRUD
- 工作流提取、SlotMap、净化、绑定

### Phase 3
- ComfyUI 测试链路与测试页
- 远端 LoRA / Checkpoint 扫描与哈希缓存
- Civitai 集成
- SD：`hash/version` 精确优先
- ComfyUI：名称混合搜索回退

### Phase 4
- 诊断日志台 `/logs`
- Gallery 双模式搜索
- 详情页 tag 点击回跳 Gallery 搜索
- 设置页存储/备份
- 应用数据目录迁移
- AI API 多配置管理

## 关键设计约束

### LLM 分析
- 现在是**单图分析**
- 分析结果按 `entry_id + image_index` 存储
- LLM payload 已轻量化，不再发送完整 `raw_json`
- 当前运行时 payload 结构是：
  - `entry`
  - `analysisTarget`
  - `rawContext.work`
  - `currentImage`

相关文件：
- `E:\生图提示词积累\src\main\services\llm\llm-service.ts`
- `E:\生图提示词积累\docs\llm-prompt-stack.md`

### 模型名展示
- `SD` 和 `ComfyUI` 的模型 / LoRA 名称都**不再提前猜**
- 详情页展示依赖当前图的 LLM 分析结果
- 但 `SD` 的远端匹配和 Civitai 检索仍会继续利用原始 metadata 里的 `hash / modelVersionId`

### 远端模型与 Civitai
- 远端扫描现在覆盖：
  - `models/loras`
  - `models/lycoris`
  - `models/checkpoints`
- 已支持哈希缓存与增量跳过
- `SD` 搜索策略：
  - `modelVersionId`
  - `hash`
  - 不自动名称猜测
- `ComfyUI` 仍走名称混合搜索回退

### AI API 设置
- 设置页已完整暴露多配置管理
- 修复后行为：
  - 测试连接会继承已保存配置的 API Key
  - 只要配置列表非空，系统始终保持一条默认配置
  - `safeStorage` 不可用时拒绝保存 API Key，不再明文落库

## 最近完成的功能

### 1. Gallery 双模式搜索
- `basic`：
  - 标题
  - 作者
  - 简介
  - 原站 tag
  - 用户 tag
- `metadata`：
  - `prompt_text`
  - `ai_json`
  - `workflow`
  - `model`
  - `lora`
- 搜索已下沉 SQLite，分页/排序/类型筛选与搜索一起生效

### 2. 存储与迁移
- 设置页可查看：
  - 数据库路径
  - 缓存路径
  - 导出目录
  - 应用数据根目录
- 可执行：
  - 导出数据库备份
  - 导入数据库备份
  - 迁移整个应用数据目录

### 3. AI API 多配置
- 左侧配置列表
- 右侧编辑器
- 支持：
  - 新建
  - 切换
  - 保存
  - 删除
  - 设默认
  - 测试连接
  - provider 预设

## 当前仍值得继续收口的部分

### 优先级 1
- 详情页模型区 / Civitai 区的最终产品化整理
  - 状态语言还可以更一致
  - 卡片层级和交互可再收

### 优先级 2
- Gallery UI 最后一轮成品化
  - 搜索区还可继续压缩
  - 卡片信息密度和 hover 状态可再优化

### 优先级 3
- 日志台可继续增强
  - 现在是手动刷新
  - 还没有实时推送

### 优先级 4
- `提示词集` / `收藏` 页面重做
  - 当前 `提示词集` 实际承担了错误的“收藏/标签云”功能
  - 当前 `收藏` 页面也没有正确落地真实收藏能力
  - 下一阶段需要把两页职责重新拆清

## 高风险点 / 已知边界

1. LLM 分析仍可能因为**当前图自己的 `aiJson` 太大**导致上游 `400 INVALID_ARGUMENT`
- 已经去掉完整 `raw_json`
- 但超大工作流本身仍可能过重
- 如果继续报错，下一步应该做的是：
  - 对 `currentImage.aiJson` 再做摘要/裁剪
  - 而不是重新把完整 raw 发回去

2. ComfyUI 来源的模型识别天然不如 SD 稳
- `SD` 有 `hash`
- `ComfyUI` 往往没有
- 所以 `ComfyUI` 的远端匹配 / Civitai 搜索仍然只能做混合搜索和猜测

3. 打包目录不要反复覆盖正在运行的 `out-app\win-unpacked`
- 这会导致 Windows 文件锁问题
- 更稳的方式是打到新目录，例如：
  - `out-app-ai-api-fix`
  - `out-app-xxx`

## 下一阶段明确需求：提示词集 / 收藏重构

### 1. 收藏页
- 当前 `提示词集` 页里那套“标签云/条目列表”不应该继续留在 `提示词集`
- 这部分应该迁回 `收藏` 页，并修正为真正的收藏页
- 当前已知问题：
  - 没有正确识别收藏信号
  - 把所有图集都放出来了，而不是仅收藏条目
  - 版面严重挤压，信息密度失衡
- 目标：
  - `收藏` 页只展示真正被收藏的条目
  - 布局按 Gallery / Detail 的成品标准重新收口

### 2. 提示词集页
- `提示词集` 应该变成“提示词预设库”，不再承担收藏或标签云展示
- 数据来源：**当前图的 LLM 分析结果导出**
- 目标流程：
  1. 用户在详情页对某张图完成 LLM 分析
  2. 点击“导出为提示词预设”
  3. 选择要导出的分类/条目
  4. 命名并保存为一条提示词预设
  5. 在 `提示词集` 页里浏览这些预设

### 3. 导出预设时的选择与编辑能力
- 必须支持：
  - 按分类勾选导出，例如：质量词、风格词、构图词等
  - 全选 / 取消全选
  - 只勾选部分分类
  - 在分类内部逐个排除提示词
  - 逐个编辑提示词文本
  - 保留并导出权重
  - 保留并导出 `note`（标准中文含义）
- 交互要求：
  - 每个提示词条目上有删除/排除入口
  - 点击提示词本身可以直接修改内容

### 4. 正负提示词与预设详情
- 预设需要区分：
  - 正向提示词
  - 负向提示词
- `提示词集` 首页显示的是“一个个被命名的预设条目”
- 点进单条预设后，页面应展示：
  - 预设名称
  - 正向提示词内容
  - 负向提示词内容
  - 参考图（导出来源图片）

### 5. 复制与权重语法模式
- 预设详情里应支持：
  - 一键复制全部正向提示词
  - 一键复制全部负向提示词
- 因为 `NAI` 和 `ComfyUI/SD` 的权重写法不同，需要支持两种导出模式：
  - `NAI` 模式
  - `ComfyUI/SD` 模式
- 要求：
  - 导出时可先选择一种模式
  - 预设详情内也能切换两种模式
  - 切换时同步转换权重写法

## 推荐下一步

如果新窗口接着做，建议按这个顺序：

1. 先重构 `收藏` / `提示词集` 职责
   - 把错误的收藏展示从 `提示词集` 挪回 `收藏`
   - 修正真实收藏逻辑
   - 重新定义 `提示词集` 为“提示词预设库”
2. 在详情页 LLM 分析区新增“导出为提示词预设”
3. 做预设选择/编辑/保存/详情页/双语法切换整套链路
4. 然后再继续一般性的 UI 收口（Gallery / Detail / Civitai）

## 关键文件清单

### 搜索与图库
- `E:\生图提示词积累\src\renderer\pages\Gallery\index.tsx`
- `E:\生图提示词积累\src\renderer\pages\Gallery\Gallery.module.css`
- `E:\生图提示词积累\src\main\db\repositories\entries.repo.ts`

### 详情页
- `E:\生图提示词积累\src\renderer\pages\Detail\index.tsx`
- `E:\生图提示词积累\src\renderer\components\entry\SourceCard.tsx`
- `E:\生图提示词积累\src\renderer\components\entry\TagManager.tsx`

### LLM
- `E:\生图提示词积累\src\main\services\llm\llm-service.ts`
- `E:\生图提示词积累\src\main\db\repositories\llm-model-configs.repo.ts`
- `E:\生图提示词积累\src\renderer\pages\Settings\index.tsx`

### 远端模型 / Civitai
- `E:\生图提示词积累\src\main\services\remote\remote-lora.service.ts`
- `E:\生图提示词积累\src\main\services\civitai\civitai.service.ts`
- `E:\生图提示词积累\src\main\services\civitai\civitai-client.ts`

### 日志
- `E:\生图提示词积累\src\renderer\pages\Logs\index.tsx`
- `E:\生图提示词积累\src\main\services\logs\app-logs.service.ts`

### 设计与任务板
- `E:\生图提示词积累\docs\shared-task-board.md`
- `E:\生图提示词积累\docs\llm-prompt-stack.md`
