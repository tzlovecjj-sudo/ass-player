import os
import time
import json
from pathlib import Path
import sys
import pytest

# 为了避免相对导入在 pytest 加载 conftest 时失败，直接把 tests_e2e 目录加入 sys.path 并导入 artifacts 模块
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import artifacts

get_registered_pages = artifacts.get_registered_pages
clear_registered_pages = artifacts.clear_registered_pages


ARTIFACTS_DIR = Path('artifacts')


def _ensure_dir():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    # 标准的 hook wrapper，用于在用例执行后获取结果并在失败时收集 artifacts
    outcome = yield
    rep = outcome.get_result()
    if rep.when == 'call' and rep.failed:
        # 测试执行阶段失败，保存已注册页面的截图/HTML/console
        pages = get_registered_pages()
        if not pages:
            return
        _ensure_dir()
        ts = int(time.time() * 1000)
        for idx, entry in enumerate(pages):
            page = entry.get('page')
            safe_name = f"{item.name}-{idx}-{ts}"
            try:
                # 截图
                png_path = ARTIFACTS_DIR / f"{safe_name}.png"
                try:
                    page.screenshot(path=str(png_path))
                except Exception:
                    # headless 或 page 状态不允许截图时忽略
                    pass
                # 页面 HTML
                try:
                    html = page.content()
                    with open(ARTIFACTS_DIR / f"{safe_name}.html", 'w', encoding='utf-8') as f:
                        f.write(html)
                except Exception:
                    pass
                # 控制台日志
                try:
                    consoles = entry.get('console', [])
                    with open(ARTIFACTS_DIR / f"{safe_name}.console.json", 'w', encoding='utf-8') as f:
                        json.dump(consoles, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
            except Exception:
                # 忽略任何 artifact 存储错误，避免掩盖测试原始错误
                pass
        # 清理注册页面列表，避免影响后续用例
        clear_registered_pages()
