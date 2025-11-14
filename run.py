#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清洁的启动脚本: 负责日志配置并启动 Flask 应用。推荐用于开发/部署。
"""
import os
import logging
import sqlite3
from app import app
from config import get_config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

def main():
    logging.info('Starting ASS Player (run.py)')
    cfg = get_config()
    host = cfg.HOST
    port = cfg.PORT
    # 在应用启动时创建并注入 SQLite 本地磁盘缓存连接（由应用负责打开/关闭）
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
            # 同步创建 CDN 统计表以便解析器持久化 cdn_stats（如果使用 run.py 注入连接）
            cur.execute("""CREATE TABLE IF NOT EXISTS cdn_stats (
                hostname TEXT PRIMARY KEY,
                is_china INTEGER,
                count INTEGER,
                avg_load REAL,
                updated_ts REAL
            )""")
        conn.commit()
        logging.info('已初始化本地 SQLite 缓存：%s', db_path)

        # 如果 app 模块已创建解析器实例，则注入连接
        try:
            if hasattr(app, '_parser') and getattr(app, '_parser', None) is not None:
                try:
                    app._parser._disk_cache_conn = conn
                    # 标记解析器不负责关闭连接（由 run.py 管理）
                    setattr(app._parser, '_owns_disk_conn', False)
                    # 触发解析器表初始化标志
                    try:
                        app._parser._ensure_disk_cache()
                    except Exception:
                        logging.exception('注入磁盘缓存连接并初始化表时发生错误')
                except Exception:
                    logging.exception('将磁盘缓存连接注入解析器时发生错误')
        except Exception:
            logging.exception('尝试注入解析器连接时发生错误')

        app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)
    finally:
        # 在退出时关闭连接（如果我们创建了它）
        try:
            if conn:
                conn.close()
                logging.info('已关闭本地 SQLite 缓存连接')
        except Exception:
            logging.exception('关闭 SQLite 连接时发生异常')

if __name__ == '__main__':
    main()