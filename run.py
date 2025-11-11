#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清洁的启动脚本: 负责日志配置并启动 Flask 应用。推荐用于开发/部署。
"""
import os
import logging
from app import app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

def main():
    logging.info('Starting ASS Player (run.py)')
    host = os.environ.get('ASS_PLAYER_HOST', '127.0.0.1')
    port = int(os.environ.get('ASS_PLAYER_PORT', 5000))
    app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)

if __name__ == '__main__':
    main()