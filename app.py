#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import logging
import threading
import time
from flask import Flask, render_template, send_from_directory, request, jsonify

from ass_player.bilibili import BiliBiliParser

# configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

base_dir = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=os.path.join(base_dir, 'templates'), static_folder=os.path.join(base_dir, 'static'))

# Shared parser instance to reuse HTTP session
_parser = BiliBiliParser()

# Simple in-memory rate limit: last request timestamp per remote_addr
_last_request = {}
_RATE_LIMIT_SECONDS = 1  # minimal interval per client

@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')

@app.route('/instructions')
def instructions():
    """使用说明页面"""
    return render_template('instructions.html')

@app.route('/proxy-setup')
def proxy_setup():
    """代理配置页面"""
    return render_template('proxy-setup.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    """静态文件服务"""
    return send_from_directory(app.static_folder, filename)

@app.route('/favicon.ico')
def favicon():
    """网站图标"""
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/api/auto-parse')
def auto_parse():
    """自动化解析B站视频，返回直链（受限于白名单/速率）"""
    bilibili_url = request.args.get('url')
    if not bilibili_url:
        return jsonify({'error': '缺少B站URL参数'}), 400

    # Basic domain whitelist
    if 'bilibili.com' not in bilibili_url:
        return jsonify({'success': False, 'error': '仅支持 bilibili.com 域名'}), 400

    # rate limiting per remote addr
    remote = request.remote_addr or 'unknown'
    now = time.time()
    last = _last_request.get(remote, 0)
    if now - last < _RATE_LIMIT_SECONDS:
        return jsonify({'success': False, 'error': '请求过于频繁'}), 429
    _last_request[remote] = now

    try:
        logger.info('Parsing request from %s: %s', remote, bilibili_url)
        video_url = _parser.get_real_url(bilibili_url)
        if video_url:
            quality = _parser._detect_actual_quality(video_url) if hasattr(_parser, '_detect_actual_quality') else '未知'
            logger.info('Parsed success: %s (%s)', video_url, quality)
            return jsonify({'success': True, 'video_url': video_url, 'quality': quality, 'message': f'解析成功 ({quality})'})
        else:
            logger.info('Unable to obtain direct video URL for %s', bilibili_url)
            return jsonify({'success': False, 'error': '无法获取视频直链', 'message': '请检查视频链接是否正确，或尝试其���视频'}), 502
    except Exception as e:
        logger.exception('解析失败')
        return jsonify({'success': False, 'error': f'解析失败: {str(e)}', 'message': '解析过程中出现错误'}), 500

# keep existing simple standalone run behavior for backward compatibility
if __name__ == '__main__':
    print('=' * 50)
    print('ASS字幕播放器 - Python本地服务')
    print('=' * 50)
    print('服务启动中...')
    print('访问地址: http://127.0.0.1:5000')
    print('按 Ctrl+C 停止服务')
    print('-' * 50)

    try:
        # 延迟后自动打开浏览器
        def _open_browser():
            time.sleep(1.5)
            try:
                import webbrowser
                webbrowser.open_new('http://127.0.0.1:5000/')
            except Exception:
                logger.exception('自动打开浏览器失败')

        threading.Timer(1.5, _open_browser).start()

        # 启动Flask应用
        app.run(host='127.0.0.1', port=5000, debug=False, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        print('\n服务已停止')
    except Exception as e:
        print(f'启动失败: {e}')
        input('按回车键退出...')
