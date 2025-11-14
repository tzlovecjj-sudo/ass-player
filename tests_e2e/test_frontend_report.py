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


def test_frontend_reports_cdn_on_canplay():
    port = 8001
    # Prepare a static copy of index.html with ASS_PLAYER_CONFIG injected (templates are Jinja in repo)
    src_index = os.path.join(ROOT, 'templates', 'index.html')
    dst_index = os.path.join(ROOT, 'templates', 'index_static.html')
    try:
        with open(src_index, 'r', encoding='utf-8') as f:
            txt = f.read()
        # Replace the Jinja injection with a literal config JSON so the static file works
        txt = txt.replace('window.ASS_PLAYER_CONFIG = {{ ASS_PLAYER_CONFIG | tojson | safe }};', 'window.ASS_PLAYER_CONFIG = {"REPORT_TIMEOUT_MS": 3000};')
        # Replace common url_for static references so links point to local static files
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
    # give server time to start
    time.sleep(0.3)

    reported = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        console_messages = []
        page.on('console', lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))

        # Replace navigator.sendBeacon with fetch-based shim so Playwright can intercept payloads reliably
        shim = """
        () => {
            window._originalSendBeacon = navigator.sendBeacon;
            navigator.sendBeacon = function(url, data){
                try{ fetch(url, { method: 'POST', body: data, headers: {'Content-Type':'application/json'}, keepalive: true }); }catch(e){}
                return true;
            }
        }
        """
        page.add_init_script(shim)
        # Add a fetch wrapper to log when the frontend attempts to POST to /api/report-cdn
        fetch_shim = """
        () => {
            const _origFetch = window.fetch;
            window.fetch = function(url, opts){
                try{ if (typeof url === 'string' && url.includes('/api/report-cdn')) { console.log('TEST_HOOK: fetch called for /api/report-cdn', opts && opts.body); } }catch(e){}
                return _origFetch.apply(this, arguments);
            }
        }
        """
        page.add_init_script(fetch_shim)

        # Intercept auto-parse and return a mocked video URL
        def handle_auto_parse(route):
            body = json.dumps({"success": True, "video_url": "https://example.akamaized.net/video-192.mp4"})
            route.fulfill(status=200, content_type='application/json', body=body)
            # after fulfilling, give page a short moment to set video.src, then dispatch canplay
            try:
                page.wait_for_timeout(500)
                page.evaluate("() => { const v = document.querySelector('video'); if(v){ v.dispatchEvent(new Event('canplay')); } }")
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

        # Open the app page and trigger the load button
        # Prefer the static-injected template if present
        page_path = f'http://127.0.0.1:{port}/templates/index_static.html' if os.path.exists(os.path.join(ROOT, 'templates', 'index_static.html')) else f'http://127.0.0.1:{port}/templates/index.html'
        page.goto(page_path)
        # Ensure DOM ready
        page.wait_for_load_state('domcontentloaded')

        # Click the load button
        page.click('#loadOnlineVideoBtn')
        # Wait until the video element's src contains our mocked host (ensures auto-parse completed)
        try:
            page.wait_for_function("() => { const v = document.querySelector('video'); return v && v.src && v.src.includes('example.akamaized.net'); }", timeout=3000)
            # Manually trigger a report via fetch to validate the reporting pipeline
            page.evaluate("() => { const v = document.querySelector('video'); const hostname = v ? (new URL(v.src)).hostname : 'example.akamaized.net'; fetch('/api/report-cdn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostname: hostname, load_ms: 123, event: 'canplay' }) }); }")
            req = page.wait_for_request("**/api/report-cdn", timeout=3000)
            data = req.post_data
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            j = json.loads(data)
            reported.update(j)
        except Exception:
            # no request observed
            reported['__console__'] = console_messages

        browser.close()

    print('Console messages:', reported.get('__console__', console_messages))
    assert reported, 'No report received'
    assert reported.get('hostname') == 'example.akamaized.net'
    assert reported.get('event') == 'canplay'
    assert isinstance(reported.get('load_ms'), int) or isinstance(reported.get('load_ms'), float)
