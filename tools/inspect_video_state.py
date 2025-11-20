#!/usr/bin/env python3
"""检查注入本地文件后 video 元素的状态（currentSrc, readyState, error）"""
from playwright.sync_api import sync_playwright
import time

def run(url='http://127.0.0.1:8080/'):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(url, wait_until='domcontentloaded')
        time.sleep(0.5)
        fake_video = {
            'name': 'test_video.mp4',
            'mimeType': 'video/mp4',
            'buffer': b'\x00\x00\x00\x18ftypmp42'
        }
        input_handle = page.query_selector('input#videoFile')
        if not input_handle:
            print('no input#videoFile')
            return
        input_handle.set_input_files(fake_video)
        # 等待 DOM 更新
        time.sleep(0.5)
        info = page.evaluate('''() => {
            const v = document.getElementById('videoPlayer');
            return {
                src: v ? v.src : null,
                currentSrc: v ? v.currentSrc : null,
                readyState: v ? v.readyState : null,
                paused: v ? v.paused : null,
                error: v && v.error ? {code: v.error.code, message: v.error.message || ''} : null
            };
        }''')
        print('video info:', info)
        browser.close()

if __name__ == '__main__':
    run()
