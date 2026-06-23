# Perler Beads Studio / 拼豆图纸工作室

[中文](#中文) | [English](#english)

---

## 中文

### 目录

- [项目简介](#项目简介)
- [适用人群](#适用人群)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [使用流程](#使用流程)
- [快捷键](#快捷键)
- [项目结构](#项目结构)
- [确定性图纸生成流程](#确定性图纸生成流程)
- [AI 设计原则](#ai-设计原则)
- [AI 供应商配置](#ai-供应商配置)
- [隐私与安全](#隐私与安全)
- [项目文件](#项目文件)
- [导出能力](#导出能力)
- [开发约定](#开发约定)
- [验证清单](#验证清单)
- [常见问题](#常见问题)
- [当前限制](#当前限制)
- [后续路线图](#后续路线图)
- [许可证](#许可证)

### 项目简介

Perler Beads Studio（拼豆图纸工作室）是一款桌面端拼豆图纸制作工具，用于把用户导入的图片转换为可编辑、可统计、可打印、可复现的拼豆图纸。

项目的核心原则是：**AI 只作为辅助工具，不作为最终图纸来源**。AI 可以帮助优化图片、简化主体、去除背景或生成参考图，但最终的拼豆网格必须由本地确定性算法生成，并绑定到真实厂商色卡，确保每一次导出、保存和打印都可追溯、可编辑、可计数。

这不是一个营销落地页项目，而是一个面向实际制作流程的桌面工作台：导入图片、生成图纸、人工修正、统计用珠、保存项目、导出和打印。

### 适用人群

- 拼豆、熨烫豆、像素画手工爱好者
- 需要把照片、插画、头像、像素画转换为实物拼豆图纸的用户
- 需要统计颜色和用珠数量的手工创作者
- 想用 AI 辅助简化图片，但仍希望最终图纸可编辑、可复现的用户
- 希望二次开发 Electron + Vue 桌面创作工具的开发者

### 功能特性

#### 图像转拼豆图纸

- 导入图片并转换为拼豆网格
- 普通图片模式与像素画模式
- 画板规格：32 × 32、48 × 48、64 × 64、96 × 96
- 透明像素保留为空格 / 无珠格，不会被匹配为黑色
- 半透明像素按白底合成后再匹配，减少透明边缘黑边
- 最大颜色数控制
- Floyd-Steinberg 抖色开关
- 基础孤立像素清理与边缘过渡清理
- Board 设置始终跟随当前图纸网格尺寸

#### 厂商色卡

当前内置真实厂商色卡：

- MARD 221（默认）
- MARD 291
- Perler
- Hama
- Artkal
- Artkal Mini

色卡数据包含厂商色号、颜色名称和 RGB / Hex 信息。图纸生成、当前用色、CSV 清单、PNG 导出和打印预览都会使用当前选中的厂商色卡。

#### 编辑器

- 画笔
- 填充
- 吸管
- 橡皮（清空格子，而不是涂成白色）
- 撤销 / 重做
- 当前颜色选择
- 当前用色统计
- 完整用珠清单
- 图纸模式 / 实物效果预览模式
- 行列坐标标号显示 / 隐藏
- Canvas 图纸预览、缩放、平移和全屏查看

#### 项目保存与打开

- 保存 `.pbd.json` 项目文件
- 打开 `.pbd.json` 项目文件
- 保存画板设置、输入模式、厂商色卡 ID、当前网格、来源名称和 AI 元数据
- 项目文件不保存 API Key
- Electron 桌面端使用原生文件保存 / 打开对话框
- 本地 Web 预览环境可使用下载 / 上传 JSON 的兜底行为

#### 导出与打印

- PNG 打印图纸导出
- CSV 用珠清单导出
- 打印预览
- 可通过系统打印对话框打印到纸张或另存为 PDF
- PNG 图纸包含坐标、网格线、每 5 格加粗线、格内厂商色号和底部用珠图例
- 默认不添加水印

#### AI 辅助

- OpenAI-compatible 供应商配置
- Base URL + API Key + 模型列表
- 从 `/models` 拉取模型列表
- AI 图片优化：导入图片后可调用配置的图片编辑模型生成参考图
- AI 参考图仍会进入本地确定性拼豆转换流程
- Electron 桌面端 AI 请求通过主进程 IPC 转发
- 本地 Web 预览在 `localhost` / `127.0.0.1` 下可进行开发测试

### 技术栈

- 桌面壳：Electron
- 前端框架：Vue 3
- 编程语言：TypeScript
- 样式：Tailwind CSS
- 图标：`@iconify/vue` + RemixIcon
- 构建工具：electron-vite
- 包管理器：npm
- 主要开发 Shell：Windows PowerShell
- 当前主要目标平台：Windows 桌面端

### 快速开始

#### 环境要求

- Node.js 18+（建议使用当前 LTS 或更新版本）
- npm
- Windows PowerShell

#### 安装依赖

```powershell
npm install
```

如果 Electron 二进制下载失败，可以临时设置镜像后重新安装：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
npm install
```

#### 启动开发环境

```powershell
npm run dev
```

#### 类型检查

```powershell
npm run typecheck
```

#### 构建

```powershell
npm run build
```

#### Windows 便携包

```powershell
npm run package:win
```

构建产物默认输出到 `dist/`。

### 使用流程

1. 启动应用。
2. 在左侧设置画板尺寸、厂商色卡、输入模式、最大颜色数、抖色和清理选项。
3. 导入图片。
4. 可选：配置 AI 供应商并执行 AI 图片优化，生成更适合拼豆转换的参考图。
5. 生成拼豆图纸。
6. 使用画笔、填充、吸管、橡皮、撤销和重做进行人工修正。
7. 查看当前用色和完整用珠清单。
8. 保存 `.pbd.json` 项目文件，或导出 PNG 图纸 / CSV 清单。
9. 需要纸质输出时，打开打印预览并通过系统打印为 PDF 或纸张。

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `B` / `P` | 画笔 |
| `E` | 橡皮 |
| `F` | 填充 |
| `I` | 吸管 |
| `Ctrl + Z` | 撤销 |
| `Ctrl + Shift + Z` / `Ctrl + Y` | 重做 |
| `Ctrl + S` | 保存项目 |
| `Ctrl + O` | 打开项目 |
| `Space + 拖拽` | 平移画布 |
| `Ctrl + 鼠标滚轮` | 缩放画布 |
| `+` / `-` / `0` | 缩放 / 复位 |
| `G` / `V` | 切换标号 / 预览模式 |
| `Esc` | 关闭面板 |

### 项目结构

```text
src/main/
  Electron 主进程。负责窗口创建、原生能力和特权 IPC。

src/preload/
  安全桥接层。通过 contextBridge 暴露窄接口到渲染进程。

src/shared/
  主进程、预加载脚本和渲染进程共享的 TypeScript 类型与工具。

src/renderer/
  Vue 渲染端入口和 HTML。

src/renderer/src/
  Vue 组件、组合式函数、数据、样式和浏览器端工具。

src/renderer/src/data/palettes/
  厂商拼豆色卡配置。

src/renderer/src/utils/pattern.ts
  拼豆图纸生成、用珠统计、PNG / CSV / 打印导出等核心工具。
```

重要文件：

- `src/main/index.ts`：Electron 窗口、主题 IPC、AI IPC、项目文件读写、AI 供应商档案存储
- `src/preload/index.ts`：`window.perler` 安全桥接
- `src/shared/ai.ts`：AI 供应商、模型列表、图片优化类型和 URL 工具
- `src/shared/project.ts`：项目文件格式类型
- `src/shared/theme.ts`：主题类型和桥接类型
- `src/renderer/src/App.vue`：主工作台状态和交互
- `src/renderer/src/composables/useTheme.ts`：主题持久化与系统主题处理
- `src/renderer/src/data/studio.ts`：工作流和预设数据
- `src/renderer/src/data/palettes/index.ts`：厂商色卡注册表
- `src/renderer/src/utils/pattern.ts`：确定性图纸生成与导出逻辑

### 确定性图纸生成流程

```text
图片文件
-> FileReader data URL
-> HTMLImageElement
-> Canvas 按画板尺寸采样
-> 像素读取
-> 透明像素转为空格 / 无珠格
-> 半透明像素按白底合成
-> 按厂商色卡做最近色匹配
-> 可选 Floyd-Steinberg 抖色
-> 可选像素清理
-> 可编辑拼豆网格
```

普通图片模式会根据每个拼豆点位覆盖的原图区域计算平均颜色，再映射到当前厂商色卡。

像素画模式会尽量保留原像素画的硬边缘和比例，裁掉透明或边缘纯色空白，居中适配画板，并关闭会破坏像素画结构的部分处理。

### AI 设计原则

AI 功能遵循以下边界：

- AI 是参考图生成或优化助手，不是最终拼豆图纸来源。
- 最终网格始终由本地确定性算法生成。
- AI 请求必须由用户显式触发。
- 不在项目文件、PNG、CSV 或导出文件中保存 API Key。
- Electron 桌面端通过主进程 IPC 发起 AI 请求，避免在渲染进程直接持有特权能力。
- 本地 Web 预览仅在 `localhost` / `127.0.0.1` 开发场景允许浏览器侧测试 AI 调用。
- 用户配置的供应商按 OpenAI-compatible 接口处理，模型列表默认请求 `/models`。
- 模型列表输出不能可靠判断能力，后续应允许用户手动标注模型能力。

### AI 供应商配置

供应商配置包含：

- 供应商名称
- Base URL
- API Key
- 模型列表
- 当前选择模型
- 模型能力标签

Electron 桌面端使用 `safeStorage` 加密保存 API Key；如果系统安全存储不可用，应用会显示错误。项目文件只保存供应商和模型的元数据，不保存 API Key。

### 隐私与安全

- 用户图片默认只在本机处理。
- 只有当用户显式点击 AI 优化相关操作时，图片才会发送给用户配置的 AI 供应商。
- 应用不内置第一方平台 API Key。
- 项目文件、PNG 图纸、CSV 清单和打印输出都不会保存 API Key。
- Electron 渲染进程不直接暴露 Node.js API。
- 预加载脚本只通过 `window.perler` 暴露任务级接口，不暴露原始 `ipcRenderer`。
- 外部链接应通过系统浏览器打开，避免在应用内加载不受信任页面。

### 项目文件

当前项目文件格式为 JSON，扩展名建议为：

```text
.pbd.json
```

项目文件包含：

- schema 版本
- 应用名称和保存时间
- 画板设置
- 输入模式
- 像素画校准信息
- 厂商色卡 ID
- 当前拼豆网格
- 来源图片名称
- AI 供应商 / 模型 / 优化模式 / Prompt 元数据

项目文件不包含：

- API Key
- 打包的源图
- 打包的 AI 参考图
- 打包的预览图

后续计划支持完整 `.pbd` 项目包：

```text
project.json
source-image.png
ai-reference.png
preview.png
```

### 导出能力

当前支持：

- PNG 打印图纸
  - 四周坐标标号
  - 细网格线
  - 每 5 格加粗网格线
  - 格内厂商色号
  - 底部用珠图例
  - 颜色、色号和数量统计
- CSV 用珠清单
  - 按厂商色号分组
  - 包含颜色名称、RGB / Hex、数量和占比
- 打印预览
  - 可使用系统打印对话框输出到打印机或 PDF

导出图纸不会默认添加水印。

### 开发约定

- 使用 TypeScript 编写应用代码。
- 主进程负责特权能力和需要密钥 / 绕过 CORS 的网络请求。
- 渲染进程不得直接访问 Node.js API。
- `nodeIntegration` 保持关闭，`contextIsolation` 保持开启。
- `window.perler` 只暴露窄接口，不暴露原始 `ipcRenderer`。
- 共享类型放在 `src/shared/`，避免依赖 Vue、Electron 运行时对象或浏览器专用 API。
- 不提交 API Key。
- 不将 API Key 写入项目文件或导出文件。
- 不提交 `node_modules`、`out`、`dist`、截图或自动化产物。
- README、文档和项目状态文件建议统一保存为 UTF-8。

### 验证清单

常规代码变更完成前建议运行：

```powershell
npm run typecheck
npm run build
```

UI 变更建议额外检查：

- 本地预览或 Electron 应用可以正常打开
- 明亮和深色主题均正常
- 1280px 宽度下没有明显拥挤、裁切或重叠
- 控制台没有明显错误

图纸转换变更建议检查：

- 示例图纸
- 导入普通图片
- 导入透明背景图片
- 像素画模式
- 不同画板尺寸
- 抖色开关
- PNG 导出
- CSV 导出

AI 供应商变更建议检查：

- 缺少 Base URL
- 缺少 API Key
- 无效 URL
- 空模型列表
- 有效 OpenAI-compatible `/models` 返回

### 常见问题

#### AI 会直接生成最终拼豆图纸吗？

不会。AI 只生成或优化参考图。最终拼豆网格一定经过本地确定性转换流程生成，用户可以继续编辑、统计、保存和导出。

#### 没有 AI API Key 可以使用吗？

可以。图片导入、图纸生成、编辑、保存、PNG 导出和 CSV 导出都可以在没有 AI 的情况下使用。

#### API Key 会保存到项目文件吗？

不会。项目文件只保存供应商、模型和提示词等元数据，不保存 API Key。

#### 为什么透明背景没有变成黑色？

透明像素会被识别为空格 / 无珠格，不会被匹配为黑色。半透明像素会先按白底合成再做色卡匹配，以减少边缘黑边。

#### 当前是否支持 PDF 导出？

暂不支持原生 PDF 文件导出。当前可以打开打印预览，再通过系统打印功能输出为 PDF。

#### README 在某些 PowerShell 输出里显示乱码怎么办？

文件本身使用 UTF-8 编码保存。如果旧终端编码页不是 UTF-8，直接 `Get-Content` 可能显示乱码；建议在支持 UTF-8 的编辑器中查看，或切换终端编码后再查看。

### 当前限制

- 目前项目保存仍是 JSON 文件，不是完整 `.pbd` 打包格式。
- 真正的 PDF 文件导出尚未实现，目前可通过打印预览使用系统打印为 PDF。
- AI 文本生图尚未实现。
- AI Prompt 模板和 AI 结果历史尚未完整实现。
- 大尺寸图纸虽然已有 Canvas 预览能力，但编辑交互仍有继续迁移到 Canvas / WebGL 的空间。
- 自动化测试体系尚未完整建立。
- 桌面发布、应用图标、安装包、多平台构建和自动更新仍需完善。

### 后续路线图

1. 建立图像转换算法测试夹具。
2. 完善 Canvas 编辑器交互，支持拖拽连续绘制、快捷键、框选和区域替换。
3. 实现真正的 PDF / 分页打印导出。
4. 实现完整 `.pbd` 项目包，包含源图、AI 参考图、预览图和项目 JSON。
5. 完善 AI 供应商管理，包括能力标签、Prompt 模板、结果历史和发布策略。
6. 配置桌面安装包、应用图标和 GitHub Actions 自动构建。

### 许可证

MIT

---

## English

### Table of Contents

- [Overview](#overview)
- [Who It Is For](#who-it-is-for)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Basic Workflow](#basic-workflow)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Repository Structure](#repository-structure)
- [Deterministic Pattern Pipeline](#deterministic-pattern-pipeline)
- [AI Design Principles](#ai-design-principles)
- [AI Provider Profiles](#ai-provider-profiles)
- [Privacy and Security](#privacy-and-security)
- [Project Files](#project-files)
- [Export](#export)
- [Development Guidelines](#development-guidelines)
- [Validation Checklist](#validation-checklist)
- [FAQ](#faq)
- [Current Limitations](#current-limitations)
- [Roadmap](#roadmap)
- [License](#license)

### Overview

Perler Beads Studio is a desktop workbench for converting user images into editable Perler bead pattern sheets.

The core product principle is: **AI is an assistant, not the final source of truth**. AI may optimize an image, simplify a subject, remove a background, or create a reference image, but the final bead grid is always generated by deterministic local logic and mapped to real manufacturer bead palettes. This keeps the result editable, countable, printable, reproducible, and tied to real bead colors.

This is a practical desktop workbench rather than a landing page: import an image, generate a pattern, refine it manually, count beads, save the project, export, and print.

### Who It Is For

- Perler bead, fuse bead, and pixel-art craft makers
- Users who want to convert photos, illustrations, avatars, or pixel art into physical bead patterns
- Creators who need color usage and bead-count statistics
- Users who want AI-assisted simplification while keeping the final pattern editable and reproducible
- Developers interested in an Electron + Vue desktop creative-tool codebase

### Features

#### Image-to-pattern conversion

- Import images and convert them into bead grids
- Standard image mode and pixel-art mode
- Board sizes: 32 × 32, 48 × 48, 64 × 64, 96 × 96
- Transparent pixels remain empty / no-bead cells instead of being matched to black
- Semi-transparent pixels are composited against white before matching to reduce dark fringes
- Maximum color count control
- Optional Floyd-Steinberg dithering
- Basic isolated-pixel and edge-transition cleanup
- Board settings stay in sync with the active grid dimensions

#### Manufacturer palettes

Built-in manufacturer palettes:

- MARD 221 (default)
- MARD 291
- Perler
- Hama
- Artkal
- Artkal Mini

Palette data includes manufacturer codes, color names, and RGB / Hex values. Pattern generation, current color usage, CSV inventory, PNG export, and print preview all use the currently selected manufacturer palette.

#### Editor

- Pencil
- Fill
- Eyedropper
- Eraser (clears cells instead of painting white)
- Undo / redo
- Current color selection
- Current color usage
- Full bead inventory
- Pattern view / physical bead preview mode
- Row and column coordinate labels
- Canvas preview with zoom, pan, and fullscreen viewing

#### Project save and open

- Save `.pbd.json` project files
- Open `.pbd.json` project files
- Store board settings, input mode, manufacturer palette ID, current grid, source name, and AI metadata
- Never store API keys in project files
- Use native save / open dialogs in the Electron desktop app
- Use JSON download / upload fallback behavior in local Web preview mode

#### Export and print

- Printable PNG pattern sheet export
- CSV bead inventory export
- Print preview
- Print to paper or PDF through the system print dialog
- PNG sheets include coordinates, grid lines, heavy 5-cell lines, manufacturer color codes, and a bottom bead legend
- No watermark is added by default

#### AI assistance

- OpenAI-compatible provider configuration
- Base URL + API key + model list
- Fetch model list from `/models`
- AI image optimization: after importing an image, call a configured image-editing model to generate a reference image
- The AI reference image still goes through the local deterministic bead conversion pipeline
- Electron desktop AI requests are routed through main-process IPC
- Local Web previews may test browser-side AI calls on `localhost` / `127.0.0.1`

### Tech Stack

- Desktop shell: Electron
- UI framework: Vue 3
- Language: TypeScript
- Styling: Tailwind CSS
- Icons: `@iconify/vue` with RemixIcon names
- Build tool: electron-vite
- Package manager: npm
- Primary local shell: Windows PowerShell
- Primary current target: Windows desktop

### Quick Start

#### Requirements

- Node.js 18+ recommended
- npm
- Windows PowerShell

#### Install dependencies

```powershell
npm install
```

If the Electron binary download fails, retry with a mirror:

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
npm install
```

#### Start development

```powershell
npm run dev
```

#### Typecheck

```powershell
npm run typecheck
```

#### Build

```powershell
npm run build
```

#### Build a Windows portable package

```powershell
npm run package:win
```

Build artifacts are written to `dist/` by default.

### Basic Workflow

1. Launch the app.
2. Choose board size, manufacturer palette, input mode, max color count, dithering, and cleanup options in the left panel.
3. Import an image.
4. Optionally configure an AI provider and run AI image optimization to create a bead-friendly reference image.
5. Generate the bead pattern.
6. Manually refine it with the pencil, fill, eyedropper, eraser, undo, and redo tools.
7. Review color usage and the full bead inventory.
8. Save the project as `.pbd.json`, or export a PNG pattern sheet / CSV inventory.
9. Use print preview and the system print dialog for paper output or PDF output.

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `B` / `P` | Pencil |
| `E` | Eraser |
| `F` | Fill |
| `I` | Eyedropper |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo |
| `Ctrl + S` | Save project |
| `Ctrl + O` | Open project |
| `Space + Drag` | Pan canvas |
| `Ctrl + Mouse Wheel` | Zoom canvas |
| `+` / `-` / `0` | Zoom / reset |
| `G` / `V` | Toggle labels / preview mode |
| `Esc` | Close panel |

### Repository Structure

```text
src/main/
  Electron main process. Owns window setup, native behavior, and privileged IPC.

src/preload/
  Secure bridge exposed to the renderer through contextBridge.

src/shared/
  TypeScript contracts and helpers shared by main, preload, and renderer.

src/renderer/
  Vue renderer entry and HTML.

src/renderer/src/
  Vue components, composables, data, styles, and browser-side utilities.

src/renderer/src/data/palettes/
  Manufacturer bead palette configuration files.

src/renderer/src/utils/pattern.ts
  Core pattern generation, inventory, PNG, CSV, and print export utilities.
```

Important files:

- `src/main/index.ts`: Electron window setup, theme IPC, AI IPC, project file handling, AI provider profile storage
- `src/preload/index.ts`: safe `window.perler` bridge
- `src/shared/ai.ts`: AI provider, model list, image optimization types, and URL helpers
- `src/shared/project.ts`: project file format types
- `src/shared/theme.ts`: theme and bridge types
- `src/renderer/src/App.vue`: main workbench state and interaction logic
- `src/renderer/src/composables/useTheme.ts`: theme persistence and system-theme handling
- `src/renderer/src/data/studio.ts`: workflow and preset data
- `src/renderer/src/data/palettes/index.ts`: palette registry
- `src/renderer/src/utils/pattern.ts`: deterministic pattern generation and export logic

### Deterministic Pattern Pipeline

```text
image file
-> FileReader data URL
-> HTMLImageElement
-> canvas sampling at board dimensions
-> pixel readback
-> transparent pixels become empty / no-bead cells
-> semi-transparent pixels are composited against white
-> nearest manufacturer palette color matching
-> optional Floyd-Steinberg dithering
-> optional cleanup
-> editable bead grid
```

Standard image mode computes an average color for the source area covered by each bead cell, then maps that color to the selected manufacturer palette.

Pixel-art mode tries to preserve hard pixel edges and original proportions. It trims transparent or solid-edge blank areas, centers the content on the board, and disables processing that would damage the pixel-art structure.

### AI Design Principles

AI integration follows these boundaries:

- AI is a reference-image assistant, not the final pattern generator.
- The final grid is always produced by deterministic local logic.
- AI requests must be explicitly triggered by the user.
- API keys are never stored in project files, PNG exports, CSV exports, or generated pattern sheets.
- In the Electron app, AI requests are routed through main-process IPC.
- Browser-side AI calls are only allowed for local development previews on `localhost` / `127.0.0.1`.
- User-configured providers are treated as OpenAI-compatible providers, and model lists default to `/models`.
- Model list responses are not reliable for capability detection; users should be able to manually tag model capabilities later.

### AI Provider Profiles

A provider profile includes:

- Provider name
- Base URL
- API key
- Model list
- Selected model
- Model capability tags

In the Electron desktop app, API keys are encrypted with `safeStorage`. If secure system storage is unavailable, the app reports an error. Project files only store provider and model metadata, never API keys.

### Privacy and Security

- User images are processed locally by default.
- Images are only sent to a user-configured AI provider after the user explicitly triggers AI optimization.
- The app does not ship with a first-party platform API key.
- Project files, PNG sheets, CSV inventories, and print outputs do not store API keys.
- The Electron renderer does not directly expose Node.js APIs.
- The preload script only exposes task-specific APIs through `window.perler`; it does not expose raw `ipcRenderer`.
- External links should be opened in the system browser instead of loading untrusted pages inside the app.

### Project Files

The current project format is JSON and should use the extension:

```text
.pbd.json
```

A project file contains:

- Schema version
- App name and save timestamp
- Board settings
- Input mode
- Pixel-art calibration data
- Manufacturer palette ID
- Current bead grid
- Source image name
- AI provider / model / optimization mode / prompt metadata

A project file does not contain:

- API keys
- Packaged source image
- Packaged AI reference image
- Packaged preview image

A full packaged `.pbd` format is planned for a future milestone:

```text
project.json
source-image.png
ai-reference.png
preview.png
```

### Export

Currently supported exports:

- Printable PNG pattern sheet
  - Coordinate rulers
  - Fine grid lines
  - Heavy grid lines every 5 cells
  - Manufacturer color codes inside filled cells
  - Bottom bead legend
  - Color, code, and quantity statistics
- CSV bead inventory
  - Grouped by manufacturer color code
  - Includes color name, RGB / Hex, count, and percentage
- Print preview
  - Can use the system print dialog to print to paper or PDF

Pattern exports do not include watermarks by default.

### Development Guidelines

- Use TypeScript for application code.
- Keep privileged behavior and key-bearing network calls in the main process.
- Do not expose Node.js APIs directly to the renderer.
- Keep `nodeIntegration` disabled and `contextIsolation` enabled.
- Expose only narrow APIs through `window.perler`; never expose raw `ipcRenderer`.
- Keep shared types in `src/shared/` and dependency-light.
- Do not commit API keys.
- Do not write API keys to project files or exports.
- Do not commit `node_modules`, `out`, `dist`, screenshots, or automation artifacts.
- Save README, docs, and project status files as UTF-8.

### Validation Checklist

For normal code changes, run:

```powershell
npm run typecheck
npm run build
```

For UI changes, also check:

- The local preview or Electron app opens successfully
- Light and dark themes both work
- No obvious clipping or overlap at 1280px width
- No obvious console errors

For pattern conversion changes, check:

- Sample pattern generation
- Normal imported image
- Transparent-background image
- Pixel-art mode
- Different board sizes
- Dithering on / off
- PNG export
- CSV export

For AI provider changes, check:

- Missing Base URL
- Missing API key
- Invalid URL
- Empty model list response
- Valid OpenAI-compatible `/models` response

### FAQ

#### Does AI directly generate the final bead pattern?

No. AI only generates or optimizes a reference image. The final bead grid always goes through the local deterministic conversion pipeline, and the user can continue editing, counting, saving, and exporting it.

#### Can I use the app without an AI API key?

Yes. Image import, pattern generation, editing, project save/open, PNG export, and CSV export work without AI.

#### Is the API key stored in project files?

No. Project files only store metadata such as provider, model, and prompt information. They do not store API keys.

#### Why does a transparent background not become black?

Transparent pixels are treated as empty / no-bead cells, not matched to black. Semi-transparent pixels are composited against white before palette matching to reduce dark edge artifacts.

#### Does the app support PDF export?

Native PDF export is not implemented yet. For now, open print preview and use the system print dialog to print to PDF.

#### Why does README look garbled in some PowerShell output?

The file is saved as UTF-8. Older terminal code pages may display UTF-8 Chinese text incorrectly when using `Get-Content`. Use a UTF-8 capable editor or switch the terminal encoding before viewing.

### Current Limitations

- Project save is still JSON-based, not a complete packaged `.pbd` format.
- Native PDF export is not implemented yet; print preview can be used with system print-to-PDF.
- Text-to-image AI generation is not implemented yet.
- AI prompt templates and AI result history are not fully implemented yet.
- Large patterns already have Canvas preview support, but editing interactions can still be further migrated to Canvas / WebGL.
- Automated tests are not fully established yet.
- Desktop release polish, app icons, installers, multi-platform builds, and auto-update are still pending.

### Roadmap

1. Add image-conversion algorithm fixtures and tests.
2. Improve Canvas editor interactions: drag painting, shortcuts, selection, and region replacement.
3. Implement native PDF and tiled print export.
4. Implement a full `.pbd` project package containing source image, AI reference image, preview image, and project JSON.
5. Improve AI provider management with capability tags, prompt templates, result history, and production release strategy.
6. Configure desktop installers, app icons, and GitHub Actions automated builds.

### License

MIT
