---
description: PromptForge 项目开发规则
---

# PromptForge 项目开发规则

## 1. Git 提交规范

### 必须遵守：每完成一项功能必须提交 commit
- 完成任何一个可独立运行/验证的功能后，**立即** `git add` + `git commit` + `git push`
- 不要积攒多个功能在一个 commit 里
- 如果一个功能很大，可以拆分成多个小 commit

### Commit Message 格式（Conventional Commits）
```
<type>(<scope>): <简短描述>

[可选的详细说明]
```

**Type 类型**：
| type       | 用途                           |
| ---------- | ------------------------------ |
| `feat`     | 新功能                         |
| `fix`      | Bug 修复                       |
| `docs`     | 文档变更                       |
| `style`    | 代码格式（不影响逻辑）         |
| `refactor` | 重构（不增加功能也不修复 bug） |
| `test`     | 测试相关                       |
| `chore`    | 构建/工具/依赖变更             |
| `ui`       | UI/样式变更                    |

**Scope 范围**：
`core` | `ui` | `scraper` | `llm` | `comfyui` | `db` | `ssh` | `civitai` | `config`

**示例**：
```
feat(scraper): 实现 aitag.win 单页抓取功能
feat(ui): 完成图库浏览页 Gallery 组件
fix(db): 修复 LoRA 关联查询 N+1 问题
docs(core): 更新 API 接口文档
chore(config): 添加 ESLint + Prettier 配置
```

## 2. 项目远程仓库
- **GitHub**: `https://github.com/2426269/Personal-prompt-software.git`
- **主分支**：`main`

## 3. 技术栈
- **框架**：Electron + React + TypeScript
- **数据库**：SQLite (better-sqlite3)
- **样式**：CSS Modules / Tailwind
- **状态**：Zustand
- **字体**：Inter (UI) + IBM Plex Mono (代码)
- **配色**：GitHub Dark 主题色系

## 4. 开发流程
1. 开发前先确认需求对应的任务编号（参考 dev_task_breakdown.md）
2. 每个功能在独立分支开发（可选，个人项目可直接 main）
3. 完成后必须 commit 并 push
4. 代码风格遵循 code_conventions.md

## 5. 文件组织
- 文档放 `docs/` 目录
- UI 原型放 `docs/ui-prototypes/`
- 源代码放 `src/`
- 数据文件（comfyui.txt 等）不提交到仓库
