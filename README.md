# Perler Beads Studio

桌面端图片转拼豆图纸工具，基于 Electron、Vue 3、TypeScript 和 Tailwind CSS。

## 当前能力

- 图片导入后转换为拼豆网格
- 画板规格、厂商色卡、最大颜色数和抖色开关
- 画笔、填充、吸管、橡皮编辑工具
- 撤销、重做和 PNG 图纸导出
- Base URL + API Key 的 OpenAI-compatible 模型列表拉取入口
- 昼夜主题切换，支持跟随系统主题

## 开发命令

```powershell
npm install
npm run dev
```

## 构建验证

```powershell
npm run build
```

如果 Electron 二进制下载失败，可以临时设置镜像后重新安装依赖：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
npm install
```
