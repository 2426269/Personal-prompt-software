# PromptForge · 接口文档

> **版本**：v1.0 | **日期**：2026-03-05

---

## 一、外部 API 集成

### 1. aitag.win API

#### 1.1 获取作品详情

```
GET https://aitag.win/api/work/{pixiv_id}
```

**请求示例**：`GET https://aitag.win/api/work/141908098`

**响应结构**：
```jsonc
{
  "work": {
    "id": 141908098,         // Pixiv ID
    "userid": 122658658,     // 作者 ID
    "title": "作品标题",
    "caption": "作品简介（HTML）",
    "tags": "[\"R-18\",\"AI作成\",\"角色名\"]",  // JSON 字符串
    "create_date": "2026-03-04T22:28:14+09:00",
    "total_view": 32,
    "total_bookmarks": 1
  },
  "images": [
    {
      "ai_json": "{ ... }",     // 完整提示词参数（字符串化 JSON）
      "prompt_text": "正向提示词原文",
      "index": 0
    }
  ]
}
```

**图片 URL 拼接**：
```
https://aitag.win/{TYPE}/{AUTHOR_ID}/{PIXIV_ID}_p{INDEX}.webp
```
- TYPE：`SD` / `NAI` / `COMFYUI`（大写）
- INDEX：从 0 开始

**注意事项**：
- 无需鉴权
- 建议请求间隔 ≥ 500ms，避免被限流
- 图片下载建议带 `Referer: https://aitag.win` 请求头

#### 1.2 搜索作品列表

```
GET https://aitag.win/api/ai_works_search
```

| 参数       | 类型   | 说明                                       |
| ---------- | ------ | ------------------------------------------ |
| page       | int    | 页码，从 1 开始                            |
| page_size  | int    | 每页数量（默认 60）                        |
| sort       | string | 排序：`new` / `popular`                    |
| time_range | string | 时间范围：`all` / `day` / `week` / `month` |
| keyword    | string | 搜索关键词（可选）                         |

---

### 2. ComfyUI API

**Base URL**：用户配置的公网地址（如 `https://xxx.seetacloud.com:8443`）

#### 2.1 提交生图任务

```
POST /prompt
Content-Type: application/json

{
  "prompt": { <api_prompt_json> },
  "client_id": "promptforge"
}
```

**响应**：
```json
{
  "prompt_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "number": 1
}
```

#### 2.2 查询任务状态

```
GET /history/{prompt_id}
```

**响应**：
```jsonc
{
  "<prompt_id>": {
    "status": {
      "status_str": "success",      // success / error
      "completed": true
    },
    "outputs": {
      "<node_id>": {
        "images": [
          {
            "filename": "ComfyUI_00001_.png",
            "subfolder": "",
            "type": "output"
          }
        ]
      }
    }
  }
}
```

#### 2.3 获取生成图片

```
GET /view?filename={filename}&subfolder={subfolder}&type={type}
```

返回图片二进制数据。

#### 2.4 获取系统信息（连接测试用）

```
GET /system_stats
```

#### 2.5 错误处理

| 场景              | 处理方式                                      |
| ----------------- | --------------------------------------------- |
| 连接超时          | 提示"ComfyUI 不可达，请检查 URL 或服务器状态" |
| 任务排队中        | 显示队列位置（如可获取）                      |
| 任务失败          | 显示 ComfyUI 返回的错误信息                   |
| /history 路由 404 | 提示用户在设置中修改 History 路由路径         |

---

### 3. Civitai API

**Base URL**：`https://civitai.com/api/v1`

#### 3.1 搜索模型

```
GET /models?query={filename}&types=LORA&limit=5
```

**也支持按 hash 搜索**（SD 格式中有 `Lora hashes`）：
```
GET /model-versions/by-hash/{sha256}
```

**响应关键字段**：
```jsonc
{
  "items": [
    {
      "id": 12345,
      "name": "模型名称",
      "type": "LORA",
      "stats": {
        "downloadCount": 1000,
        "favoriteCount": 200,
        "rating": 4.8
      },
      // 页面链接拼接: https://civitai.com/models/{id}
    }
  ]
}
```

**注意**：
- 匿名请求限流较严格，建议配置 API Token
- Token 通过 `Authorization: Bearer {token}` 传递

---

### 4. LLM 统一接口（OpenAI 兼容格式）

所有大模型均使用 OpenAI Chat Completions 格式：

```
POST {endpoint}/v1/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "model": "{model_name}",
  "temperature": 0.3,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<分析模板 System Prompt>" },
    { "role": "user", "content": "<原始提示词数据>" }
  ]
}
```

**各 Provider Endpoint 参考**：

| Provider    | Endpoint                                         |
| ----------- | ------------------------------------------------ |
| OpenAI      | `https://api.openai.com`                         |
| DeepSeek    | `https://api.deepseek.com`                       |
| 通义千问    | `https://dashscope.aliyuncs.com/compatible-mode` |
| 智谱 GLM    | `https://open.bigmodel.cn/api/paas`              |
| Ollama 本地 | `http://localhost:11434`                         |

