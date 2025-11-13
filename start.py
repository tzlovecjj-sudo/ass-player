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
import sqlite3
import os

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
        # 在启动时创建并注入 SQLite 连接，供解析器使用（与 run.py 一致）
        db_path = os.path.join(os.path.dirname(__file__), 'ass_player', 'bilibili_cache.db')
        conn = None
        try:
            conn = sqlite3.connect(db_path, check_same_thread=False)
            cur = conn.cursor()
            cur.execute("""CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                url TEXT,
                ts REAL
            )""")
            conn.commit()
            logger.info('已初始化本地 SQLite 缓存（start.py）：%s', db_path)
            # 注入到全局解析器实例（如果存在）
            try:
                from app import _parser as _app_parser
                if _app_parser is not None:
                    _app_parser._disk_cache_conn = conn
                    setattr(_app_parser, '_owns_disk_conn', False)
                    try:
                        _app_parser._ensure_disk_cache()
                    except Exception:
                        logger.exception('初始化解析器磁盘缓存表时出错')
            except Exception:
                logger.exception('注入解析器连接时发生错误')
            app.run(host=host, port=port, debug=config.DEBUG, threaded=True, use_reloader=False)
        finally:
            try:
                if conn:
                    conn.close()
                    logger.info('已关闭本地 SQLite 缓存连接（start.py）')
            except Exception:
                logger.exception('关闭 SQLite 连接时发生异常')
    except KeyboardInterrupt:
        logger.info('服务已停止')
    except Exception:
        logger.exception('启动失败')

if __name__ == '__main__':
    main()

