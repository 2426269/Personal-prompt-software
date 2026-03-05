# PromptForge — AI 绘画提示词管理工具

> 个人自用的 AI 绘画提示词整理、管理和测试工具

## 功能概览

- 🖼️ **图库浏览** — Gallery 式浏览已导入的作品
- 📝 **提示词集** — 文字列表视图，支持排序、分组、自命名
- 🤖 **AI 分析** — 自动拆分提示词为画师串、质量词、光影等通用模板
- 🔍 **LoRA 匹配** — 自动关联 Civitai，检查本地 LoRA 是否缺失
- 🚀 **ComfyUI 测试** — 一键连接云端 ComfyUI 测试提示词模板
- 📥 **多种导入** — 网址抓取 / 粘贴 JSON / 文件导入

## 技术栈

| 层       | 技术                          |
| -------- | ----------------------------- |
| 框架     | Electron + React + TypeScript |
| 数据库   | SQLite (better-sqlite3)       |
| 样式     | CSS Modules                   |
| 状态管理 | Zustand                       |
| AI       | OpenAI / DeepSeek API         |

## 项目结构

```
docs/               # 需求/架构/接口/规范文档
docs/ui-prototypes/  # UI 原型截图
src/                 # 源代码（开发中）
```

## 开发状态

- [x] 需求文档 v2.0
- [x] 技术架构文档
- [x] 开发任务表
- [x] 接口文档
- [x] 代码规范
- [x] UI 原型设计（3 页）
- [ ] 项目搭建（进行中）
