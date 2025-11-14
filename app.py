#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# 导入所需的标准库和第三方库
import os
import logging
import threading
import time
import re  # 导入正则表达式库
import requests  # 用于后端代理视频流
from flask import Flask, render_template, send_from_directory, request, jsonify, Response

# 从 ass_player 模块导入 Bilibili 解析器
from ass_player.bilibili import BiliBiliParser
from config import get_config

# 配置日志记录器
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# 获取当前文件所在目录的绝对路径
base_dir = os.path.dirname(os.path.abspath(__file__))
# 初始化 Flask 应用，并指定模板和静态文件目录
app = Flask(__name__, template_folder=os.path.join(base_dir, 'templates'), static_folder=os.path.join(base_dir, 'static'))

# 创建一个共享的 BiliBiliParser 实例，以便在多个请求之间复用 HTTP 会话，提高效率
_parser = BiliBiliParser()

# 之前实现过基于内存的速率限制（已移除）——保留注释以便审计

# 定义根路由，用于渲染主页面
@app.route('/')
def index():
    """渲染播放器主页面"""
    cfg = get_config()
    # 将需要的前端配置注入模板（只包含安全可公开的配置项）
    public_cfg = {
        'REPORT_TIMEOUT_MS': getattr(cfg, 'REPORT_TIMEOUT_MS', 3000),
    }
    return render_template('index.html', ASS_PLAYER_CONFIG=public_cfg)

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

    # 速率限制已移除：允许客户端多次请求而不返回 429（如需限流可在外部代理/网关实现）

    # 检测访问来源
    host_header = request.host or ''
    is_local = host_header.startswith('127.0.0.1') or host_header.startswith('localhost')

    try:
        remote = request.remote_addr or 'unknown'
        logger.info('正在为 %s 解析 URL: %s', remote, bilibili_url)
        # 调用解析器获取真实的视频播放地址
        video_url = _parser.get_real_url(bilibili_url)
        if video_url:
            quality = _parser._detect_actual_quality(video_url) if hasattr(_parser, '_detect_actual_quality') else '未知'
            logger.info('解析成功: %s (清晰度: %s)', video_url, quality)
            # 无论本地还是域名访问，都返回 download_url（便于前端直接触发下载或展示链接）
            # 注意：不再尝试获取或返回远端文件大小（Content-Length），以免在本地解析时阻塞。
            resp = {
                'success': True,
                'video_url': video_url,
                'quality': quality,
                'download_url': video_url,
                'message': f'解析成功 ({quality})'
            }
            return jsonify(resp)
        else:
            logger.warning('无法为 %s 获取视频直链', bilibili_url)
            return jsonify({'success': False, 'error': '无法获取视频直链', 'message': '请检查视频链接是否正确，或尝试其他视频'}), 502
    except Exception as e:
        logger.exception('解析 URL 时发生错误')
        return jsonify({'success': False, 'error': f'解析失败: {str(e)}', 'message': '解析过程中出现错误'}), 500


@app.route('/api/report-cdn', methods=['POST'])
def report_cdn():
    """前端上报 CDN 加载耗时（由前端测量并上报）。

    接受 JSON: { hostname: str, load_ms: int, is_china?: bool }
    """
    try:
        data = request.get_json(silent=True) or {}
        hostname = data.get('hostname')
        load_ms = data.get('load_ms')
        is_china = data.get('is_china', None)

        if not hostname or load_ms is None:
            return jsonify({'success': False, 'error': 'invalid payload'}), 400

        # 简单范围校验
        try:
            load_val = float(load_ms)
        except Exception:
            return jsonify({'success': False, 'error': 'load_ms must be numeric'}), 400
        if load_val < 0 or load_val > 60000:
            return jsonify({'success': False, 'error': 'load_ms out of range'}), 400

        # 如果解析器存在，则更新其 CDN 缓存统计
        try:
            if hasattr(app, '_parser') and app._parser is not None:
                if is_china is not None:
                    try:
                        app._parser.mark_cdn_hostname(hostname, bool(is_china))
                    except Exception:
                        logger.debug('标记 CDN 主机时发生异常')
                try:
                    app._parser.record_cdn_load(hostname, float(load_val))
                except Exception:
                    logger.debug('记录 CDN 加载耗时时发生异常')
        except Exception:
            logger.exception('在处理 CDN 上报时解析器调用失败')

        return jsonify({'success': True}), 200
    except Exception:
        logger.exception('处理 /api/report-cdn 请求时发生异常')
        return jsonify({'success': False, 'error': 'internal error'}), 500


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
