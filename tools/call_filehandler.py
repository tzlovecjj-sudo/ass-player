from playwright.sync_api import sync_playwright
import base64

def run(url='http://127.0.0.1:8080/'):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(url, wait_until='domcontentloaded')
        page.evaluate("() => console.log('page ready')")
        b = b'\x00\x00\x00\x18ftypmp42'
        bs = base64.b64encode(b).decode('ascii')
        script = f"""
(async () => {{
  try {{
    const bytes = Uint8Array.from(atob('{bs}'), c=>c.charCodeAt(0));
    const file = new File([bytes], 'test.mp4', {{ type: 'video/mp4' }});
    if (window.player && window.player.fileHandler) {{
      window.player.fileHandler.loadVideo(file);
      return 'invoked fileHandler.loadVideo';
    }} else {{
      return 'no player or fileHandler';
    }}
  }} catch(e) {{ return 'err:'+e.message }}
}})();
"""
        res = page.evaluate(script)
        print('eval result:', res)
        info = page.evaluate('''() => { const v=document.getElementById('videoPlayer'); return {src:v.src, currentSrc:v.currentSrc, readyState:v.readyState, paused:v.paused, error: v.error ? {code:v.error.code, message:v.error.message} : null}; }''')
        print('video info after direct call:', info)
        browser.close()

if __name__ == '__main__':
    run()
