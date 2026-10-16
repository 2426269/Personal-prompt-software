# Phase 6：工作流纯化、双模式测试台与预设联动

## Summary

- `工作流页` 以“管理台”为目标，而不是图形编辑器。
- `测试页` 升级为 `ComfyUI / NovelAI` 双模式，并支持“当前图 / 提示词预设”两种提示词来源。
- `ComfyUI` 执行继续遵循官方 `POST /prompt` 链路；`NovelAI` 使用官方 Swagger 中的 `POST /ai/generate-image`。
- 工作流净化继续采用确定性规则，不依赖 AI 重写。

## Implementation Notes

- **工作流领域**
  - 在 `WorkflowSummary / WorkflowDetail` 中补 `runnable / runnableSource / nonRunnableReason`，由主进程统一判定。
  - `cleanWorkflow()` 继续负责提示词占位符替换、seed 随机化、LoadImage 清空、路径匿名化、UI 元数据剥离。
  - 新增 `refreshWorkflow()`，将重新净化后的 `clean_json` 与 `slot_map_json` 落回数据库。

- **工作流页**
  - 左侧显示工作流列表，提供名称、来源条目、格式、节点数、默认测试标记、可执行状态。
  - 右侧支持 `Original / Clean / API Prompt / SlotMap` 四视图。
  - 页面内支持复制、导出、设默认、重新净化、来源条目绑定/解绑、回到来源详情、发送到测试页。

- **测试页**
  - 顶层模式切换：`ComfyUI` 与 `NovelAI`。
  - 提示词来源切换：`当前图` 与 `提示词预设`。
  - `当前图` 模式下，按条目类型调用现有解析器做 best-effort 预填：
    - `NAI` → `parseNAI`
    - `SD` → `parseSD`
    - `ComfyUI` → `parseComfyUI`
  - `提示词预设` 模式下，复用预设库并按目标模式切换 `NAI / ComfyUI-SD` 语法。

- **NovelAI**
  - 新增 `nai` 领域类型、IPC、preload 暴露与主进程 service。
  - 连接测试使用官方鉴权接口：`GET /user/information`，并补充读取 `/user/subscription` 的订阅信息。
  - 生成使用官方 `POST /ai/generate-image`：
    - `generate` → 文生图
    - `img2img` → 图生图
  - 图生图支持两种图片来源：当前来源图 / 预设参考图、本地上传图。

## Routing

- `/testing` 支持以下查询参数：
  - `mode=comfy|nai`
  - `entryId`
  - `imageIndex`
  - `workflowId`
  - `presetId`
- 详情页、预设库页、工作流页都统一使用这组参数跳转。

## Constraints

- 不做工作流图形编辑器。
- 不做 slotMap 手工编辑。
- 不做 NovelAI inpaint。
- 仍然坚持“LLM 分析只按单图输入，不回传完整 `raw_json`”。
