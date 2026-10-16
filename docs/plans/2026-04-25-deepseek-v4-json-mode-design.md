# DeepSeek V4 JSON Mode And Model Discovery Design

日期：2026-04-25

## 背景

DeepSeek 官方文档近期更新后，当前 PromptForge 的 `AI API 配置` 与分析链路有三个明显落后点：

1. 默认模型仍停留在 `deepseek-chat`
2. 设置页仍要求用户手填模型名
3. Provider 仅做了基础 `response_format: { type: "json_object" }`，没有把 DeepSeek `JSON Output` 文档里的约束和兜底真正落到运行时

本次改造目标是把 DeepSeek 的最新官方推荐接入现有 OpenAI 兼容 provider，同时不破坏现有单图分析 payload 约束。

## 目标

1. DeepSeek 默认 endpoint 仍保持 `https://api.deepseek.com`
2. DeepSeek 默认模型切换为 `deepseek-v4-flash`
3. 设置页模型选择改为：
   - 先填写 `endpoint / apiKey`
   - 再测试连接
   - 自动拉取 `/models`
   - 最后从可用模型列表中选择
4. 为 DeepSeek 暴露更多高级参数，方便自用调参：
   - `strictJsonMode`
   - `maxTokens`
   - `thinkingEnabled`
5. Provider 在 DeepSeek 场景下强化 JSON 输出稳定性：
   - 自动补足 `json` 关键词提示
   - 优先使用 `response_format`
   - 遇到空 `content` 时做一次带更强 JSON 提示的重试

## 非目标

1. 不改动当前分析 payload 的主结构
2. 不把完整 `raw_json` 发回模型
3. 不在这一轮引入 provider 专属复杂表单，如每家厂商各自的几十个参数

## 设计

### 1. 配置模型

`ai_model_configs` 增加三个字段：

- `max_tokens`
- `strict_json_mode`
- `thinking_enabled`

对应前端 `LLMModelConfigInput / Summary` 统一挂到 `advanced` 下。

### 2. 模型发现

新增一条 IPC：

- `window.api.discoverLLMModels(input)`

同时保留 `testLLMConfig(input)`，并让测试结果顺带返回：

- `availableModels`

设置页的默认交互变为：

1. 用户填写 `endpoint / apiKey`
2. 点击“测试连接”
3. 主进程先请求 `/models`
4. 再选择一个合适模型做最小 JSON 连通测试
5. 前端收到模型列表后写入下拉框

### 3. JSON Mode

Provider 层不依赖模板作者手动记住所有细节，而是统一在运行时注入：

- 对 DeepSeek 开启 `strictJsonMode` 时，自动确保 prompt 中存在 `json` 关键词
- 自动带上 `response_format: { type: "json_object" }`
- `max_tokens` 透传到请求体
- `thinkingEnabled` 对 DeepSeek 透传为 `thinking` 参数

### 4. 空内容兜底

DeepSeek 官方文档明确提到 JSON Mode 可能偶发空 `content`。

因此运行时策略改为：

1. 先走正常 JSON Mode
2. 如果 HTTP 成功但 `content` 为空：
   - 对 DeepSeek 再重试一次
   - 重试时附加更强的 JSON 提示
3. 如果上游直接报 `response_format` 类 HTTP 错误，再退回无 `response_format` 模式，但仍保留 JSON 提示

## 验收

1. 设置页 DeepSeek 默认预设显示：
   - `https://api.deepseek.com`
   - 默认推荐模型为 `deepseek-v4-flash`
2. 模型输入改为下拉选择，不再手填
3. 测试连接后能自动展示 `/models` 返回的模型列表
4. DeepSeek 可开启 `thinking`、设置 `max_tokens`、切换 `strictJsonMode`
5. `typecheck / lint / build` 全部通过
