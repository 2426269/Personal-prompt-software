# PromptForge · 代码规范

> **版本**：v1.0 | **日期**：2026-03-05

---

## 一、命名规范

### 1.1 文件命名

| 类别            | 规则                          | 示例                                |
| --------------- | ----------------------------- | ----------------------------------- |
| **页面组件**    | PascalCase 目录 + `index.tsx` | `pages/DetailPage/index.tsx`        |
| **通用组件**    | PascalCase                    | `SourceCard.tsx`, `TagCloud.tsx`    |
| **Hook**        | camelCase，`use` 前缀         | `useEntryStore.ts`                  |
| **Service**     | kebab-case                    | `aitag-client.ts`, `ssh-manager.ts` |
| **Repository**  | kebab-case，`.repo.ts` 后缀   | `entries.repo.ts`                   |
| **IPC Handler** | kebab-case，`.ipc.ts` 后缀    | `entries.ipc.ts`                    |
| **类型定义**    | kebab-case，`.types.ts` 后缀  | `entry.types.ts`                    |
| **样式文件**    | 与组件同名，`.module.css`     | `SourceCard.module.css`             |
| **测试文件**    | 与源文件同名，`.test.ts`      | `sd-parser.test.ts`                 |

### 1.2 代码命名

| 类别           | 规则             | 示例                           |
| -------------- | ---------------- | ------------------------------ |
| **变量/函数**  | camelCase        | `fetchWork()`, `parsePrompt()` |
| **类**         | PascalCase       | `ComfyUIClient`, `SSHManager`  |
| **常量**       | UPPER_SNAKE_CASE | `MAX_CACHE_SIZE`, `DB_PATH`    |
| **类型/接口**  | PascalCase       | `EntryDetail`, `SlotMap`       |
| **枚举值**     | UPPER_SNAKE_CASE | `SourceType.COMFYUI`           |
| **IPC 频道**   | 冒号分隔小写     | `entry:import:url`             |
| **数据库字段** | snake_case       | `pixiv_id`, `created_at`       |

### 1.3 CSS 变量

```css
/* 全局 CSS 变量命名 */
--color-bg-primary: #1a1a2e;
--color-text-primary: #e0e0e0;
--color-accent: #4a9eff;
--spacing-xs: 4px;
--spacing-sm: 8px;
--radius-sm: 4px;
--font-size-body: 14px;
```

---

## 二、TypeScript 编码标准

### 2.1 通用规则
- **严格模式**：`tsconfig.json` 开启 `strict: true`
- **不使用 `any`**：禁止 `any`，用 `unknown` + 类型窄化代替
- **导出约束**：每个模块有明确的公共 API，非必要不导出内部实现
- **异步函数**：统一使用 `async/await`，不使用 `.then()` 链

### 2.2 函数规范

```typescript
// ✅ Good：参数 > 3 个时用对象解构
async function importFromUrl({ url, downloadImages = true }: ImportOptions): Promise<Entry> { ... }

// ❌ Bad：过多位置参数
async function importFromUrl(url: string, download: boolean, validate: boolean): Promise<Entry> { ... }
```

### 2.3 错误处理

```typescript
// 业务错误统一使用自定义错误类
export class AppError extends Error {
  constructor(
    public code: string,          // 'COMFY_TIMEOUT' | 'SSH_AUTH_FAILED' | ...
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// IPC Handler 统一包装
export function wrapIPC<T>(handler: () => Promise<T>): Promise<IPCResponse<T>> {
  try {
    const data = await handler();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: {
        code: err instanceof AppError ? err.code : 'UNKNOWN',
        message: err.message,
      },
    };
  }
}
```

### 2.4 日志规范

```typescript
import log from 'electron-log';

// 按模块标记
log.info('[Scraper] Fetching work:', pixivId);
log.error('[ComfyUI] Submit failed:', error.message);
log.warn('[SSH] Connection timeout, retrying...');
```

---

