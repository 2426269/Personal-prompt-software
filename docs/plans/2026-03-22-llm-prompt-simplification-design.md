# LLM Prompt Simplification Design

日期：2026-03-22

补充更新：2026-03-24

## 目标

把 PromptForge 当前用于 LLM 分析的多层提示词链路，收敛成“单一可编辑提示词 + 轻量结构化 payload”。

## 当前问题

- 用户实际维护的是 `systemPrompt`，但运行时还会叠加 `sanitize/full` 包装说明。
- `nsfw-sanitizer.ts` 会直接改写原始数据文本，导致用户很难准确判断模型到底读到了什么。
- 模板编辑器里的“分析模式”会强化多层心智模型，但它已经不再是用户真正想维护的核心。

## 方案

采用最小兼容方案：

1. 保留数据库结构和现有模板记录
2. 运行时分析只使用：
   - `systemPrompt`
   - 轻量 JSON payload
3. 不再对 payload 做 NSFW 脱敏替换
4. 不再在模板编辑器里暴露“分析模式”
5. 旧的 `mode` 字段只作为兼容遗留保留，不再驱动实际行为

## 影响范围

- `src/main/services/llm/llm-service.ts`
- `src/renderer/components/template/TemplateEditor.tsx`
- `src/renderer/components/template/TemplateEditor.module.css`
- `docs/llm-prompt-stack.md`

## 风险与处理

- 旧模板记录仍然带 `mode` 字段
  - 处理：保留字段，但运行时忽略
- 旧分析结果里 `nsfwMode` 仍然存在
  - 处理：新结果统一按 `full` 记录，避免和实际行为不一致
- 未来如果要彻底删字段
  - 处理：另起一次迁移，避免这次修改范围失控

## 运行时补充说明（2026-03-24）

在 2026-03-24 的后续实现里，payload 又进一步收口，当前真实结构为：

```json
{
  "entry": { "...": "轻量条目信息" },
  "analysisTarget": {
    "mode": "single_image",
    "imageIndex": 0
  },
  "rawContext": {
    "work": { "...": "仅保留 raw.work" }
  },
  "currentImage": {
    "index": 0,
    "promptText": "...",
    "aiJson": "...",
    "weightHints": []
  }
}
```

当前运行时不再发送完整 `rawJson`，尤其不会再把 `raw.images[*].ai_json` 中所有图片的 workflow 整包带给模型。

## 验收标准

- 用户可以在文档里看到当前完整提示词链路
- 用户只需要维护一版 `systemPrompt`
- 分析运行时不再调用 `buildUserPayload`
- 模板编辑器不再暴露多余的模式切换
