# ASS 字幕播放器（Python 本地服务版）

当前版本：v1.2.0 — Release: https://github.com/tzlovecjj-sudo/ass-player/releases/tag/v1.2.0

## 🌐 在线演示地址

[https://ass-player.zeabur.app](https://ass-player.zeabur.app)


## 🚀 Zeabur 一键云部署

本项目已适配 Zeabur 云平台，支持自动化部署（CI/CD），详见 [Zeabur部署教程.md](Zeabur部署教程.md)。

### 自动化脚本说明

- `.zeabur/scripts/prestart.sh`：每次部署前自动运行单元测试。
- `.zeabur/scripts/build.sh`：如有前端构建需求可自定义（默认注释）。

### 快速开始

1. 注册 Zeabur 并导入本仓库（支持私有仓库）。
2. 启动命令建议：`python start.py` 或 `python app.py`。
3. 端口监听：`os.environ['PORT']`，监听 `0.0.0.0`。
4. 详细图文教程见 [Zeabur部署教程.md](Zeabur部署教程.md)。

---

这是一个本地运行的 ASS 字幕播放器 + 自动解析小工具，后端基于 Flask，支持从 B 站等页面解析视频直链并将 ASS 字幕与前端播放器配合使用。

## 版本
- 当前版本：V1.2.0

## 更新日志
- V1.2.0
  - 正式发布 v1.2.0：修复多个用户反馈的 Bug 并稳定主流程。
  - 修复：修复浏览器原生全屏下页面顶部留黑条的问题（`static/css/fullscreen.css`）。
  - 改进：增强 ASS 渲染器对多种样式的支持（描边、阴影、背景色、ScaleX/ScaleY、字间距、旋转、下划线、删除线等），并补充中文注释，提升渲染准确性与可维护性。
  - 测试：新增 Playwright + pytest 的前端自动化测试并在 CI 中配置浏览器安装流程；同时提供按需本地验收脚本以辅助人工确认。
  - 文档/流程：完善 AI 指南与协作流程，明确“本地优先”的工作流与中文提交/备注约定。

- V1.1.4
  - 支持 Zeabur 云平台一键部署，自动识别 PORT 环境变量，兼容本地与云端。
  - 详见 Zeabur部署教程.md。
- V1.1.3
  - 修复全屏时工具栏在 3 秒无操作后自动隐藏、鼠标移动后重新显示的逻辑失效问题。
  - 增强全屏交互：在网页全屏与浏览器全屏中添加 document 级鼠标/触摸监听，任意位置交互都能唤醒控制栏。
  - 优化全屏样式：隐藏时不拦截指针事件，仅在可见时响应，避免事件被遮挡。
  - 改进启动脚本 `start.bat`：优先使用 Python 3.12 路径；若缺少 Flask 自动安装 `requirements.txt` 依赖。

## 主要功能
- 本地启动一个 Web 服务以托管播放器页面（静态前端 + Flask 后端）。
- 支持自动解析 B 站视频页面以获取高质量 720P 直链（多策略解析）。
- 前后端分离，解析逻辑已抽成模块（ass_player/bilibili.py）。

## 系统要求
- Python 3.9+ 推荐（请使用虚拟环境）
- 常见 Linux / macOS / Windows 环境均可运行

## 安装（推荐步骤）
1. 克隆或下载本仓库：
   git clone https://github.com/tzlovecjj-sudo/ass-player.git
2. 进入仓库目录并创建虚拟环境：
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
3. 安装依赖：
   pip install -r requirements.txt
   （若后续引入了额外包，请同步更新 requirements.txt）
4. 检查前端文件：
   - templates/index.html
   - templates/instructions.html
   - static/js/ass-player.js
   - static/css/main.css

## 运行
有两种启动脚本可选：

- 交互式（保留自动打开浏览器等体验）：
  python start.py

- 生产 / 容器友好（从环境变量控制 host/port）：
  python run.py
  或
  ASS_PLAYER_HOST=127.0.0.1 ASS_PLAYER_PORT=8080 python run.py

默认监听地址：127.0.0.1:8080（出于安全考虑默认不对公网暴露，必要时可通过 ASS_PLAYER_HOST 环境变量配置）。

团队约定（开发模式优先）：

- 在日常开发以及与 AI（例如 Copilot）交互、进行手动调试时，始终使用开发模式启动服务（`python start.py`）。这样可以自动打开浏览器、静态文件即时生效，并且便于实时调试前端渲染逻辑。
- 仅在需要做生产部署、容器化或需要持久化 SQLite 注入时才使用 `python run.py`。
- 开发模式下仍然建议在项目虚拟环境中运行（参见“关于虚拟环境”一节）。

访问界面：
- 主界面: http://127.0.0.1:8080/
- 自动解析 API: http://127.0.0.1:8080/api/auto-parse?url=<B站视频页地址>

## 安全建议（必须阅读）
- 默认绑定：默认绑定到本地回环地址 (127.0.0.1)。**千万不要**在没有额外认证或防火墙保护的情况下将服务绑定到 0.0.0.0 并放到公网。
- 依赖安装：不要在不受信任环境中自动执行脚本以安装依赖；建议手动在虚拟环境中安装并检查 requirements.txt。
- SSRF 风险：该服务会从后端访问用户提交的 URL（用于解析视频直链），为降低 SSRF 风险：
  - 服务层已做域名白名单（仅接受 bilibili.com 为主的请求）以及在解析模块中做 DNS -> IP 判定以拒绝私有/回环地址。
  - 如果你计划对外暴露服务，请在网络层（防火墙、反向代理）或应用层（认证、授权、流量配额）做额外限制。
- 速率限制：示例实现中包含简单内存速率限制，仅适用于单实例开发场景。线上生产环境请使用成熟的速率限制后端（如 Redis + Flask-Limiter）并设置合理配额。
- 日志与隐私：解析时会记录请求 URL 与解析结果，避免在对外环境中记录敏感信息或将日志公开。

## 依赖管理与部署建议
- 推荐固定依赖版本（requirements.txt）并在 CI 中使用 `pip install --isolated` 或容器镜像构建来保证可重复构建。
- 生产部署请使用 WSGI/ASGI 容器（如 gunicorn/uvicorn），并在反向代理（nginx）后方运行。
- 如果启用对外访问，强烈建议：
  - 在前端/后端增加认证；
  - 使用 HTTPS；
  - 将解析任务异步化并加入队列与限流。

## 开发与测试
- 解析模块位于 `ass_player/bilibili.py`，建议为此模块增加单元/集成测试（使用 requests-mock 或 responses 模拟 B 站 API）。
- 代码风格：建议在 CI 中加入 lint（例如 ruff/flake8）和单元测试执行（pytest）。

## 常见问题
- Q: 启动时报错提示依赖缺失怎么办？  
  A: 请在虚拟环境中运行 `pip install -r requirements.txt`，如仍出现错误请贴出报错信息以便诊断。

- Q: 我需要把服务放到外网吗？
  A: 如果确实需要，请先实现认证（token/登录）、启用限流、并在网络层（防火墙/反向代理）限制来源 IP。

## 联系
- 项目仓库: https://github.com/tzlovecjj-sudo/ass-player
- 作者: tzlovecjj-sudo

## 关于 AI 协助
本项目在开发过程中使用了 AI 辅助工具（例如代码补全与自动化脚本生成），部分文档与自动化脚本由 AI 协助编写。所有对远端仓库的写操作均遵循项目的本地优先工作流程——AI 代理在未获维护者明确授权时不会向远端提交或推送变更。若需查看由 AI 生成的补丁或变更记录，请查看提交历史与 `.github/copilot-instructions.md` 文档。
