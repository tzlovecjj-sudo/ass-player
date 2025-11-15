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

## 注释与语言约定（强制）

- 所有新添加或修改的代码和测试文件中，注释必须使用中文（简体）。这包括函数/方法注释、复杂逻辑处的行内注释、以及测试用例中的说明。
- 当 AI 代理或开发者生成/修改代码时，请确保注释清晰、简洁，说明输入/输出、边界条件和重要实现决策。尽量避免使用英文注释或混杂语言。
- 文档（README、部署或设计说明）可以使用中文或英文，但代码内注释请优先使用中文以便本项目维护者阅读与审查。
 - 在使用 GitHub 进行协作时（包括 Issues、PR 描述、Review 评论、以及 commit message 等），请优先使用中文（简体）撰写备注与说明，以便团队成员和代码审阅者阅读与讨论。

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

- 团队约定（开发模式优先）：
  - 在日常开发以及与 AI（例如 Copilot）交互、进行手动调试时，始终使用开发模式启动服务（`python start.py`）。这一约定的原因是开发模式支持自动打开浏览器、静态文件即时生效且更方便调试前端渲染行为。
  - 仅在需要做生产部署、容器化、或需要持久化 SQLite 注入时才使用 `python run.py`。
  - 开发模式下仍然建议在项目虚拟环境中运行（见“关于虚拟环境”一节），以保证依赖与测试行为一致。

## CDN 统计持久化与上报（实现说明）
- 当使用 `run.py` 启动服务时，脚本会创建并注入一个 SQLite 连接到解析器，并确保两个本地表被创建：
  - `cache`（兼容旧的缓存契约）
  - `cdn_stats`（用于持久化前端上报的 CDN 主机统计）。
- 前端只在“解析事件”发生时上报一次（即用户点击解析/加载按钮的那次流程）：前端会在解析开始时记录时间，并在播放成功（`canplay`/`playing`）或超时后将 `hostname` 与 `load_ms`（毫秒）发送到 `/api/report-cdn`。
- 前端只在“解析事件”发生时上报一次（即用户点击解析/加载按钮的那次流程）：前端会在解析开始时记录时间，并在播放成功（`canplay`/`playing`）或超时后将 `hostname` 与 `load_ms`（毫秒）发送到 `/api/report-cdn`。
- 注意：当前设计假定国内 CDN 名单为固定（由关键词判定），无需频繁人工维护；当播放超时发生时，前端会将实际超时的耗时计入 `load_ms` 并上报，后端会把该超时数据纳入平均值计算（以反映不可用或较差的 CDN）。
- 后端的 `/api/report-cdn` 路由会校验负载并调用解析器的 `mark_cdn_hostname(hostname, is_china)` 与 `record_cdn_load(hostname, load_ms)` 方法，解析器会把统计持久化到 `cdn_stats` 表（如果 `run.py` 已注入 SQLite 连接）。
- 因为 CDN 统计由前端提供并由后端持久化，重启或部署新版本后，历史统计仍会保留并用于决定替换为哪一个国内 CDN（`_best_china_host`）。


## 关于虚拟环境（AI 代理与开发者必读）

- 在运行测试或安装依赖前，应优先激活并使用项目的 Python 虚拟环境（virtualenv / venv / conda 等）。许多开发者会把 Playwright、pytest 等测试依赖安装到虚拟环境中；在未激活虚拟环境的情况下直接运行 `pytest` 可能导致依赖被错误地判断为“未安装”。

- 推荐流程（PowerShell 例子）：
  1. 激活虚拟环境（假定位于项目根的 `.venv` 或 `venv`）：
    ```powershell
    .\.venv\Scripts\Activate.ps1
    # 或者
    .\venv\Scripts\Activate.ps1
    ```
  2. 确认 Python 可执行路径与 pip 指向已激活的虚拟环境：
    ```powershell
    python -c "import sys; print(sys.executable)"
    python -m pip --version
    ```
  3. 使用相同的 `python` 来安装依赖与运行测试：
    ```powershell
    python -m pip install -r requirements.txt
    python -m pip install playwright
    python -m playwright install chromium
    pytest -q
    ```

- AI 代理约定：当需要在仓库中运行 Python 命令或检查依赖时，应按以下顺序优先使用虚拟环境：
  1. 检查环境变量 `VIRTUAL_ENV`，若存在且指向项目内的 venv，则使用该 Python。
 2. 查找常见虚拟环境目录（`.venv`, `venv`, `env`），若存在则使用其中的 Python 可执行路径。
 3. 若都不存在，则使用系统 Python，但在输出中明确提醒用户“未检测到虚拟环境，使用系统 Python（可能导致依赖不匹配）”。

将上述说明写入 AI 指南，有助于避免因环境差异导致的测试跳过或依赖检测失败。

