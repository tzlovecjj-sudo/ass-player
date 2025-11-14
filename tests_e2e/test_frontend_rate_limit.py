import json
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


def test_frontend_shows_rate_limit_on_429():
    port = 8003
    server_thread = threading.Thread(target=run_static_server, args=(port,), daemon=True)
    server_thread.start()
    time.sleep(0.3)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Intercept auto-parse and return 429
        def handle_auto_parse(route):
            body = json.dumps({"success": False, "error": "请求过于频繁", "retry_after": 2})
            route.fulfill(status=429, content_type='application/json', body=body)

        page.route("**/api/auto-parse**", handle_auto_parse)

        page_path = f'http://127.0.0.1:{port}/templates/index_static.html' if os.path.exists(os.path.join(ROOT, 'templates', 'index_static.html')) else f'http://127.0.0.1:{port}/templates/index.html'
        page.goto(page_path)
        page.wait_for_load_state('domcontentloaded')

        page.click('#loadOnlineVideoBtn')

        # wait for status element to update
        try:
            page.wait_for_selector('#uploadStatus .status-content', timeout=2000)
            status_text = page.inner_text('#uploadStatus .status-content')
            status_class = page.get_attribute('#uploadStatus', 'class')
        except Exception:
            status_text = ''
            status_class = page.get_attribute('#uploadStatus', 'class')

        browser.close()

    assert '稍后' in (status_text or '') or '请求' in (status_text or '') or (status_class and 'error' in status_class), 'Expected rate limit status not shown'
