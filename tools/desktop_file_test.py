#!/usr/bin/env python3
"""自动化测试：在桌面页面注入本地文件并捕获控制台日志与截图

此脚本使用 Playwright（同步 API）打开本地服务的 `/` 页面，
将一个伪造的 MP4 文件通过文件输入 `#videoFile` 注入，
然后等待若干秒以捕获控制台输出、页面截图与 HTML，用于排查本地文件无法播放的问题。
"""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright


ARTIFACTS_DIR = Path('artifacts/desktop_test')
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

def run_test(url='http://127.0.0.1:8080/'):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        console_messages = []
        page.on('console', lambda msg: console_messages.append(f'{msg.type}: {msg.text}'))
        page.on('pageerror', lambda exc: console_messages.append(f'pageerror: {exc}'))

        print('打开页面', url)
        page.goto(url, wait_until='domcontentloaded')

        # 确保播放器入口已初始化
        time.sleep(0.5)

        # 准备一个伪造的视频文件（小 payload），并指定 mimeType 为 video/mp4
        fake_video = {
            'name': 'test_video.mp4',
            'mimeType': 'video/mp4',
            'buffer': b'\x00\x00\x00\x18ftypmp42'  # minimal ftyp box header fragment
        }

        # 注入文件到 input#videoFile
        try:
            input_handle = page.query_selector('input#videoFile')
            if not input_handle:
                raise RuntimeError('未找到 input#videoFile 元素')
            input_handle.set_input_files(fake_video)
            print('已向 input#videoFile 注入伪造文件')
        except Exception as e:
            print('注入文件时发生错误:', e)

        # 等待一段时间以捕获控制台日志与可能的加载事件
        time.sleep(2)

        # 截图与保存页面 HTML
        screenshot_path = ARTIFACTS_DIR / 'page.png'
        html_path = ARTIFACTS_DIR / 'page.html'
        console_path = ARTIFACTS_DIR / 'console.log'

        page.screenshot(path=str(screenshot_path), full_page=True)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(page.content())
        with open(console_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(console_messages))

        print('结果已保存到:', ARTIFACTS_DIR)
        browser.close()


if __name__ == '__main__':
    run_test()
