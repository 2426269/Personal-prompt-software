# 新窗口交接提示词

你现在接手的是 `E:\生图提示词积累` 里的 PromptForge 项目。

先读这几个文件，再继续工作：
- `E:\生图提示词积累\docs\plans\2026-03-27-new-window-handoff.md`
- `E:\生图提示词积累\docs\shared-task-board.md`
- `E:\生图提示词积累\docs\llm-prompt-stack.md`

当前状态要求你先记住：

1. 项目主干已经基本完成，当前重点是**Phase 4B 的 UI 收口和稳定性修复**，不要再随便扩新的大底层模块。
2. LLM 分析已经改成**单图分析**，并且 payload 已轻量化。当前运行时发送结构是：
   - `entry`
   - `analysisTarget`
   - `rawContext.work`
   - `currentImage`
   不要再把完整 `raw_json` 发给模型。
3. 模型/LoRA 名称展示规则：
   - `SD` 和 `ComfyUI` 都要等当前图的 **LLM 分析结果** 才展示名称
   - `SD` 的远端/Civitai 匹配继续利用原始 metadata 里的 `hash / modelVersionId`
   - `ComfyUI` 没稳定 hash，继续允许名称混合搜索和猜测
4. AI API 设置页已经支持：
   - 多配置
   - 切换
   - 保存
   - 删除
   - 设默认
   - 测试连接
   - provider 预设
   而且修复了：
   - 测试连接继承已保存 key
   - 默认配置不会被删空
   - `safeStorage` 不可用时拒绝明文保存 key
5. 远端扫描已经支持：
   - `models/loras`
   - `models/lycoris`
   - `models/checkpoints`
   - 哈希缓存
   - 增量跳过
6. Gallery 已支持双模式搜索：
   - `basic`：标题 / 作者 / 简介 / 原站 tag / 用户 tag
   - `metadata`：`prompt_text / ai_json / workflow / model / lora`
   点击详情页 tag 会回到 Gallery 执行 `basic` 搜索。

当前工作区状态：
- `git status` 干净
- 最新提交：`9405a1e fix(settings): preserve llm defaults and saved keys`
- 最近可用包：`E:\生图提示词积累\out-app-ai-api-fix\win-unpacked\PromptForge.exe`

新增的下一阶段明确需求：

1. `提示词集` 现在方向是错的
   - 它当前承担了错误的“收藏/标签云”功能
   - 这部分应该迁回 `收藏` 页
2. `收藏` 页当前也没做好
   - 没有识别真实收藏信号
   - 把所有图集都放了出来
   - 布局也需要重做
3. `提示词集` 应该重做成“提示词预设库”
   - 来源是当前图的 **LLM 分析结果**
   - 需要支持从分析结果里导出预设
   - 导出时可勾选分类、全选、排除单个提示词、直接改词、保留权重、保留 note 中文含义
   - 预设要分正向和负向
   - 预设详情页右侧放参考图
   - 预设详情里支持一键复制正向 / 负向全部内容
   - 需要支持 `NAI` 和 `ComfyUI/SD` 两种权重语法模式，并且在导出时可选、在详情页可切换

建议你优先做的事：

1. 先把 `收藏` / `提示词集` 两页职责拆正：
   - 收藏页只展示真实收藏条目
   - 提示词集页只展示已保存的提示词预设
2. 再做“从详情页 LLM 分析结果导出预设”的整套链路
3. 如果 LLM 还有 `400 INVALID_ARGUMENT`，优先继续裁剪 `currentImage.aiJson`，不要回退到发送完整 raw。
4. 打包时尽量输出到新的 `out-app-*` 目录，避免 Windows 锁住正在运行的旧 EXE。

做改动前先说明方案，完成后：
- 更新 `docs/shared-task-board.md`
- 必要时新增 `docs/plans/YYYY-MM-DD-<topic>-design.md`
- 通过 `typecheck / lint / build`
- 再打包给用户验证
