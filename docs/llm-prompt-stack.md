# PromptForge 当前 LLM 提示词链路

更新时间：2026-03-24

这份文档描述当前运行时真正发送给模型的分析链路。它用于排查日志、修改默认 `systemPrompt`，以及核对单图分析 payload 是否符合预期。

## 1. 当前参与文件

- `src/main/services/llm/prompts/default-template.ts`
- `src/main/services/llm/llm-service.ts`
- `src/main/services/templates/templates.service.ts`
- `src/renderer/components/template/TemplateEditor.tsx`

## 2. 当前默认 System Prompt

来源：`src/main/services/llm/prompts/default-template.ts`

运行时 `system` 消息只使用模板里的 `systemPrompt`。当前默认值是代码内置模板；如果数据库里已有默认模板，则运行时优先使用数据库记录。

## 3. 当前消息结构

运行时发送两条消息：

### system

```text
模板中的 systemPrompt
```

### user

```json
{
  "entry": {
    "id": "entry-id",
    "title": "原始标题",
    "customName": "自定义标题",
    "caption": "作品说明",
    "type": "NAI | SD | ComfyUI",
    "sourceTags": ["站点原始标签"],
    "userTags": ["用户标签"],
    "sourceUrl": "原始来源链接",
    "postDate": "发布日期",
    "views": 123,
    "bookmarks": 45
  },
  "analysisTarget": {
    "mode": "single_image",
    "imageIndex": 0
  },
  "rawContext": {
    "work": {
      "id": 135551608,
      "userid": 11235397,
      "title": "作品标题",
      "caption": "作品描述",
      "tags": "[...]",
      "create_date": "2025-09-26T14:20:46"
    }
  },
  "currentImage": {
    "index": 0,
    "promptText": "当前图片自己的提示词文本",
    "aiJson": {
      "当前图片自己的 SD / ComfyUI / NAI 元数据": true
    },
    "weightHints": [
      {
        "text": "tag",
        "weight": 1.2,
        "source": "explicit_weight"
      }
    ]
  }
}
```

## 4. 当前 payload 约束

当前运行时遵守以下约束：

1. 不再发送完整 `rawJson`
2. 不再发送 `raw.images[*]` 中所有图片的 `ai_json`
3. 单图分析时，只保留：
   - 轻量 `entry`
   - `rawContext.work`
   - 当前图对应的 `currentImage`
4. `currentImage` 中只挂当前图自己的：
   - `promptText`
   - `aiJson`
   - `weightHints`
   - 以及去掉 `ai_json / prompt_text` 后的轻量原图元信息

额外约束：

- 如果 `currentImage.promptText` 已经存在，运行时会在发送前对 `currentImage.aiJson` 做一次去重清洗：
  - 去掉会重复承载提示词正文的字段，例如 `parameters / positive_prompt / negative_prompt / uc / v4_prompt / v4_negative_prompt`
  - 根级别或 `comment` 节点下的 `prompt / positive / negative` 也会被移除
- 目的不是删掉当前图元数据，而是避免同一页提示词同时以 `promptText` 和 `aiJson` 两份形式重复发给模型

这样做的目的，是避免把多张图的 workflow 整包发给模型，减少重复数据和超大请求体。

## 5. 当前已经废弃的旧层

以下旧层已经不是当前运行时链路的一部分：

- `sanitize / full` 包装层
- `nsfw-sanitizer.ts` 的正文替换逻辑
- 旧 payload 结构 `{ entry, prompts, rawJson }`
- 旧的 `buildUserPayload()` 包装链路

这些内容如果仍出现在旧文档、旧日志或旧分析记录中，应视为历史实现，不代表当前运行时行为。

## 6. 当前日志里可以看到什么

`/logs` 页里的 `llm / analyze.request` 会记录：

- `systemPrompt`
- `userPayload`
- `payloadStats.charLength`
- `payloadStats.selectedImageCount`
- `payloadStats.hasRawWork`

其中：

- `selectedImageCount` 在当前单图分析链路下应为 `1`
- `charLength` 可用于判断是否仍然存在异常大的请求体

## 7. 当前保留但仅作兼容的字段

为兼容旧数据库结构，以下字段仍然存在，但不再决定当前分析链路：

- `prompt_templates.mode`
- `PromptTemplateMode`
- `analyzed_templates.nsfw_mode`

## 8. 当前剩余边界

`analyzeEntry()` 仍保留 `imageIndex == null` 的入口，以兼容旧调用路径；但当前详情页实际只走单图分析语义。后续如继续收口，应优先维持单图 payload，不要回退到整条 entry 的多图结构。
