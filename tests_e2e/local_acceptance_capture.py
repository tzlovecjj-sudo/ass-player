# 本地验收脚本：使用 Playwright 打开本地开发服务器，触发播放/渲染并截图
# 说明：脚本用于人工验收，保存页面截图与 canvas 截图到 artifacts/local_acceptance/。
# 运行方式（已在虚拟环境中安装 playwright 且已安装浏览器）：
# .venv\Scripts\python.exe tests_e2e/local_acceptance_capture.py

from playwright.sync_api import sync_playwright, TimeoutError
import time
import os

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), '..', 'artifacts', 'local_acceptance')
ARTIFACT_DIR = os.path.abspath(ARTIFACT_DIR)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

URL = os.environ.get('ASS_PLAYER_URL', 'http://127.0.0.1:8080/')

console_logs = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1280, 'height':720})
    page = context.new_page()

    # 收集 console 输出
    def on_console(msg):
        try:
            console_logs.append(f"{msg.type}: {msg.text}")
        except Exception:
            console_logs.append(str(msg))
    page.on('console', on_console)

    print('打开页面:', URL)
    page.goto(URL, timeout=15000)

    try:
        # 等待 canvas 元素（测试中使用 id=videoCanvas）
        page.wait_for_selector('#videoCanvas', timeout=10000)
    except TimeoutError:
        print('未找到 #videoCanvas，尝试等待通用 canvas')
        try:
            page.wait_for_selector('canvas', timeout=10000)
        except TimeoutError:
            raise

    # 触发播放器开始渲染（如果存在全局 player API）
    try:
        page.evaluate("() => { if (window.player && window.player.startRendering) { window.player.startRendering(); } }")
    except Exception:
        pass

    # 等待一段时间让字幕渲染稳定
    time.sleep(2)

    # 页面全景截图
    page_screenshot = os.path.join(ARTIFACT_DIR, 'page.png')
    page.screenshot(path=page_screenshot, full_page=True)
    print('已保存页面截图到', page_screenshot)

    # canvas 截图（优先使用 #videoCanvas）
    canvas_path = os.path.join(ARTIFACT_DIR, 'canvas.png')
    canvas = page.query_selector('#videoCanvas') or page.query_selector('canvas')
    if canvas:
        try:
            canvas.screenshot(path=canvas_path)
            print('已保存 canvas 截图到', canvas_path)
        except Exception as e:
            print('保存 canvas 截图失败：', e)
    else:
        print('未找到 canvas 元素，未生成 canvas.png')

    # 存储 console 日志
    console_file = os.path.join(ARTIFACT_DIR, 'console.log')
    with open(console_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(console_logs))
    print('已保存 console 日志到', console_file)

    # 额外：保存页面 HTML
    html_file = os.path.join(ARTIFACT_DIR, 'page.html')
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(page.content())
    print('已保存页面 HTML 到', html_file)

    browser.close()

print('本地验收脚本执行完成，查看 artifacts/local_acceptance/ 目录以获取截图与日志。')
