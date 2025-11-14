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


def test_frontend_reports_cdn_on_playing():
    port = 8002
    # Prepare static copy of index.html if not present (inject simple ASS_PLAYER_CONFIG)
    src_index = os.path.join(ROOT, 'templates', 'index.html')
    dst_index = os.path.join(ROOT, 'templates', 'index_static.html')
    try:
        with open(src_index, 'r', encoding='utf-8') as f:
            txt = f.read()
        txt = txt.replace('window.ASS_PLAYER_CONFIG = {{ ASS_PLAYER_CONFIG | tojson | safe }};', 'window.ASS_PLAYER_CONFIG = {"REPORT_TIMEOUT_MS": 3000};')
        txt = txt.replace("{{ url_for('static', filename='css/main.css') }}", '/static/css/main.css')
        txt = txt.replace("{{ url_for('static', filename='css/layout.css') }}", '/static/css/layout.css')
        txt = txt.replace("{{ url_for('static', filename='css/fullscreen.css') }}", '/static/css/fullscreen.css')
        txt = txt.replace("{{ url_for('static', filename='css/components.css') }}", '/static/css/components.css')
        txt = txt.replace("{{ url_for('static', filename='js/modules/main.js') }}", '/static/js/modules/main.js')
        with open(dst_index, 'w', encoding='utf-8') as f:
            f.write(txt)
    except Exception:
        pass

    server_thread = threading.Thread(target=run_static_server, args=(port,), daemon=True)
    server_thread.start()
    time.sleep(0.3)

    reported = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Override navigator.sendBeacon to use fetch so Playwright can intercept the request
        page.add_init_script("""
        () => {
            try {
                window._orig_sendBeacon = navigator.sendBeacon;
            } catch (e) {}
            navigator.sendBeacon = (url, data) => {
                try {
                    // If data is a Blob, read as text
                    if (data && typeof data.arrayBuffer === 'function') {
                        data.arrayBuffer().then(buf => {
                            const body = new TextDecoder().decode(new Uint8Array(buf));
                            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
                        }).catch(() => {});
                    } else {
                        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true });
                    }
                } catch (e) {}
                return true;
            };
        }
        """)

        # Intercept auto-parse and return a mocked video URL and dispatch 'playing'
        def handle_auto_parse(route):
            body = json.dumps({"success": True, "video_url": "https://example.playing.net/video-192.mp4"})
            route.fulfill(status=200, content_type='application/json', body=body)
            try:
                page.wait_for_timeout(200)
                page.evaluate("() => { const v = document.querySelector('video'); if(v){ v.dispatchEvent(new Event('playing')); } }")
            except Exception:
                pass

        page.route("**/api/auto-parse**", handle_auto_parse)

        # Capture report
        def handle_report(route):
            try:
                data = route.request.post_data
                if isinstance(data, bytes):
                    data = data.decode('utf-8')
                j = json.loads(data)
                reported.update(j)
            except Exception:
                reported.update({'error': 'bad_payload'})
            route.fulfill(status=200, body='OK')

        page.route("**/api/report-cdn**", handle_report)

        page_path = f'http://127.0.0.1:{port}/templates/index_static.html' if os.path.exists(os.path.join(ROOT, 'templates', 'index_static.html')) else f'http://127.0.0.1:{port}/templates/index.html'
        page.goto(page_path)
        page.wait_for_load_state('domcontentloaded')

        page.click('#loadOnlineVideoBtn')
        try:
            page.wait_for_function("() => { const v = document.querySelector('video'); return v && v.src && v.src.includes('example.playing.net'); }", timeout=3000)
            req = page.wait_for_request("**/api/report-cdn", timeout=3000)
            data = req.post_data
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            j = json.loads(data)
            reported.update(j)
        except Exception:
            pass

        browser.close()

    assert reported, 'No report received'
    assert reported.get('hostname') == 'example.playing.net'
    assert reported.get('event') == 'playing'
    assert isinstance(reported.get('load_ms'), int) or isinstance(reported.get('load_ms'), float)
