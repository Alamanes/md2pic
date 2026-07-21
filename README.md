# md2pic

将 Markdown 文件转换为所见即所得的 PNG 图片。

## 安装

```bash
brew tap Shiorangerin/apps
brew install md2pic
```

需要系统装有 Google Chrome 或 Chromium（用于渲染）。

## 使用

```bash
# 基础用法：输出与 .md 同目录的 .png
md2pic README.md

# 指定输出路径
md2pic README.md -o screenshot.png

# 自定义宽度（默认 800px）
md2pic README.md -w 1200
```

## 特性

- GitHub 风格 CSS 渲染
- 支持代码块、表格、引用、图片等常见 Markdown 语法
- 相对路径图片自动解析
- 全页长截图

## 依赖

- Node.js（由 Homebrew 自动安装）
- Google Chrome / Chromium（需自行安装）
