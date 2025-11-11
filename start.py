#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import webbrowser
import threading
import time
import subprocess
import platform
import urllib.parse
import hashlib
import json
import re

# 强制设置标准输出编码为UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def is_windows():
    return platform.system().lower() == 'windows'

def check_environment():
    """检查Python环境和依赖"""
    missing_modules = []
    
    # 检查Flask
    try:
        import flask
    except ImportError:
        missing_modules.append('flask')
    
    # 检查requests
    try:
        import requests
    except ImportError:
        missing_modules.append('requests')
    
    return missing_modules

def install_dependencies(missing_modules):
    """安装缺失的依赖"""
    print("正在安装缺失的依赖...")
    try:
        # 安装所有缺失的模块
        for module in missing_modules:
            print(f"正在安装 {module}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", module])
        
        print("所有依赖安装成功！")
        return True
    except subprocess.CalledProcessError as e:
        print(f"安装失败: {e}")
        return False

def check_project_files():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    required_dirs = ['templates', 'static/css', 'static/js']
    for dir_name in required_dirs:
        dir_path = os.path.join(base_dir, dir_name)
        if not os.path.exists(dir_path):
            print(f"错误: 目录不存在 - {dir_path}")
            return False
    
    required_files = [
        'templates/index.html',
        'static/js/ass-player.js',
        'static/css/main.css'
    ]
    
    for file_name in required_files:
        file_path = os.path.join(base_dir, file_name)
        if not os.path.exists(file_path):
            print(f"错误: 文件不存在 - {file_path}")
            return False
    
    return True

def open_browser():
    time.sleep(2)
    print("正在打开浏览器...")
    try:
        webbrowser.open_new('http://127.0.0.1:5000/')
    except Exception as e:
        print(f"自动打开浏览器失败: {e}")
        print("请手动访问: http://127.0.0.1:5000")

def is_valid_video_url(url):
    """检查URL是否是有效的视频URL"""
    if not url or not isinstance(url, str):
        return False
    
    # 常见的B站视频CDN域名
    bilibili_cdn_patterns = [
        r'upos-sz-[^.]+\.bilivideo\.com',
        r'cn-[^.]+\.bilivideo\.com',
        r'xy[0-9]+x[0-9]+\.bilivideo\.com',
        r'cn-sh[^.]+\.bilivideo\.com',
        r'cn-gd[^.]+\.bilivideo\.com',
        r'bilivideo\.com/upgcxcode',
    ]
    
    # 其他视频平台和通用视频格式
    video_patterns = [
        r'\.(mp4|webm|ogg|mov|mkv|avi|wmv|flv|m4v)(\?.*)?$',
        r'\.m3u8',
        r'googlevideo\.com',
        r'akamaized\.net',
        r'bcbolb\.com',
    ]
    
    import re
    all_patterns = bilibili_cdn_patterns + video_patterns
    
    for pattern in all_patterns:
        if re.search(pattern, url, re.IGNORECASE):
            return True
    
    return False

def extract_play_url_info(text):
    """从HTML中提取playUrlInfo - 基于开源项目代码"""
    pattern = r'"playUrlInfo"\s*:\s*\[\s*{.*?}\s*\]'
    match = re.search(pattern, text, re.DOTALL)

    if match:
        json_str = "{" + match.group(0) + "}"
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            corrected = re.sub(r"\\u002F", "/", json_str)
            return json.loads(corrected)
    return None

