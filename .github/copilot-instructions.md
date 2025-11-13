# Copilot Instructions for ASS 字幕播放器 (ass-player)

## 项目架构与主要组件
- **后端**：基于 Flask，入口为 `app.py`，核心解析逻辑在 `ass_player/bilibili.py`，API 路由在 `app.py`/`run.py`。
- **前端**：静态资源位于 `static/`（JS/CSS），页面模板在 `templates/`。主播放器逻辑在 `static/js/ass-player.js`，模块化 JS 代码在 `static/js/modules/`。
- **解析流程**：前端通过 API（如 `/api/auto-parse`）请求后端解析 B 站视频直链，后端做安全校验与解析，返回可用视频流。
- **缓存与速率限制**：`cache_manager.py` 提供内存缓存与简单速率限制，生产环境建议替换为 Redis 等持久化方案。

## 开发与调试
- 推荐使用 Python 3.9+ 虚拟环境，依赖管理见 `requirements.txt`。
- 启动开发服务：
  - 交互式：`python start.py`（自动打开浏览器）
  - 生产/容器：`python run.py`（支持环境变量配置 host/port）
- 单元测试：`python run_tests.py` 或 `pytest tests/`，测试覆盖解析、缓存等核心模块。
- 前端无需构建，直接修改 `static/` 下 JS/CSS 即可热更新。

## 约定与安全
- **API 安全**：后端仅允许解析 bilibili.com 域名，防止 SSRF，详见 `bilibili.py` 域名/IP 校验逻辑。
- **速率限制**：开发环境为内存速率限制，生产请用 Redis+Flask-Limiter。
- **默认监听**：127.0.0.1:8080，避免公网暴露，必要时通过 `ASS_PLAYER_HOST` 环境变量调整。
- **依赖安装**：务必在虚拟环境下 `pip install -r requirements.txt`，避免全局污染。

## 代码风格与测试
- 推荐使用 `pytest` 进行测试，测试文件位于 `tests/`，如 `test_bilibili_parser.py`。
- 建议在 CI/CD 中集成 lint（如 ruff/flake8）与自动化测试。
- 解析模块建议用 requests-mock 或 responses 进行接口模拟测试。

## 关键文件/目录
- `app.py`/`run.py`：后端主入口
- `ass_player/bilibili.py`：B 站解析核心
- `cache_manager.py`：缓存与速率限制
- `static/js/ass-player.js`、`static/js/modules/`：前端播放器与模块
- `templates/`：页面模板
- `requirements.txt`：依赖清单
- `tests/`：单元测试

## 其他
- 生产部署建议用 gunicorn/uvicorn + nginx，详见 README。
- 云部署（Zeabur）支持自动化测试与环境变量端口适配，见 `Zeabur部署教程.md`。

---
如需更详细的开发流程、API 约定或安全策略，请参考 `README.md` 与源码注释。