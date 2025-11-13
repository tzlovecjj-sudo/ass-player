#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# 导入所需的标准库和第三方库
import os
import logging
import threading
import time
import re  # 导入正则表达式库
from flask import Flask, render_template, send_from_directory, request, jsonify

# 从 ass_player 模块导入 Bilibili 解析器
from ass_player.bilibili import BiliBiliParser

# 配置日志记录器
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# 获取当前文件所在目录的绝对路径
base_dir = os.path.dirname(os.path.abspath(__file__))
# 初始化 Flask 应用，并指定模板和静态文件目录
app = Flask(__name__, template_folder=os.path.join(base_dir, 'templates'), static_folder=os.path.join(base_dir, 'static'))

# 创建一个共享的 BiliBiliParser 实例，以便在多个请求之间复用 HTTP 会话，提高效率
_parser = BiliBiliParser()

# 使用字典在内存中实现简单的速率限制
# 键为客户端的 IP 地址，值为最后一次请求的时间戳
_last_request = {}
_RATE_LIMIT_SECONDS = 1  # 设置同一个客户端两次请求之间的最小时间间隔（秒）

# 定义根路由，用于渲染主页面
@app.route('/')
def index():
    """渲染播放器主页面"""
    return render_template('index.html')

# 定义使用说明页面的路由
@app.route('/instructions')
def instructions():
    """渲染使用说明页面"""
    return render_template('instructions.html')

# 定义代理配置页面的路由
@app.route('/proxy-setup')
def proxy_setup():
    """渲染代理配置说明页面"""
    return render_template('proxy-setup.html')

# 定义静态文件服务的路由
@app.route('/static/<path:filename>')
def static_files(filename):
    """提供静态文件（如 CSS, JavaScript）的访问"""
    return send_from_directory(app.static_folder, filename)

# 提供示例字幕文件访问（用于在线 Demo 默认加载）
@app.route('/ass_files/<path:filename>')
def ass_files(filename):
    """提供本地 ass_files 目录下的字幕文件访问"""
    ass_dir = os.path.join(base_dir, 'ass_files')
    return send_from_directory(ass_dir, filename)

# 定义网站图标的路由
@app.route('/favicon.ico')
def favicon():
    """提供网站图标 favicon.ico"""
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')

# 定义 API 路由，用于自动解析 Bilibili 视频链接
@app.route('/api/auto-parse')
def auto_parse():
    """
    接收来自客户端的 Bilibili 视频 URL，解析后返回真实的视频播放地址。
    此接口包含域名白名单和请求速率限制。
    """
    # 从请求参数中获取 'url'
    bilibili_url = request.args.get('url')
    if not bilibili_url:
        # 如果缺少 URL 参数，返回 400 错误
        return jsonify({'error': '缺少B站URL参数'}), 400

    # 检查传入的是否是独立的 BV 号，如果是，则自动转换为完整的 URL
    # 这样做可以确保后续的域名白名单检查能够正确工作
    bvid_match = re.fullmatch(r'BV[a-zA-Z0-9]{10}', bilibili_url)
    if bvid_match:
        bvid = bvid_match.group(0)
        bilibili_url = f"https://www.bilibili.com/video/{bvid}"
        logger.info("app.py: 检测到 BV 号，已自动转换为 URL: %s", bilibili_url)

    # 简单的域名白名单检查，确保只处理来自 bilibili.com 的链接
    if 'bilibili.com' not in bilibili_url:
        return jsonify({'success': False, 'error': '仅支持 bilibili.com 域名'}), 400

    # 对每个客户端 IP 地址进行速率限制
    remote = request.remote_addr or 'unknown'  # 获取客户端 IP
    now = time.time()  # 获取当前时间戳
    last = _last_request.get(remote, 0)  # 获取该 IP 的上次请求时间
    if now - last < _RATE_LIMIT_SECONDS:
        # 如果请求间隔过短，返回 429 错误
        return jsonify({'success': False, 'error': '请求过于频繁'}), 429
    _last_request[remote] = now  # 更新该 IP 的最后请求时间

    # 尝试解析视频链接
    try:
        logger.info('正在为 %s 解析 URL: %s', remote, bilibili_url)
        # 调用解析器获取真实的视频播放地址
        video_url = _parser.get_real_url(bilibili_url)
        if video_url:
            # 如果解析成功，检测视频质量并返回结果
            quality = _parser._detect_actual_quality(video_url) if hasattr(_parser, '_detect_actual_quality') else '未知'
            logger.info('解析成功: %s (清晰度: %s)', video_url, quality)
            return jsonify({'success': True, 'video_url': video_url, 'quality': quality, 'message': f'解析成功 ({quality})'})
        else:
            # 如果无法获取直链，返回 502 错误
            logger.warning('无法为 %s 获取视频直链', bilibili_url)
            return jsonify({'success': False, 'error': '无法获取视频直链', 'message': '请检查视频链接是否正确，或尝试其他视频'}), 502
    except Exception as e:
        # 如果解析过程中发生任何异常，记录日志并返回 500 错误
        logger.exception('解析 URL 时发生错误')
        return jsonify({'success': False, 'error': f'解析失败: {str(e)}', 'message': '解析过程中出现错误'}), 500

# 当该脚本作为主程序直接运行时，执行以下代码
if __name__ == '__main__':
    # 打印欢迎信息
    print('=' * 50)
    print('ASS字幕播放器 - Python本地服务')
    print('=' * 50)
    print('服务启动中...')
    print('访问地址: http://127.0.0.1:5000')
    print('按 Ctrl+C 停止服务')
    print('-' * 50)

    try:
        # 兼容 Zeabur 云平台和本地开发环境
        port = int(os.environ.get('PORT', os.environ.get('ASS_PLAYER_PORT', 8080)))
        host = os.environ.get('ASS_PLAYER_HOST', '0.0.0.0')

        # 仅本地开发时自动打开浏览器
        if host in ('127.0.0.1', 'localhost'):
            def _open_browser():
                time.sleep(1.5)
                try:
                    import webbrowser
                    webbrowser.open_new(f'http://{host}:{port}/')
                except Exception:
                    logger.exception('自动打开浏览器失败')
            threading.Timer(1.5, _open_browser).start()

        app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)
    except KeyboardInterrupt:
        print('\n服务已停止')
    except Exception as e:
        print(f'启动失败: {e}')
        input('按回车键退出...')
