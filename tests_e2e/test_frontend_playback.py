import threading
import http.server
import socketserver
import os
import time

import pytest

try:
    from playwright.sync_api import sync_playwright
except Exception:
    pytest.skip('playwright not installed - skipping e2e tests', allow_module_level=True)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return


def run_static_server(port):
    handler = SilentHandler
    os.chdir(ROOT)
    with socketserver.TCPServer(('127.0.0.1', port), handler) as httpd:
        httpd.serve_forever()


def _make_static_index():
    # 生成静态 index（尽可能替换 Jinja 模板标签为静态路径）
    src = os.path.join(ROOT, 'templates', 'index.html')
    dst = os.path.join(ROOT, 'templates', 'index_static.html')
    try:
        with open(src, 'r', encoding='utf-8') as f:
            txt = f.read()
        txt = txt.replace('window.ASS_PLAYER_CONFIG = {{ ASS_PLAYER_CONFIG | tojson | safe }};', 'window.ASS_PLAYER_CONFIG = {"REPORT_TIMEOUT_MS": 3000};')
        txt = txt.replace("{{ url_for('static', filename='css/main.css') }}", '/static/css/main.css')
        txt = txt.replace("{{ url_for('static', filename='js/modules/main.js') }}", '/static/js/modules/main.js')
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(txt)
    except Exception:
        pass


def test_start_stop_rendering_sets_animationId():
    """测试：调用 startRendering 会设置 animationId，stopRendering 会清除它。"""
    port = 8010
    _make_static_index()
    t = threading.Thread(target=run_static_server, args=(port,), daemon=True)
    t.start()
    time.sleep(0.2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page_path = f'http://127.0.0.1:{port}/templates/index_static.html' if os.path.exists(os.path.join(ROOT, 'templates', 'index_static.html')) else f'http://127.0.0.1:{port}/templates/index.html'
        page.goto(page_path)
        page.wait_for_function('() => window.player && window.player.startRendering && window.player.stopRendering')

        # 确认初始 animationId 为 null
        initial = page.evaluate('() => window.player.animationId')
        assert not initial, '预期初始时 animationId 为 null 或 undefined'

        # 启动渲染并等待少许时间
        page.evaluate('() => window.player.startRendering()')
        page.wait_for_timeout(200)
        anim_id = page.evaluate('() => window.player.animationId')
        assert anim_id, '调用 startRendering 后应有 animationId'

        # 停止渲染
        page.evaluate('() => window.player.stopRendering()')
        page.wait_for_timeout(50)
        anim_id2 = page.evaluate('() => window.player.animationId')
        assert not anim_id2, '调用 stopRendering 后应清除 animationId'

        browser.close()


def test_keyboard_shortcuts_trigger_controller_methods():
    """测试：Space/ArrowLeft/ArrowRight 快捷键会触发对应的 videoController 方法（通过 stub 检查）。"""
    port = 8011
    _make_static_index()
    t = threading.Thread(target=run_static_server, args=(port,), daemon=True)
    t.start()
    time.sleep(0.2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page_path = f'http://127.0.0.1:{port}/templates/index_static.html' if os.path.exists(os.path.join(ROOT, 'templates', 'index_static.html')) else f'http://127.0.0.1:{port}/templates/index.html'
        page.goto(page_path)
        page.wait_for_function('() => window.player && window.player.videoController')

        # 在页面端替换 togglePlayPause 与 seekTo 为测试 stub
        page.evaluate('() => { window.__toggle_calls = 0; window.__seek_calls = []; const vc = window.player.videoController; vc.togglePlayPause = () => { window.__toggle_calls += 1; }; vc.seekTo = (t) => { window.__seek_calls.push(t); }; }')

        # 触发 Space
        page.keyboard.down('Space')
        page.keyboard.up('Space')
        page.wait_for_timeout(50)
        toggle_calls = page.evaluate('() => window.__toggle_calls')
        assert toggle_calls == 1, f'期望 Space 导致 togglePlayPause 被调用一次，实际 {toggle_calls}'

        # 设定当前时间，并触发 ArrowRight / ArrowLeft
        page.evaluate('() => { window.player.videoPlayer.currentTime = 10; }')
        page.keyboard.down('ArrowRight')
        page.keyboard.up('ArrowRight')
        page.wait_for_timeout(50)
        page.keyboard.down('ArrowLeft')
        page.keyboard.up('ArrowLeft')
        page.wait_for_timeout(50)

        seek_calls = page.evaluate('() => window.__seek_calls')
        assert len(seek_calls) >= 2, f'期望 seekTo 被调用至少两次，实际 {seek_calls}'
        # 验证参数近似为 15 与 5（取决于实现是否边界处理）
        assert any(abs(v - 15) < 0.1 for v in seek_calls), f'期望有一次 seek 到 ~15s，实际 {seek_calls}'
        assert any(abs(v - 5) < 0.1 for v in seek_calls), f'期望有一次 seek 到 ~5s，实际 {seek_calls}'

        browser.close()


def test_update_mute_button_reflects_video_state():
    """测试：updateMuteButton 会根据 videoPlayer.muted/volume 更新 muteBtn 文本与滑块值。"""
    port = 8012
    _make_static_index()
    t = threading.Thread(target=run_static_server, args=(port,), daemon=True)
    t.start()
    time.sleep(0.2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page_path = f'http://127.0.0.1:{port}/templates/index_static.html' if os.path.exists(os.path.join(ROOT, 'templates', 'index_static.html')) else f'http://127.0.0.1:{port}/templates/index.html'
        page.goto(page_path)
        page.wait_for_function('() => window.player && window.player.updateMuteButton')

        # 确保存在 muteBtn 与 volumeSlider
        exists = page.evaluate('() => !!(document.getElementById("muteBtn") && document.getElementById("volumeSlider"))')
        if not exists:
            pytest.skip('页面中未包含 muteBtn 或 volumeSlider，跳过此测试')

        # 设置 video 为静音并检查按钮文本
        page.evaluate('() => { window.player.videoPlayer.muted = true; window.player.updateMuteButton(); }')
        page.wait_for_timeout(20)
        txt = page.evaluate('() => document.getElementById("muteBtn").textContent')
        assert txt == '🔇', f'静音时期望图标为 🔇，实际 {txt}'

        # 设置音量为 0.5 并非静音
        page.evaluate('() => { window.player.videoPlayer.muted = false; window.player.videoPlayer.volume = 0.5; window.player.updateMuteButton(); }')
        page.wait_for_timeout(20)
        txt2 = page.evaluate('() => document.getElementById("muteBtn").textContent')
        assert txt2 == '🔊', f'非静音时期望图标为 🔊，实际 {txt2}'

        browser.close()