**AI 分析输出格式要求**（严格 JSON）：

```jsonc
{
  "artist_tags": [
    { "text": "artist:tamagoroo", "weight": 1.0, "confidence": 0.95 }
  ],
  "quality_tags": [
    { "text": "masterpiece", "weight": 1.4, "confidence": 0.99 },
    { "text": "best quality", "weight": 1.4, "confidence": 0.99 }
  ],
  "lighting_tags": [
    { "text": "dramatic lighting", "weight": 1.0, "confidence": 0.8 }
  ],
  "style_tags": [
    { "text": "flat color", "weight": 1.0, "confidence": 0.7 }
  ],
  "settings": {
    "model": "waiIllustriousSDXL_v160",
    "loras": [
      { "name": "Haruka2025-10.safetensors", "weight": 1.0 }
    ],
    "steps": 33,
    "cfg": 5.5,
    "sampler": "euler_ancestral",
    "scheduler": "karras",
    "size": { "width": 896, "height": 1152 }
  },
  "removed_specific": [
    { "text": "kiritani haruka", "reason": "角色名" },
    { "text": "school uniform", "reason": "具体服装" }
  ]
}
```

---

### 5. SSH LoRA 扫描

使用 `ssh2` Node.js 库通过 SFTP 协议扫描远程目录。

**连接配置**：
```typescript
interface SSHConfig {
  host: string;           // AutoDL SSH 地址
  port: number;           // 默认 22
  username: string;       // 通常 root
  password: string;       // 加密存储
}
```

**扫描逻辑**：
```typescript
// 扫描路径（可配置）
const SCAN_PATHS = [
  '{comfy_root}/models/loras',
  '{comfy_root}/models/lycoris'
];

// 返回文件列表
interface LoraFileEntry {
  filename: string;       // e.g. "Haruka2025-10.safetensors"
  path: string;           // 完整远程路径
  size: number;           // 文件大小（bytes）
}
```

**缓存策略**：
- 首次扫描后全量写入 `remote_lora_index` 表
- 后续手动触发刷新时做 diff 更新
- 记录 `last_synced_at` 时间戳

---

## 二、内部 IPC 接口规范

### 通用响应格式

```typescript
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
```

### 核心接口列表

| 频道                 | 方向 | 入参                              | 出参                            | 说明                 |
| -------------------- | ---- | --------------------------------- | ------------------------------- | -------------------- |
| `entry:import:url`   | R→M  | `{ url: string }`                 | `IPCResponse<Entry>`            | URL 导入             |
| `entry:import:paste` | R→M  | `{ text: string }`                | `IPCResponse<Entry[]>`          | 粘贴导入（支持多条） |
| `entry:import:file`  | R→M  | `{ filePath: string }`            | `IPCResponse<Entry[]>`          | 文件导入             |
| `entry:list`         | R→M  | `{ filters, page, pageSize }`     | `IPCResponse<Paginated<Entry>>` | 列表查询             |
| `entry:get`          | R→M  | `{ id: string }`                  | `IPCResponse<EntryDetail>`      | 详情查询             |
| `entry:search`       | R→M  | `{ query: string }`               | `IPCResponse<Entry[]>`          | 全文搜索             |
| `llm:analyze`        | R→M  | `{ entryId, configId, sanitize }` | `IPCResponse<AnalysisResult>`   | AI 分析              |
| `favorite:toggle`    | R→M  | `{ entryId: string }`             | `IPCResponse<boolean>`          | 切换收藏             |
| `tag:create`         | R→M  | `{ name, color }`                 | `IPCResponse<Tag>`              | 创建标签             |
| `tag:assign`         | R→M  | `{ entryId, tagIds[] }`           | `IPCResponse<void>`             | 分配标签             |
| `workflow:clean`     | R→M  | `{ workflowId, options }`         | `IPCResponse<Workflow>`         | 净化工作流           |
| `workflow:export`    | R→M  | `{ workflowId, type }`            | `IPCResponse<string>`           | 导出文件路径         |
| `slotmap:guess`      | R→M  | `{ workflowJson }`                | `IPCResponse<SlotMap>`          | 自动猜测插槽         |
| `comfy:submit`       | R→M  | `{ entryId, workflowId }`         | `IPCResponse<{ promptId }>`     | 提交测试             |
| `comfy:status`       | R→M  | `{ promptId }`                    | `IPCResponse<TaskStatus>`       | 查询状态             |
| `ssh:scanLoras`      | R→M  | `{ profileId }`                   | `IPCResponse<LoraFile[]>`       | SSH 扫描             |
| `civitai:search`     | R→M  | `{ query, type }`                 | `IPCResponse<CivitaiModel[]>`   | C 站搜索             |