class BiliBiliParser:
    """B站视频解析器 - 专注于获取高质量720P"""
    
    def __init__(self):
        import requests
        self.session = requests.Session()
        
        # 使用移动端User-Agent
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
        })
    
    def get_real_url(self, url):
        """获取真实地址 - 专注于获取高质量720P"""
        try:
            print("开始解析B站视频，目标：高质量720P...")
            
            # 验证URL
            if 'bilibili.com' not in url:
                print('URL格式错误')
                return None
            
            # 方法1: 直接获取720P MP4格式（最稳定）
            print("方法1: 获取720P MP4格式...")
            mp4_720p_url = self._get_720p_mp4(url)
            if mp4_720p_url:
                return mp4_720p_url
            
            # 发送请求获取HTML
            response = self.session.get(url, timeout=10)
            html = response.text
            
            # 方法2: 查找playUrlInfo
            print("方法2: 查找playUrlInfo...")
            play_url_info = extract_play_url_info(html)
            if play_url_info and 'playUrlInfo' in play_url_info:
                video_url = play_url_info['playUrlInfo'][0]['url']
                if is_valid_video_url(video_url):
                    quality = self._detect_actual_quality(video_url)
                    print(f"通过playUrlInfo找到视频地址 (实际质量: {quality}): {video_url}")
                    return video_url
            
            # 方法3: 查找window.__playinfo__，专注于720P
            print("方法3: 查找window.__playinfo__，寻找720P...")
            playinfo_pattern = r'window\.__playinfo__\s*=\s*({.+?})\s*</script>'
            match = re.search(playinfo_pattern, html, re.DOTALL)
            if match:
                playinfo_json = match.group(1)
                try:
                    playinfo = json.loads(playinfo_json)
                    # 专门寻找720P视频
                    video_url = self._extract_720p_from_playinfo(playinfo)
                    if video_url:
                        return video_url
                except json.JSONDecodeError as e:
                    print(f"解析__playinfo__失败: {e}")
            
            # 方法4: 直接正则匹配MP4视频URL
            print("方法4: 直接正则匹配MP4视频URL...")
            mp4_url = self._find_mp4_in_html(html)
            if mp4_url:
                return mp4_url
            
            print("所有解析方法均失败")
            return None
            
        except Exception as e:
            print(f"解析过程中出现异常: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _get_720p_mp4(self, url):
        """专门获取720P MP4格式"""
        try:
            # 提取BV号
            bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', url)
            if not bvid_match:
                return None
            
            bvid = bvid_match.group(0)
            print(f"提取到BV号: {bvid}")
            
            # 获取视频信息
            api_url = "https://api.bilibili.com/x/web-interface/view"
            params = {"bvid": bvid}
            
            response = self.session.get(api_url, params=params, timeout=10)
            data = response.json()
            
            if data.get("code") == 0:
                video_data = data["data"]
                cid = video_data["cid"]
                title = video_data["title"]
                
                print(f"视频标题: {title}")
                print(f"分P CID: {cid}")
                
                # 使用HTML5参数获取720P MP4
                play_url = "https://api.bilibili.com/x/player/playurl"
                params = {
                    "bvid": bvid,
                    "cid": cid,
                    "qn": 64,  # 720P
                    "fnval": 0,  # 不使用DASH格式
                    "fourk": 1,
                    "platform": "html5"
                }
                
                response = self.session.get(play_url, params=params, timeout=10)
                play_data = response.json()
                
                if play_data.get("code") == 0:
                    if "durl" in play_data["data"]:
                        video_url = play_data["data"]["durl"][0]["url"]
                        if is_valid_video_url(video_url) and '.mp4' in video_url:
                            actual_quality = self._detect_actual_quality(video_url)
                            print(f"成功获取MP4格式 (实际质量: {actual_quality}): {video_url}")
                            return video_url
            
            return None
            
        except Exception as e:
            print(f"720P MP4解析失败: {e}")
            return None
    
    def _extract_720p_from_playinfo(self, playinfo):
        """从playinfo中专门提取720P视频"""
        try:
            if 'data' not in playinfo:
                return None
            
            # 优先查找720P视频 (id=64)
            if 'dash' in playinfo['data']:
                video_list = playinfo['data']['dash']['video']
                # 查找720P视频
                for video in video_list:
                    if video.get("id") == 64:  # 720P
                        video_url = video['baseUrl']
                        if is_valid_video_url(video_url):
                            actual_quality = self._detect_actual_quality(video_url)
                            print(f"找到720P视频 (实际质量: {actual_quality}): {video_url}")
                            return video_url
            
            # 如果没有720P，查找最高质量的视频
            if 'dash' in playinfo['data']:
                video_list = playinfo['data']['dash']['video']
                # 按质量降序排列
                video_list.sort(key=lambda x: x.get("id", 0), reverse=True)
                
                # 获取最高质量的视频
                if video_list:
                    video_url = video_list[0]['baseUrl']
                    if is_valid_video_url(video_url):
                        requested_quality = self._get_quality_name(video_list[0].get("id", 0))
                        actual_quality = self._detect_actual_quality(video_url)
                        print(f"找到最高质量视频 (请求: {requested_quality}, 实际: {actual_quality}): {video_url}")
                        return video_url
            
            # 查找durl格式
            if 'durl' in playinfo['data']:
                durls = playinfo['data']['durl']
                if durls:
                    video_url = durls[0]['url']
                    if is_valid_video_url(video_url):
                        actual_quality = self._detect_actual_quality(video_url)
                        print(f"通过durl找到视频地址 (实际质量: {actual_quality}): {video_url}")
                        return video_url
            
            return None
        except Exception as e:
            print(f"提取720P失败: {e}")
            return None
    
    def _find_mp4_in_html(self, html):
        """在HTML中查找MP4视频URL"""
        url_patterns = [
            r'https://[^"\']+\.mp4[^"\']*',
            r'"url":"(https://[^"]+\.mp4[^"]*)"',
            r'video_url["\']?:\s*["\'](https://[^"\']+\.mp4[^"\']*)["\']',
        ]
        
        for pattern in url_patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                if is_valid_video_url(match):
                    actual_quality = self._detect_actual_quality(match)
                    print(f"通过正则表达式找到MP4视频地址 (实际质量: {actual_quality}): {match}")
                    return match
        
        return None
    
    def _detect_actual_quality(self, url):
        """根据URL特征检测实际视频质量"""
        # 根据URL中的特征判断质量
        if '-192.mp4' in url or 'bw=1737943' in url:
            return "720P"  # 根据你的测试，192.mp4实际上是720P
        elif '-80.m4s' in url or '30080' in url:
            return "1080P"
        elif '-64.m4s' in url or '30064' in url:
            return "720P" 
        elif '-32.m4s' in url or '30032' in url:
            return "480P"
        elif '-16.m4s' in url:
            return "360P"
        else:
            return "未知"
    
    def _get_quality_name(self, quality_id):
        """获取质量名称"""
        quality_map = {
            120: "4K",
            116: "1080P60",
            112: "1080P+", 
            80: "1080P",
            64: "720P",
            32: "480P",
            16: "360P"
        }
        return quality_map.get(quality_id, f"质量{quality_id}")

def parse_bilibili_video(bilibili_url):
    """主解析函数"""
    parser = BiliBiliParser()
    return parser.get_real_url(bilibili_url)

def create_app():
    """创建Flask应用"""
    from flask import Flask, render_template, send_from_directory, request, jsonify
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    app = Flask(__name__, 
                template_folder=os.path.join(base_dir, 'templates'),
                static_folder=os.path.join(base_dir, 'static'))
    
    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/instructions')
    def instructions():
        return render_template('instructions.html')
    
    @app.route('/static/<path:filename>')
    def static_files(filename):
        return send_from_directory(app.static_folder, filename)
    
    @app.route('/favicon.ico')
    def favicon():
        return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')
    
    # 自动化解析API
    @app.route('/api/auto-parse')
    def auto_parse():
        """自动化解析B站视频"""
        bilibili_url = request.args.get('url')
        if not bilibili_url:
            return jsonify({'error': '缺少B站URL参数'}), 400
        
        try:
            print(f"开始解析: {bilibili_url}")
            
            # 使用核心解析方法
            video_url = parse_bilibili_video(bilibili_url)
            
            if video_url and is_valid_video_url(video_url):
                actual_quality = BiliBiliParser()._detect_actual_quality(video_url)
                print(f"解析成功! 实际质量: {actual_quality}")
                print(f"最终视频地址: {video_url}")
                return jsonify({
                    'success': True,
                    'video_url': video_url,
                    'quality': actual_quality,
                    'message': f'解析成功 ({actual_quality})'
                })
            else:
                print("无法获取有效的视频直链")
                return jsonify({
                    'success': False,
                    'error': '无法获取视频直链',
                    'message': '请检查视频链接是否正确，或尝试其他视频'
                })
                
        except Exception as e:
            print(f"解析失败: {e}")
            return jsonify({
                'success': False,
                'error': f'解析失败: {str(e)}',
                'message': '解析过程中出现错误'
            }), 500
    
    return app

def main():
    print("=" * 60)
    print("           ASS字幕播放器 - 高质量720P解析版")
    print("=" * 60)
    print("特点: 专注于获取高质量720P视频")
    print("说明: 未登录状态下B站通常限制最高720P")
    print("策略: 直接获取720P MP4格式，避免虚假1080P")
    print("=" * 60)
    
    system = platform.system()
    print(f"检测到系统: {system}")
    
    # 检查环境
    missing_modules = check_environment()
    if missing_modules:
        print(f"检测到缺少依赖: {', '.join(missing_modules)}")
        if not install_dependencies(missing_modules):
            print("\n依赖安装失败！")
            print("请手动运行以下命令安装依赖:")
            print("   pip install flask requests")
            input("按回车键退出...")
            return
        print("依赖安装成功！")
    else:
        print("所有依赖已安装")
    
    if not check_project_files():
        print("\n项目文件不完整，请确保以下文件存在:")
        print("  templates/index.html")
        print("  templates/instructions.html") 
        print("  static/css/main.css")
        print("  static/js/ass-player.js")
        input("按回车键退出...")
        return
    
    print("环境检查通过！")
    print("\n启动信息:")
    print("  服务地址: http://127.0.0.1:5000")
    print("  自动化解析: http://127.0.0.1:5000/api/auto-parse")
    print("  解析目标: 高质量720P，无需Cookie")
    print("  质量说明: 未登录状态最高720P，显示实际质量")
    print("  按 Ctrl+C 停止服务")
    print("-" * 60)
    print("启动服务中...")
    
    try:
        # 创建应用
        app = create_app()
        
        threading.Timer(1.5, open_browser).start()
        
        host = '127.0.0.1' if is_windows() else '0.0.0.0'
        
        app.run(
            host=host,
            port=5000,
            debug=False,
            use_reloader=False
        )
        
    except KeyboardInterrupt:
        print("\n\n服务已停止")
    except Exception as e:
        print(f"\n启动失败: {e}")
        input("按回车键退出...")

if __name__ == '__main__':
    main()