v1.2.0 发布说明

概述（中文）：
- 修复：修复浏览器原生全屏模式下页面顶部留黑条的问题（调整 `static/css/fullscreen.css`）。
- 功能：完善 ASS 渲染器以支持更多 ASS 样式（描边/阴影/背景色/ScaleX/ScaleY/Spacing/Angle/Underline/StrikeOut 等），并在 `static/js/subtitle-renderer.js` 中添加中文注释说明。
- 测试：添加并稳定 Playwright + pytest 的前端 E2E 测试（`tests_e2e/`），并在 CI 中配置 Playwright 与浏览器安装步骤。
- 工具：新增按需本地验证运行器 `tests_e2e/local_verification_runner.py`，与验收截图脚本 `tests_e2e/local_acceptance_capture.py`，用于本地自动化辅助验收（仅按需运行，本地优先）。
- 文档/流程：在 `.github/copilot-instructions.md` 中强制写入“本地优先的协作工作流程”与“完整本地验证流程”，明确：AI 代理不得在未获明确授权时向远端推送或合并，且所有 GitHub 相关备注须使用中文（简体）。

验收信息：
- 本地单元测试通过：34 个单元测试通过（见 CI 与本地运行记录）。
- 本地验收由维护者手动确认通过，验收产物保存在 `artifacts/local_acceptance/`（包含 page.png、canvas.png、console.log、page.html）。
- 授权记录：维护者在对话中于 2025-11-15 明确授权将本地改动推送并合并到 `main`（该记录已写入 PR/合并说明以便审计）。

文件变更要点：
- `.github/copilot-instructions.md`：新增本地优先与本地验证流程段落（中文说明，强制）；
- `static/css/fullscreen.css`：修复 browser-fullscreen 的 body padding 问题；
- `static/js/subtitle-renderer.js`：增强 ASS 渲染器功能并补充中文注释；
- `tests_e2e/`：新增多个 E2E 测试与验收脚本；
- `artifacts/local_acceptance/`：包含本次验收的截图与日志（已被提交并包含在此 release 的源码历史中）。

注意事项：
- 目前 artifacts 已作为提交包含在仓库历史中。如果你不希望把验收截图长期保存在仓库中，请在 Release 发布前指示我如何处理（例如从历史中移除或创建单独存储）。
- Release 为草稿（draft），你可以在 GitHub Release 页面补充二进制发布包或最终说明后发布正式 Release。

感谢：
- 感谢维护者的详尽反馈和授权。若需要，我可以把该 Release 补充为正式发布并附上构建产物（如打包的前端 ZIP 或 Docker 镜像）。
