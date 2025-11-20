#!/usr/bin/env python3
"""自动化检查：在页面上填写在线 URL，点击加载按钮，捕获 /api/auto-parse 请求与控制台日志

输出目录：artifacts/load_api_test/
"""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('artifacts/load_api_test')
OUT.mkdir(parents=True, exist_ok=True)

def run(url='http://127.0.0.1:8080/'):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        console = []
        reqs = []
        ress = []

        page.on('console', lambda msg: console.append(f'{msg.type}: {msg.text}'))
        page.on('pageerror', lambda e: console.append(f'pageerror: {e}'))

        def on_request(r):
            try:
                reqs.append({'url': r.url, 'method': r.method, 'postData': r.post_data or '', 'headers': dict(r.headers)})
            except Exception:
                pass

        def on_response(resp):
            try:
                ress.append({'url': resp.url, 'status': resp.status, 'ok': resp.ok, 'headers': dict(resp.headers)})
            except Exception:
                pass

        page.on('request', on_request)
        page.on('response', on_response)

        print('打开页面', url)
        page.goto(url, wait_until='domcontentloaded')
        time.sleep(0.5)

        # 查找输入与按钮
        url_input = page.query_selector('#onlineVideoUrl')
        load_btn = page.query_selector('#loadOnlineVideoBtn')

        if not load_btn:
            print('未找到 #loadOnlineVideoBtn 元素，页面结构可能不同')
        else:
            test_url = 'https://www.bilibili.com/video/BV1AyCQB4EjC'
            if url_input:
                url_input.fill(test_url)
                print('已填写测试 URL 到 #onlineVideoUrl')
            else:
                print('未找到 #onlineVideoUrl 输入框')

            # 点击并等待短时间
            load_btn.click()
            print('点击加载按钮')
            time.sleep(3)

        # 保存 artifact
        with open(OUT / 'console.log', 'w', encoding='utf-8') as f:
            f.write('\n'.join(console))

        import json
        with open(OUT / 'requests.json', 'w', encoding='utf-8') as f:
            json.dump(reqs, f, ensure_ascii=False, indent=2)
        with open(OUT / 'responses.json', 'w', encoding='utf-8') as f:
            json.dump(ress, f, ensure_ascii=False, indent=2)

        page.screenshot(path=str(OUT / 'page.png'), full_page=True)
        with open(OUT / 'page.html', 'w', encoding='utf-8') as f:
            f.write(page.content())

        print('结果已保存到', OUT)
        browser.close()

if __name__ == '__main__':
    run()
