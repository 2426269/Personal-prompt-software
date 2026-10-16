# 2026-03-27 · AI API 多配置设置页设计

## 目标

在不改动现有后端 LLM 配置持久化与 IPC 协议的前提下，把 `AI API` 配置管理完整暴露到设置页，支持多配置切换、保存、删除、设默认、测试连接，并允许用户针对不同模型网关自由切换 `endpoint / apiKey / modelName / temperature`。

## 范围

### 本轮实现

- 设置页新增 `AI API 配置` 区块
- 左侧显示配置列表
- 右侧显示当前配置编辑器
- 支持：
  - 新建配置
  - 切换配置
  - 保存配置
  - 删除配置
  - 设为默认
  - 测试连接
- 支持 provider 预设：
  - `openai`
  - `deepseek`
  - `qwen`
  - `glm`
  - `ollama`

### 本轮不做

- 配置导入/导出
- 配置分组
- 调用历史
- Prompt 模板与模型配置联动推荐

## 交互设计

### 左侧列表

每个配置卡片显示：

- 名称
- provider
- modelName
- 默认标记
- 更新时间

点击卡片切换右侧编辑器。

### 右侧编辑器

字段：

- `name`
- `provider`
- `endpoint`
- `apiKey`
- `modelName`
- `temperature`
- `isDefault`

按钮：

- `保存配置`
- `测试连接`
- `删除配置`

### Provider 预设

切换 provider 时，如果用户没有手工改写 endpoint，则自动填入推荐地址：

- `openai` → `https://api.openai.com/v1`
- `deepseek` → `https://api.deepseek.com`
- `qwen` → `https://dashscope.aliyuncs.com/compatible-mode/v1`
- `glm` → `https://open.bigmodel.cn/api/paas/v4`
- `ollama` → `http://127.0.0.1:11434/v1`

如果 endpoint 已被用户手动改写，则不强制覆盖。

### 密钥行为

- 编辑已有配置时：
  - 留空表示保持原 API Key
  - 测试连接也会继承已保存的 API Key，不要求重新输入
- 新建配置时：
  - 留空表示当前不写入密钥
  - 非 `ollama` 配置如果之后直接用于分析，会在运行时提示缺少 API Key
 - 依赖 Electron `safeStorage`
  - 如果系统安全存储不可用，则拒绝保存 API Key，不回退明文写库

### 默认配置行为

- 只要配置列表非空，系统始终维持且只维持一条默认配置
- 删除默认配置时，会自动提升另一条配置为默认
- 取消默认勾选并保存时，如果还有其他配置，会自动把默认权交给另一条配置
- AI 分析主路径继续依赖“默认配置存在”这一约束

## 技术实现

### 复用现有 IPC

- `window.api.listLLMConfigs()`
- `window.api.saveLLMConfig(input)`
- `window.api.deleteLLMConfig(id)`
- `window.api.testLLMConfig(input)`

### 测试连接策略

测试连接使用当前编辑表单的瞬时配置，但如果正在编辑已保存配置且未重新输入 API Key，则会自动继承该配置已保存的密钥：

```ts
window.api.testLLMConfig({
  config: currentForm
})
```

这样用户无需先保存即可验证 endpoint / apiKey / model 是否可用。

### 状态管理

设置页新增以下状态：

- 配置列表
- 当前选中配置 id
- 当前编辑表单
- 保存中状态
- 测试中状态
- 通知文本

## 验收标准

- 可以新建至少两套 AI API 配置并自由切换
- 可以把任意一条设为默认配置
- 可以删除非必要配置
- 可以测试当前表单配置的连接
- 切换 provider 时，如果 endpoint 未手改，会自动切换到推荐地址
- 设置页不会破坏现有模板/Civitai/远端模型配置功能
