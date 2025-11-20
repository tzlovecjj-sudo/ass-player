from playwright.sync_api import sync_playwright
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'artifacts', 'local_acceptance')
os.makedirs(OUTPUT_DIR, exist_ok=True)

url = 'http://127.0.0.1:8080/mobile'
console_messages = []
page_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    device = p.devices.get('iPhone 12')
    context = browser.new_context(**device)
    page = context.new_page()

    def on_console(msg):
        try:
            console_messages.append({'type': msg.type, 'text': msg.text})
            print(f'CONSOLE [{msg.type}] {msg.text}')
        except Exception:
            pass

    def on_page_error(exc):
        page_errors.append(str(exc))
        print(f'PAGE ERROR: {exc}')

    page.on('console', on_console)
    page.on('pageerror', on_page_error)

    try:
        print('Navigating to', url)
        page.goto(url, wait_until='networkidle', timeout=15000)
        # wait for key selectors
        has_canvas = False
        has_video = False
        try:
            page.wait_for_selector('#videoCanvas', timeout=3000)
            has_canvas = True
        except Exception:
            has_canvas = False
        try:
            page.wait_for_selector('#videoPlayer', timeout=3000)
            has_video = True
        except Exception:
            has_video = False

        # check for player instance
        try:
            player_exists = page.evaluate('typeof window._ASS_PLAYER_INSTANCE !== "undefined"')
        except Exception:
            player_exists = False

        # save screenshot
        screenshot_path = os.path.join(OUTPUT_DIR, 'mobile_screenshot.png')
        page.screenshot(path=screenshot_path, full_page=False)
        print('Saved screenshot to', screenshot_path)

        # save page content
        html_path = os.path.join(OUTPUT_DIR, 'mobile_page_playwright.html')
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(page.content())
        print('Saved page HTML to', html_path)

        # print summary
        print('\nSUMMARY:')
        print('has_canvas=', has_canvas)
        print('has_video=', has_video)
        print('player_exists=', player_exists)
        print('console_count=', len(console_messages))
        print('page_error_count=', len(page_errors))

        # dump console messages to file
        log_path = os.path.join(OUTPUT_DIR, 'console.log')
        with open(log_path, 'w', encoding='utf-8') as f:
            for m in console_messages:
                f.write(f"[{m['type']}] {m['text']}\n")
            for e in page_errors:
                f.write(f"[pageerror] {e}\n")
        print('Saved console log to', log_path)

    except Exception as e:
        print('ERROR during page run:', e)
    finally:
        context.close()
        browser.close()

print('Done')
