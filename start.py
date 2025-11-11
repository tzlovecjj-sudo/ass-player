#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
启动脚本：不在运行时自动 pip install，使用 logging，复用解析器模块。
"""
import os
import platform
import threading
import time
import logging

from app import app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

def is_windows():
    return platform.system().lower() == 'windows'

def open_browser():
    time.sleep(2)
    try:
        import webbrowser
        webbrowser.open_new('http://127.0.0.1:5000/')
    except Exception:
        logger.exception('自动打开浏览器失败')

def check_project_files():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    required = ['templates/index.html', 'templates/instructions.html', 'static/js/ass-player.js', 'static/css/main.css']
    missing = [p for p in required if not os.path.exists(os.path.join(base_dir, p))]
    if missing:
        logger.error('项目文件缺失: %s', missing)
        return False
    return True


def main():
    logger.info('ASS 字幕播放器 - 启动中')
    logger.info('请先手动安装依赖: pip install -r requirements.txt')

    if not check_project_files():
        logger.error('项目文件不完整，请检查后再启动')
        return

    host = '127.0.0.1' if is_windows() else os.environ.get('ASS_PLAYER_HOST', '127.0.0.1')
    port = int(os.environ.get('ASS_PLAYER_PORT', 5000))

    threading.Timer(1.5, open_browser).start()

    try:
        app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        logger.info('服务已停止')
    except Exception:
        logger.exception('启动失败')

if __name__ == '__main__':
    main()
