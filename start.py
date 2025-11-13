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
from config import get_config
from cache_manager import setup_cache

# 获取配置
config = get_config()

# 设置缓存
setup_cache(enabled=config.CACHE_ENABLED, ttl=config.CACHE_TTL)
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

def is_windows():
    return platform.system().lower() == 'windows'

def open_browser():
    time.sleep(2)
    try:
        import webbrowser
        port = config.PORT if config.PORT else 8080
        webbrowser.open_new(f'http://{config.HOST}:{port}/')
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
    logger.info('配置环境: %s', os.environ.get('ASS_ENV', 'default'))
    logger.info('日志级别: %s', config.LOG_LEVEL)
    logger.info('缓存状态: %s', '启用' if config.CACHE_ENABLED else '禁用')
    if not check_project_files():
        logger.error('项目文件不完整，请检查后再启动')
        return

    host = config.HOST
    port = config.PORT
    threading.Timer(1.5, open_browser).start()

    try:
        app.run(host=host, port=port, debug=config.DEBUG, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        logger.info('服务已停止')
    except Exception:
        logger.exception('启动失败')

if __name__ == '__main__':
    main()

