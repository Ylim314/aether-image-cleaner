# Gemini Watermark Remover (Web Pro) - PRD Build

一个基于纯前端技术 (HTML5 + OpenCV.js) 的智能图片去水印工具，专为消除 Google Gemini 生成图片的底部水印而设计。

🚀 **在线演示**: [https://gemini.112583.xyz/](https://gemini.112583.xyz/)

## ✨ 特性

* **🛡️ 隐私优先**: 所有处理均在浏览器本地进行 (Local Processing)，图片**永远不会**上传到服务器。
* **🧠 智能修复**: 集成 OpenCV (WebAssembly) 引擎，使用 Telea 算法智能填充背景纹理，而非简单的像素拉伸。
* **⚡ 极致性能**: 无需安装 Python 环境，无需 GPU，打开网页即可使用。
* **✂️ 多模式支持**:
    * **裁剪模式**: 一键切除底部版权条。
    * **涂抹模式**: 框选区域进行智能内容填充。
    * **画质增强**: 内置 USM 锐化滤镜，提升图片清晰度。

## 🛠️ 技术栈

* **核心**: OpenCV.js (WebAssembly)
* **界面**: HTML5 / CSS3 (Apple-style UI)
* **逻辑**: Vanilla JavaScript (无第三方重型框架)

## 📖 如何部署

本项目为纯静态网站，你可以轻松部署在任何静态托管服务上（如 GitHub Pages, Vercel, Cloudflare Pages, 或任何 Nginx/Apache 服务器）。

1. 克隆本项目。
2. 将 `opencv.js` 放入 `js/` 目录。
3. 启动 Web 服务器即可。

## 📄 License

本项目遵循 MIT License，详见 [LICENSE](./LICENSE)。

## 🔗 来源与归属

本项目基于以下开源仓库进行二次开发:

- 原始仓库: https://github.com/hupan0210/gemini-cleaner-web
- 原作者: `hupan0210`
- 开源协议: MIT

本仓库保留原项目技术路线，并在其基础上新增工程化能力（见下文变更列表）。

## 🧩 本分支新增能力

以下为本分支（`gemini-cleaner-web-prd`）相对上游仓库的主要功能改动:

1. 文件校验与大图保护（大小、分辨率、像素上限）
2. 处理中状态提示与失败恢复提示
3. 撤销 / 重做（含历史内存策略）
4. 前后对比（切换对比 + 按住查看原图）
5. 移动端触控选区（Pointer Events）
6. OpenCV 加载失败自动重试与手动重试
7. 导出格式选择（PNG / JPG / WebP）与质量控制
8. 快捷键支持（撤销、重做、导出、工具切换）
