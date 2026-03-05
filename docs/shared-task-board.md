# PromptForge · 双 AI 协作任务板

> **Antigravity**（交互式，擅长 UI、设计、浏览器验证、用户交流）  
> **Codex**（自主式，擅长批量代码生成、后端逻辑、独立模块）  
> **更新规则**：完成任务后在对应任务下填写 `✅ 完成情况`，未完成写 `🔄 进行中` 或 `❌ 阻塞`

---

## 📋 第一批任务 · Phase 0：项目初始化

### 🤖 Codex 任务

#### C-01：初始化 Electron + Vite + React 脚手架 `[0.1]`
- **要求**：使用 Electron + Vite + React + TypeScript 搭建项目
- **验收**：`npm run dev` 可启动空白 Electron 窗口
- **参考**：`docs/technical_architecture.md` 的目录结构
- **状态**：⬜ 待开始
- **完成情况**：

---

#### C-02：配置 TypeScript / ESLint / Prettier `[0.2]`
- **要求**：严格 TS 配置，ESLint 规则，Prettier 格式化，配置 husky pre-commit（可选）
- **验收**：`npm run lint` 通过，类型检查通过
- **参考**：`docs/code_conventions.md`
- **状态**：⬜ 待开始
- **完成情况**：

---

#### C-03：搭建目录结构 `[0.3]`
- **要求**：创建完整的 main/renderer/shared/preload 目录结构
- **验收**：目录与 `docs/technical_architecture.md` 第二节一致
- **参考**：技术架构文档目录树
- **状态**：⬜ 待开始
- **完成情况**：

```
src/
  main/           # Electron 主进程
    services/     # 后端服务层
    ipc/          # IPC 处理器
  renderer/       # 渲染进程（React）
    pages/        # 页面组件
    components/   # 通用组件
    stores/       # Zustand 状态
    hooks/        # 自定义 hooks
    styles/       # 全局样式
  shared/         # 主/渲染共享
    types/        # TypeScript 类型
    constants/    # 常量
  preload/        # contextBridge
```

---

#### C-04：SQLite 初始化 + 全部迁移脚本 `[0.4]`
- **要求**：使用 better-sqlite3，创建所有表（entries, images, favorites, tags, lora_index, settings, workflows 等）
- **验收**：所有表创建成功，外键生效，可插入测试数据
- **参考**：`docs/technical_architecture.md` 第四节数据库设计 + `docs/api_documentation.md` 数据模型
- **状态**：⬜ 待开始
- **完成情况**：

---

#### C-05：IPC 通信基础框架 + contextBridge 模板 `[0.5]`
- **要求**：封装 typesafe IPC 调用模板，preload 暴露 API，主进程注册处理器
- **验收**：渲染进程调用 `window.api.ping()` 返回 `pong`
- **参考**：`docs/technical_architecture.md` 第三节 IPC 设计
- **状态**：⬜ 待开始
- **完成情况**：

---

### 🧠 Antigravity 任务

#### A-01：全局样式体系 + 暗色主题 + 侧边栏布局 `[0.6]`
- **要求**：实现 GitHub Dark 主题色系、CSS 变量、Inter + IBM Plex Mono 字体、侧边栏导航组件
- **验收**：基础 Layout 渲染正常，侧边栏可切换页面
- **参考**：UI 原型截图 `docs/ui-prototypes/`，色值见 walkthrough
- **依赖**：等待 C-01 完成（脚手架搭好后才能写 UI）
- **状态**：⬜ 待开始
- **完成情况**：

---

## 📋 第二批预览 · Phase 1A：数据导入引擎（待第一批完成后分配）

| 编号 | 任务             | 建议分配    | 原因                |
| ---- | ---------------- | ----------- | ------------------- |
| 1.1  | 类型自动检测器   | Codex       | 纯逻辑，无 UI       |
| 1.2  | NAI 解析器       | Codex       | 纯解析逻辑          |
| 1.3  | SD 解析器        | Codex       | 纯解析逻辑          |
| 1.4  | ComfyUI 解析器   | Codex       | 复杂 JSON 解析      |
| 1.5  | aitag.win 爬取器 | Codex       | 网络请求 + 数据处理 |
| 1.6  | 导入弹窗 UI      | Antigravity | UI 交互组件         |
| 1.7  | SourceCard 组件  | Antigravity | UI 组件             |
| 1.8  | RawPayload 组件  | Antigravity | UI 组件             |
| 1.9  | 浏览页 Gallery   | Antigravity | 核心 UI 页面        |
| 1.10 | 详情页骨架       | Antigravity | 三栏 UI 布局        |

---

## 💬 交流专区

> 两个 AI 在此记录需要对方知道的信息、接口约定、阻塞问题等。

### Antigravity → Codex

1. **UI 色值参考**：页面用 `#0d1117`，面板用 `#161b22`，输入框用 `#21262d`，边框 `#30363d`，主色 `#1f6feb`。请在搭建目录时预留 `src/renderer/styles/variables.css`。
2. **IPC 接口命名约定**：建议统一用 `channel:action` 格式，如 `db:query`、`entry:import`、`comfyui:connect`。
3. **数据库字段**：entries 表请预留 `custom_name TEXT`（用户自定义名称）和 `is_favorited INTEGER DEFAULT 0`（收藏标记），因为 UI 原型中提示词集页面需要自命名和收藏功能。

### Codex → Antigravity

_（Codex 完成任务后在这里写需要 Antigravity 知道的事项）_

### 阻塞 & 依赖

| 阻塞方 | 等待      | 说明                           |
| ------ | --------- | ------------------------------ |
| A-01   | C-01 完成 | UI 代码需要在 React 脚手架上写 |

---

## 📊 进度总览

| 批次    | Codex              | Antigravity       | 状态     |
| ------- | ------------------ | ----------------- | -------- |
| Phase 0 | C-01 ~ C-05 (5 项) | A-01 (1 项)       | 🔄 进行中 |
| Phase 1 | 1.1 ~ 1.5 (5 项)   | 1.6 ~ 1.10 (5 项) | ⬜ 待分配 |
