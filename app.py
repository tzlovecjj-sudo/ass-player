#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import webbrowser
import threading
import time
from flask import Flask, render_template, send_from_directory

app = Flask(__name__)

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
    return send_from_directory('static', filename)

@app.route('/favicon.ico')
def favicon():
    """网站图标"""
    return send_from_directory('static', 'favicon.ico', mimetype='image/vnd.microsoft.icon')

def open_browser():
    """自动打开浏览器"""
    time.sleep(2)  # 确保服务完全启动
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    print("=" * 50)
    print("ASS字幕播放器 - Python本地服务")
    print("=" * 50)
    print("服务启动中...")
    print("访问地址: http://127.0.0.1:5000")
    print("按 Ctrl+C 停止服务")
    print("-" * 50)
    
    try:
        # 延迟后自动打开浏览器
        threading.Timer(1.5, open_browser).start()
        
        # 启动Flask应用
        app.run(
            host='127.0.0.1',
            port=5000,
            debug=False,
            threaded=True,
            use_reloader=False  # 禁用重载器，避免重复打开浏览器
        )
    except KeyboardInterrupt:
        print("\n服务已停止")
    except Exception as e:
        print(f"启动失败: {e}")
        input("按回车键退出...")