## 三、文件组织规则

### 3.1 组件结构

每个页面级组件使用目录组织：

```
DetailPage/
├── index.tsx          # 主组件
├── DetailPage.module.css
├── components/        # 页面内子组件
│   ├── SourceCard.tsx
│   ├── RawPayload.tsx
│   └── TemplateEditor.tsx
└── hooks/             # 页面专用 hooks
    └── useDetail.ts
```

### 3.2 Service 内部结构

```typescript
// 每个 Service 导出一个类或命名导出的函数集合
// 职责单一，不直接操作 DB（通过 Repository）
export class AitagClient {
  async fetchWork(pixivId: string): Promise<AitagWork> { ... }
  async downloadImage(url: string, savePath: string): Promise<void> { ... }
}
```

### 3.3 导入顺序

```typescript
// 1. Node.js 内置模块
import path from 'path';
// 2. 第三方依赖
import Database from 'better-sqlite3';
// 3. 内部共享模块
import { IPC } from '@shared/ipc-channels';
// 4. 同层模块
import { EntriesRepository } from '../db/repositories/entries.repo';
// 5. 类型导入（type-only）
import type { Entry } from '@shared/types/entry.types';
```

---

## 四、Git 工作流

### 4.1 分支命名

| 分支类型 | 格式                 | 示例                           |
| -------- | -------------------- | ------------------------------ |
| 主分支   | `main`               | -                              |
| 功能分支 | `feat/{模块}-{描述}` | `feat/import-url-scraper`      |
| 修复分支 | `fix/{描述}`         | `fix/sd-parser-lora-weight`    |
| 重构分支 | `refactor/{描述}`    | `refactor/ipc-handler-pattern` |

### 4.2 Commit Message 格式

```
<type>(<scope>): <subject>

type: feat | fix | refactor | style | docs | test | chore
scope: import | parser | llm | comfyui | ssh | ui | db | config
```

**示例**：
```
feat(import): add aitag.win URL import with image caching
fix(parser): handle multi-JSON concatenation in ComfyUI paste
refactor(ipc): extract common error wrapper
docs(api): add Civitai API rate limiting notes
```

---

## 五、关键依赖参考

| 类别         | 包名                      | 用途                      |
| ------------ | ------------------------- | ------------------------- |
| **数据库**   | `better-sqlite3`          | SQLite 绑定               |
| **SSH**      | `ssh2`                    | SSH/SFTP 连接             |
| **HTTP**     | `undici` 或 `got`         | HTTP 请求（Main Process） |
| **路由**     | `react-router-dom`        | 页面路由（如用 React）    |
| **状态**     | `zustand`                 | 轻量级状态管理            |
| **UI 组件**  | 自建 或 `@radix-ui/*`     | 无样式基础组件            |
| **代码高亮** | `prism-react-renderer`    | JSON 代码展示             |
| **加密**     | `electron.safeStorage`    | API Key / 密码加密        |
| **日志**     | `electron-log`            | 多进程日志                |
| **打包**     | `electron-builder`        | Windows 安装包            |
| **构建**     | `electron-vite` 或 `vite` | 开发服务器 + 构建         |

---

## 六、开发环境配置

### 6.1 环境要求

- **Node.js**：≥ 18.x
- **包管理器**：pnpm（推荐）或 npm
- **编辑器**：VS Code + 推荐插件：ESLint、Prettier、TypeScript

### 6.2 启动命令

```bash
# 安装依赖
pnpm install

# 开发模式（同时启动 Main + Renderer）
pnpm run dev

# 构建生产版本
pnpm run build

# 打包 Windows 安装包
pnpm run package
```

### 6.3 环境变量

开发环境配置通过 `.env.development`：
```env
# 开发用默认值（实际值通过应用设置页面配置）
VITE_DEV_MODE=true
```

> 📌 所有敏感配置（API Key、SSH 密码等）均通过**应用内设置页面**配置并加密存储，不使用环境变量。