## 当前虚拟环境已安装的依赖（.venv 快照）

下面是当前仓库 `.venv` 中通过 `pip freeze` 列出的包（用于复现运行环境或迁移依赖）。在更新依赖后请同步 `requirements.txt` 或记录在 CI 镜像中。

```
beautifulsoup4==4.12.2
blinker==1.9.0
certifi==2025.11.12
charset-normalizer==3.4.4
click==8.3.0
colorama==0.4.6
coverage==7.11.3
Flask==2.3.3
flask-cors==6.0.1
greenlet==3.2.4
idna==3.11
iniconfig==2.3.0
itsdangerous==2.2.0
Jinja2==3.1.6
lxml==4.9.3
MarkupSafe==3.0.3
packaging==25.0
playwright==1.56.0
pluggy==1.6.0
pyee==13.0.0
pytest==7.4.0
pytest-cov==4.1.0
requests==2.31.0
requests-mock==1.11.0
six==1.17.0
soupsieve==2.8
typing_extensions==4.15.0
urllib3==2.5.0
Werkzeug==3.1.3
```

说明：
- `playwright` 已安装，但浏览器二进制需另行通过 `python -m playwright install chromium` 安装（见上文指南）。
- 如果你准备在 CI 中运行 E2E 测试，建议在 CI 镜像中预装这些包并执行对应的 playwright 浏览器安装步骤，以避免运行时下载。

## PR 检查清单（AI 代理提交 PR 前应验证）
- 修改解析器：同时更新或新增 `tests/test_bilibili_parser.py` 的用例。
- 修改缓存：保证 `run.py` 注入路径保持兼容，附带迁移说明。
# Copilot 指南 — ass-player（精简、面向 AI 代理）

以下为能让 AI 代理快速上手本仓库的必要知识点、约定和示例。优先阅读 `ass_player/bilibili.py`、`app.py`、`run.py`、`cache_manager.py`、`tests/`。

- 架构要点：后端为 Flask（`app.py`），解析器实现集中在 `ass_player/bilibili.py`（BiliBiliParser）。前端为纯静态文件，位于 `static/`，不需要构建。启动脚本：开发用 `start.py`（自动打开浏览器），生产用 `run.py`（会注入 SQLite）。

- 安全约定（必须遵守）：所有新增解析/请求路径必须调用 `ass_player/bilibili.py` 中的 `_is_url_allowed` 或 `_is_private_host` 以防 SSRF；不要在解析流程中做额外的阻塞外网下载（项目故意避免读取远端 Content-Length）。

- 缓存契约：`run.py` 在启动时可创建并注入 SQLite 连接到解析器（属性 `_disk_cache_conn`，并设置 `_owns_disk_conn`）。如果实现持久化缓存，请复用这两个属性或替换 `cache_manager.py`，保持 `get_cache()` 接口兼容性。

- 修改解析器注意点：在 `BiliBiliParser.get_real_url` 内按序添加策略，局部捕获异常并返回 None，让上层（`app.py`）报告错误。若改动 `_try_convert_cdn_url`，同时更新 `tests/test_try_convert_cdn.py`。

- 测试与调试（可复制的例子）：
  - 运行全部测试（PowerShell）：
    ```powershell
    python run_tests.py
    # 或
    pytest tests/
    ```
  - Mock 私有 IP：在测试里 patch `socket.getaddrinfo`（参见 `tests/test_bilibili_ssrf.py`）。
  - Mock 解析网络：patch `ass_player.bilibili.BiliBiliParser._get_720p_mp4` 来绕过外网请求（参见 `tests/test_bilibili_parser.py`）。

- 前端约定：主要逻辑在 `static/js/ass-player.js` 与 `static/js/modules/`；前端在解析事件后会向 `/api/report-cdn` 上报 `hostname` 与 `load_ms`，后端会将其写入 `cdn_stats`（若 SQLite 注入可用）。前端文件修改即时生效，无需构建步骤。

- 提交/PR 检查（必做项）：
  1. 修改解析逻辑时，更新或添加对应测试（通常是 `tests/test_bilibili_*.py`）。
  2. 所有网络交互在测试中必须可 mock（不要依赖真实网络）。
  3. 保持 SSRF 校验和 `_disk_cache_conn` 注入兼容性。

- 快速参考文件：
  - `ass_player/bilibili.py`：解析器、SSRF 检查、`_try_convert_cdn_url`
  - `app.py`：Flask 路由（`/api/auto-parse`, `/api/report-cdn`）
  - `run.py` / `start.py`：启动、SQLite 注入
  - `cache_manager.py`：当前为轻量/兼容实现（可替换）
  - `tests/`：单元测试示例与 mock 模式

如果你想，我可以把某个改动（比如启用 Redis 缓存、添加 1080p 回退或 CI 配置）做成补丁并运行测试。需要我先实现哪一项？