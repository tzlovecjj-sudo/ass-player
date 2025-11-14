```markdown
# Copilot 指南 — ASS 字幕播放器 (ass-player)

以下说明面向 AI 编码代理，强调本仓库中会影响实现与测试的“现实”细节：代码行为、约定、常见陷阱和可直接修改的位置。

## 一览（Big picture）
- **后端**：Flask 应用，主模块为 `app.py`（创建 `app` 并持有共享解析器实例 `_parser`）。生产/部署推荐使用 `run.py`。
- **解析器**：`ass_player/bilibili.py` 提供 `BiliBiliParser`，当前解析仅依赖官方 API 获取 720P MP4；实现包含 SSRF 防护（`_is_private_host` / `_is_url_allowed`）和 CDN 主机名最小替换（`_try_convert_cdn_url`）。
- **缓存**：`cache_manager.py` 暂时为“保持兼容接口但禁用”的实现（no-op）。启动脚本 `run.py` / `start.py` 会在启动时创建并注入一个 SQLite 连接到解析器（字段名 `_disk_cache_conn`）。
- **前端**：静态文件在 `static/`，模板在 `templates/`。前端无需构建，直接修改 JS/CSS 即生效，主逻辑在 `static/js/ass-player.js` 和 `static/js/modules/`。

## 重要文件与职责（快速索引）
- `app.py` — Flask app，定义 `/api/auto-parse`，持有全局 `_parser` 实例。
- `run.py` — 推荐的启动脚本；会初始化 SQLite 并注入到解析器（适用于生产/部署）。
- `start.py` — 开发时常用，自动打开浏览器并尝试注入 SQLite（读取 `config.get_config()`）。
- `ass_player/bilibili.py` — 解析逻辑与安全检查（优先阅读此文件来理解解析策略）。
- `cache_manager.py` — 接口存在但已禁用；若要启用集中缓存，请替换或扩展此文件。
- `tests/` — 单元测试示例（使用 `unittest`、`patch`/`socket.getaddrinfo` mock 技巧）。

## 关键行为与约定（对 AI 很重要）
- 解析器目前只使用官方 API 路径 `_get_720p_mp4` 并返回直链；旧的 HTML 提取或 fallback 策略已移除。
- 必须保留并尊重 SSRF 防护：任何新增策略都应调用 `_is_url_allowed` 或 `_is_private_host` 做 DNS/IP 校验。
- 解析流程避免去读取远端 `Content-Length` 或额外发起阻塞请求（代码有意不去获取远端大小）。
- `run.py` 与 `start.py` 的 SQLite 注入契约（`_disk_cache_conn`、`_owns_disk_conn`）是向后兼容点：启用持久化缓存时优先复用该模式。

## 测试与调试技巧（即用示例）
- 运行测试：在虚拟环境内执行 `python run_tests.py` 或 `pytest tests/`。
- Mock 示例：
  - 私有 IP 检测：
    ```py
    with patch('socket.getaddrinfo') as m:
        m.return_value = [(None, None, None, None, ('192.168.1.1', None))]
        assert _is_private_host('example') is True
    ```
  - 跳过网络：
    ```py
    with patch('ass_player.bilibili.BiliBiliParser._get_720p_mp4') as p:
        p.return_value = 'https://example.com/video.mp4'
        assert parser.get_real_url(bv) == 'https://example.com/video.mp4'
    ```

## 常见扩展点（优先修改位置）
- 在 `ass_player/bilibili.py` 中：添加策略应在 `get_real_url` 内按序调用，且局部捕获异常，返回 `None` 以便上层报告错误。
- 若实现缓存，请替换 `cache_manager.py`（保留 `get_cache()` API）或在解析器内部使用 `_disk_cache_conn` 注入。

## 启动与部署（命令示例）
- 开发（带自动浏览器）：
```powershell
python start.py
```
- 生产/容器化（推荐）：
```powershell
python run.py
```
- 覆盖监听：环境变量 `ASS_PLAYER_HOST`, `ASS_PLAYER_PORT` 或 `PORT`（`run.py` / `app.py` 会读取）。默认端口为 `8080`。

## CDN 统计持久化与上报（实现说明）
- 当使用 `run.py` 启动服务时，脚本会创建并注入一个 SQLite 连接到解析器，并确保两个本地表被创建：
  - `cache`（兼容旧的缓存契约）
  - `cdn_stats`（用于持久化前端上报的 CDN 主机统计）。
- 前端只在“解析事件”发生时上报一次（即用户点击解析/加载按钮的那次流程）：前端会在解析开始时记录时间，并在播放成功（`canplay`/`playing`）或超时后将 `hostname` 与 `load_ms`（毫秒）发送到 `/api/report-cdn`。
- 前端只在“解析事件”发生时上报一次（即用户点击解析/加载按钮的那次流程）：前端会在解析开始时记录时间，并在播放成功（`canplay`/`playing`）或超时后将 `hostname` 与 `load_ms`（毫秒）发送到 `/api/report-cdn`。
- 注意：当前设计假定国内 CDN 名单为固定（由关键词判定），无需频繁人工维护；当播放超时发生时，前端会将实际超时的耗时计入 `load_ms` 并上报，后端会把该超时数据纳入平均值计算（以反映不可用或较差的 CDN）。
- 后端的 `/api/report-cdn` 路由会校验负载并调用解析器的 `mark_cdn_hostname(hostname, is_china)` 与 `record_cdn_load(hostname, load_ms)` 方法，解析器会把统计持久化到 `cdn_stats` 表（如果 `run.py` 已注入 SQLite 连接）。
- 因为 CDN 统计由前端提供并由后端持久化，重启或部署新版本后，历史统计仍会保留并用于决定替换为哪一个国内 CDN（`_best_china_host`）。


## PR 检查清单（AI 代理提交 PR 前应验证）
- 修改解析器：同时更新或新增 `tests/test_bilibili_parser.py` 的用例。
- 修改缓存：保证 `run.py` 注入路径保持兼容，附带迁移说明。
- 网络请求：所有新请求需可 mock，且测试不应依赖线上 API。

---
需要我为某项改进生成具体补丁（例如启用 Redis 缓存、添加 1080P 回退策略、或添加 CI 配置）吗？请指定目标，我会继续实现并运行测试。
 
## 已知局限 与 待补充测试（来自维护者说明）
- 当前实现为经过多轮清理后的“基础可用版本”，历史上曾包含多种临时/实验性策略（某些已被移除）。测试用例尚未完全跟进这些变更——维护者已优先修复运行时逻辑，但测试需要补充。
- 维护者关键信息（请保留并记录在 PR 中）：
  - 有若干“临时方案”在开发过程中被删除（例如 HTML 提取的 fallback、复杂的内存速率限制等），这些逻辑相关的测试也被移除或未更新。
  - `cache_manager.py` 当前为 no-op；如要启用缓存，请替换该模块或在解析器中使用 `_disk_cache_conn` 注入（`run.py` / `start.py` 已显示如何注入 SQLite 连接）。
  - `_try_convert_cdn_url` 是一个轻量、无阻塞的主机替换函数；当前实现会将解析出的直链主机替换为内部目标 host（`upos-sz-estgcos.bilivideo.com`）。这在国外服务器访问时用于兼容性，但会改变原始直链主机名，导致部分旧的测试断言（期望原始主机）失败。
- 建议补充的测试（优先级）:
  1. 验证 `_is_private_host` 和 `_is_url_allowed` 对常见私有/环回/公网 IP 的判断（已存在但应扩充边界值）。
  2. 对 `_try_convert_cdn_url` 的行为编写两组测试：一组验证“当 hostname 明显为国内镜像或包含关键字时允许替换”，另一组验证“当为任意公网域名时不应随意替换”（或在 PR 中说明为什么需要替换）。
  3. 为 `cache_manager` 新实现编写集成测试，验证 `run.py` 注入的 SQLite 连接能被解析器消费（涉及 `_disk_cache_conn`、`_ensure_disk_cache` 行为）。
  4. 为 `app.py` 的 `/api/auto-parse` 增加更多错误路径与并发访问的模拟测试（mock 解析器以避免网络调用）。

注：我可以根据上面的优先级为你生成测试补丁（逐项），或先把测试调整为与当前实现一致（非破坏性修复），再按优先级逐个补全新的用例。请告诉我你希望的下一步。
```# Copilot Instructions for ASS 字幕播放器 (ass-player)

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