import http.server
import socketserver
import os
import time
import threading

import pytest

try:
    from playwright.sync_api import sync_playwright
except Exception:
    pytest.skip('playwright not installed - skipping e2e tests', allow_module_level=True)


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


class SilentHandler(http.server.SimpleHTTPRequestHandler):
    # 静默的 HTTP 请求处理器，避免测试期间输出日志
    def log_message(self, format, *args):
        return


def run_static_server(port):
    # 在项目根目录上启动一个简单的静态文件服务器
    handler = SilentHandler
    os.chdir(ROOT)
    with socketserver.TCPServer(('127.0.0.1', port), handler) as httpd:
        httpd.serve_forever()


def _make_static_index():
    # 为测试创建一个静态的 index（把 Jinja 标签替换为静态路径）
    src_index = os.path.join(ROOT, 'templates', 'index.html')
    dst_index = os.path.join(ROOT, 'templates', 'index_static.html')
    try:
        with open(src_index, 'r', encoding='utf-8') as f:
            txt = f.read()
        
        txt = txt.replace("{{ url_for('static', filename='css/layout.css') }}", '/static/css/layout.css')
        txt = txt.replace("{{ url_for('static', filename='css/fullscreen.css') }}", '/static/css/fullscreen.css')
        txt = txt.replace("{{ url_for('static', filename='css/components.css') }}", '/static/css/components.css')
        txt = txt.replace("{{ url_for('static', filename='js/modules/main.js') }}", '/static/js/modules/main.js')
        with open(dst_index, 'w', encoding='utf-8') as f:
            f.write(txt)
    except Exception:
        # 忽略写入失败（例如文件不存在），测试会退回到原始 index.html
        pass


def _sample_canvas_pixel(page, x, y):
    # 读取 canvas 上某像素的 RGBA 值，x/y 可能是浮点数，向最近整数取样
    return page.evaluate(
        "(args)=>{const c=document.querySelector('#videoCanvas'); const ctx=c.getContext('2d'); const d=ctx.getImageData(Math.round(args.x), Math.round(args.y),1,1).data; return [d[0],d[1],d[2],d[3]];}",
        {"x": x, "y": y}
    )
    # 清除旧字幕并渲染 B 并再次计算 checksum（确保只渲染新定义的样式）
    page.evaluate('() => { if(window.player){ window.player.subtitles = []; } }')
    page.evaluate('(text)=>{ window.player.subtitleRenderer.parseASSFile(text); }', assB)
def _wait_for_nontransparent_pixel(page, timeout_ms=2000, step=20):
    # 轮询直到在 canvas 上发现非透明像素或超时（返回像素或 None）
    deadline = time.time() + (timeout_ms / 1000.0)
    w = page.evaluate('() => document.querySelector("#videoCanvas").width')
    h = page.evaluate('() => document.querySelector("#videoCanvas").height')
    if not w or not h:
        return None
    while time.time() < deadline:
        for yy in range(0, int(h), step):
            for xx in range(0, int(w), step):
                px = _sample_canvas_pixel(page, xx, yy)
                if sum(px[:3]) > 0 and px[3] > 0:
                    return px
        # 若未找到，等待下一帧再试
        page.wait_for_timeout(100)
    return None


def _canvas_grid_checksum(page, step=20):
    # 在浏览器端计算画布上按网格采样的像素值总和（RGBA 简单求和，作为快速 checksum）
    return page.evaluate(
        "(step)=>{const c=document.querySelector('#videoCanvas'); if(!c) return 0; const ctx=c.getContext('2d'); const w=c.width,h=c.height; let s=0; for(let y=0;y<h;y+=step){ for(let x=0;x<w;x+=step){ const d=ctx.getImageData(x,y,1,1).data; s += d[0]+d[1]+d[2]+d[3]; }} return s;}",
        step,
    )


def test_subtitle_canvas_basic_visibility():
    import http.server
    import socketserver
    import os
    import time
    import threading

    import pytest

    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        pytest.skip('playwright not installed - skipping e2e tests', allow_module_level=True)


    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


    class SilentHandler(http.server.SimpleHTTPRequestHandler):
        # 静默的 HTTP 请求处理器，避免测试期间输出日志
        def log_message(self, format, *args):
            return


    def run_static_server(port):
        # 在项目根目录上启动一个简单的静态文件服务器
        handler = SilentHandler
        os.chdir(ROOT)
        with socketserver.TCPServer(('127.0.0.1', port), handler) as httpd:
            httpd.serve_forever()


    def _make_static_index():
        # 为测试创建一个静态的 index（把 Jinja 标签替换为静态路径）
        src_index = os.path.join(ROOT, 'templates', 'index.html')
        dst_index = os.path.join(ROOT, 'templates', 'index_static.html')
        try:
            with open(src_index, 'r', encoding='utf-8') as f:
                txt = f.read()
            txt = txt.replace('window.ASS_PLAYER_CONFIG = {{ ASS_PLAYER_CONFIG | tojson | safe }};', 'window.ASS_PLAYER_CONFIG = {"REPORT_TIMEOUT_MS": 3000};')
            txt = txt.replace("{{ url_for('static', filename='css/main.css') }}", '/static/css/main.css')
            txt = txt.replace("{{ url_for('static', filename='css/layout.css') }}", '/static/css/layout.css')
            txt = txt.replace("{{ url_for('static', filename='css/fullscreen.css') }}", '/static/css/fullscreen.css')
            txt = txt.replace("{{ url_for('static', filename='css/components.css') }}", '/static/css/components.css')
            txt = txt.replace("{{ url_for('static', filename='js/modules/main.js') }}", '/static/js/modules/main.js')
            with open(dst_index, 'w', encoding='utf-8') as f:
                f.write(txt)
        except Exception:
            # 忽略写入失败（例如文件不存在），测试会退回到原始 index.html
            pass


    def _sample_canvas_pixel(page, x, y):
        # 读取 canvas 上某像素的 RGBA 值，x/y 可能是浮点数，向最近整数取样
        return page.evaluate(
            "(args)=>{const c=document.querySelector('#videoCanvas'); const ctx=c.getContext('2d'); const d=ctx.getImageData(Math.round(args.x), Math.round(args.y),1,1).data; return [d[0],d[1],d[2],d[3]];}",
            {"x": x, "y": y}
        )


    def _wait_for_nontransparent_pixel(page, timeout_ms=2000, step=20):
        # 轮询直到在 canvas 上发现非透明像素或超时（返回像素或 None）
        deadline = time.time() + (timeout_ms / 1000.0)
        w = page.evaluate('() => document.querySelector("#videoCanvas").width')
        h = page.evaluate('() => document.querySelector("#videoCanvas").height')
        if not w or not h:
            return None
        while time.time() < deadline:
            for yy in range(0, int(h), step):
                for xx in range(0, int(w), step):
                    px = _sample_canvas_pixel(page, xx, yy)
                    if sum(px[:3]) > 0 and px[3] > 0:
                        return px
            # 若未找到，等待下一帧再试
            page.wait_for_timeout(100)
        return None


    def _canvas_grid_checksum(page, step=20):
        # 在浏览器端计算画布上按网格采样的像素值总和（RGBA 简单求和，作为快速 checksum）
        return page.evaluate(
            "(step)=>{const c=document.querySelector('#videoCanvas'); if(!c) return 0; const ctx=c.getContext('2d'); const w=c.width,h=c.height; let s=0; for(let y=0;y<h;y+=step){ for(let x=0;x<w;x+=step){ const d=ctx.getImageData(x,y,1,1).data; s += d[0]+d[1]+d[2]+d[3]; }} return s;}",
            step,
        )


    def test_subtitle_canvas_basic_visibility():
        """测试：在渲染后，画布底部区域应包含非透明像素（字幕已绘制）。"""
        port = 8005
        _make_static_index()
        server_thread = threading.Thread(target=run_static_server, args=(port,), daemon=True)
        server_thread.start()
        time.sleep(0.3)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                from .artifacts import register_page
                register_page(page)
            except Exception:
                pass

            page_path = (
                f'http://127.0.0.1:{port}/templates/index_static.html'
                if os.path.exists(os.path.join(ROOT, 'templates', 'index_static.html'))
                else f'http://127.0.0.1:{port}/templates/index.html'
            )
            page.goto(page_path)
            page.wait_for_load_state('domcontentloaded')

            # 等待播放器初始化完毕
            page.wait_for_function('() => window.player && window.player.subtitleRenderer && window.player.videoCanvas')

            # 使用用户提供的较真实的 ASS 示例以验证渲染可见性
            real_ass = r"""[Script Info]
    ; This is an Advanced Sub Station Alpha v4+ script.
    Title: untitled
    ScriptType: v4.00+
    PlayDepth: 0
    ScaledBorderAndShadow: Yes
    PlayResX: 1920
    PlayResY: 1080
    WrapStyle: 3

    [V4+ Styles]
    Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    Style: Default,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,50,50,240,1
    Style: 中文字幕,Comic Sans MS,80,&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3.0,3.0,2,30,30,140,1
    Style: 英文大字幕,Comic Sans MS,100,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4.0,4.0,2,80,80,65,1
    Style: 中文大字幕,Comic Sans MS,70,&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2.0,2.0,2,10,10,12,1
    Style: 中文字幕 - 下移一行,Comic Sans MS,70,&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,40,1
    Style: Default 上移一行,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,10,10,300,1
    Style: Default_b32acc20-23f6-499b-911c-7696cbb22273,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,50,50,230,1
    Style: Default_5cda5f9a-398f-4cba-80d8-90949a3bd2f0,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,50,50,230,1
    Style: Default_a5ccc63d-ab01-4cd0-a127-4b60adfc0596,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,50,50,230,1
    Style: Default_cf258d9d-eedc-4a4b-b557-02bd0d1da70e,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,50,50,230,1
    Style: Default_edf62a90-a105-4938-b8a4-263df471ebcf,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,50,50,230,1

    [Events]
    Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    Dialogue: -10,0:00:00.06,0:00:00.16,Default,,0,0,0,,{\c&H00ff00&}On{\c} the Unstable SMP,
    Dialogue: 10,0:00:00.06,0:00:00.98,中文字幕,,0,0,0,,在不稳定SMP上，
    Dialogue: -10,0:00:00.16,0:00:00.30,Default,,0,0,0,,On {\c&H00ff00&}the{\c} Unstable SMP,
    Dialogue: -10,0:00:00.30,0:00:00.68,Default,,0,0,0,,On the {\c&H00ff00&}Unstable{\c} SMP,
    Dialogue: -10,0:00:00.68,0:00:00.98,Default,,0,0,0,,On the Unstable {\c&H00ff00&}SMP,
    Dialogue: 10,0:00:01.20,0:00:04.90,中文字幕,,0,0,0,,我们俩要迎战一千名玩家大军。
    Dialogue: -10,0:00:01.20,0:00:01.42,Default,,0,0,0,,{\c&H00ff00&}I'm{\c} about to fight an army of 1,000 players all at the same time,
    Dialogue: -10,0:00:01.42,0:00:01.56,Default,,0,0,0,,I'm {\c&H00ff00&}about{\c} to fight an army of 1,000 players all at the same time,
    Dialogue: -10,0:00:01.56,0:00:01.70,Default,,0,0,0,,I'm about {\c&H00ff00&}to{\c} fight an army of 1,000 players all at the same time,
    Dialogue: -10,0:00:01.70,0:00:01.86,Default,,0,0,0,,I'm about to {\c&H00ff00&}fight{\c} an army of 1,000 players all at the same time,
    Dialogue: -10,0:00:01.86,0:00:01.96,Default,,0,0,0,,I'm about to fight {\c&H00ff00&}an{\c} army of 1,000 players all at the same time,
    Dialogue: -10,0:00:01.96,0:00:02.20,Default,,0,0,0,,I'm about to fight an {\c&H00ff00&}army{\c} of 1,000 players all at the same time,
    Dialogue: -10,0:00:02.20,0:00:02.40,Default,,0,0,0,,I'm about to fight an army {\c&H00ff00&}of{\c} 1,000 players all at the same time,
    Dialogue: -10,0:00:02.40,0:00:02.52,Default,,0,0,0,,I'm about to fight an army of {\c&H00ff00&}1{\c},000 players all at the same time,
    Dialogue: -10,0:00:02.52,0:00:03.00,Default,,0,0,0,,I'm about to fight an army of 1{\c&H00ff00&},000{\c} players all at the same time,
    Dialogue: -10,0:00:03.00,0:00:03.36,Default,,0,0,0,,I'm about to fight an army of 1,000 {\c&H00ff00&}players{\c} all at the same time,
    Dialogue: -10,0:00:03.36,0:00:03.76,Default,,0,0,0,,I'm about to fight an army of 1,000 players {\c&H00ff00&}all{\c} at the same time,
    Dialogue: -10,0:00:03.76,0:00:04.08,Default,,0,0,0,,I'm about to fight an army of 1,000 players all {\c&H00ff00&}at{\c} the same time,
    Dialogue: -10,0:00:04.08,0:00:04.20,Default,,0,0,0,,I'm about to fight an army of 1,000 players all at {\c&H00ff00&}the{\c} same time,
    Dialogue: -10,0:00:04.20,0:00:04.36,Default,,0,0,0,,I'm about to fight an army of 1,000 players all at the same time,
    Dialogue: -10,0:00:04.36,0:00:04.48,Default,,0,0,0,,I'm about to fight an army of 1,000 players all at the {\c&H00ff00&}same{\c} time,
    Dialogue: -10,0:00:04.48,0:00:04.90,Default,,0,0,0,,I'm about to fight an army of 1,000 players all at the same {\c&H00ff00&}time,
    Dialogue: 10,0:00:05.00,0:00:07.78,中文字幕,,0,0,0,,我唯一的队友，竟是我的死对头，
    Dialogue: -10,0:00:05.00,0:00:05.14,Default,,0,0,0,,{\c&H00ff00&}with{\c} my only ally in the coming battle being my greatest rival,
    Dialogue: -10,0:00:05.14,0:00:05.16,Default,,0,0,0,,with my only ally in the coming battle being my greatest rival,
    Dialogue: -10,0:00:05.16,0:00:05.26,Default,,0,0,0,,with {\c&H00ff00&}my{\c} only ally in the coming battle being my greatest rival,
    Dialogue: -10,0:00:05.26,0:00:05.46,Default,,0,0,0,,with my {\c&H00ff00&}only{\c} ally in the coming battle being my greatest rival,
    Dialogue: -10,0:00:05.46,0:00:05.78,Default,,0,0,0,,with my only {\c&H00ff00&}ally{\c} in the coming battle being my greatest rival,
    Dialogue: -10,0:00:05.78,0:00:06.02,Default,,0,0,0,,with my only ally {\c&H00ff00&}in{\c} the coming battle being my greatest rival,
    Dialogue: -10,0:00:06.02,0:00:06.08,Default,,0,0,0,,with my only ally in {\c&H00ff00&}the{\c} coming battle being my greatest rival,
    Dialogue: -10,0:00:06.08,0:00:06.30,Default,,0,0,0,,with my only ally in the {\c&H00ff00&}coming{\c} battle being my greatest rival,
    Dialogue: -10,0:00:06.30,0:00:06.62,Default,,0,0,0,,with my only ally in the coming {\c&H00ff00&}battle{\c} being my greatest rival,
    Dialogue: -10,0:00:06.62,0:00:06.94,Default,,0,0,0,,with my only ally in the coming battle {\c&H00ff00&}being{\c} my greatest rival,
    Dialogue: -10,0:00:06.94,0:00:07.12,Default,,0,0,0,,with my only ally in the coming battle being {\c&H00ff00&}my{\c} greatest rival,
    Dialogue: -10,0:00:07.12,0:00:07.40,Default,,0,0,0,,with my only ally in the coming battle being my {\c&H00ff00&}greatest{\c} rival,
    Dialogue: -10,0:00:07.40,0:00:07.78,Default,,0,0,0,,with my only ally in the coming battle being my greatest {\c&H00ff00&}rival,
    Dialogue: 10,0:00:07.98,0:00:08.58,中文字幕,,0,0,0,,Flamefrags。
    Dialogue: -10,0:00:07.98,0:00:08.58,Default,,0,0,0,,{\c&H00ff00&}Flamefrags.
    """

            # helper: 将 ASS 的某个样式的 Outline 字段替换为新值（基于 [V4+ Styles] 的 Format 行解析）
            def replace_style_outline(ass_text: str, style_name: str, new_outline: str) -> str:
                lines = ass_text.splitlines()
                fmt_idx = None
                # 找到 Format 行，记录字段顺序
                for i, L in enumerate(lines):
                    if L.strip().startswith('Format:'):
                        fmt_fields = [f.strip() for f in L.split(':', 1)[1].split(',')]
                        try:
                            outline_idx = fmt_fields.index('Outline')
                        except ValueError:
                            return ass_text
                        fmt_idx = i
                        break
                if fmt_idx is None:
                    return ass_text

                for i, L in enumerate(lines):
                    if L.startswith('Style:') and L[len('Style:'):].lstrip().startswith(style_name + ','):
                        # 把 Style 行拆成固定数量的字段（len(fmt_fields)），避免多余逗号破坏
                        body = L.split(':', 1)[1]
                        parts = [p for p in body.split(',', len(fmt_fields)-1)]
                        if len(parts) == len(fmt_fields):
                            parts[outline_idx] = str(new_outline)
                            lines[i] = 'Style: ' + ','.join(parts)
                return '\n'.join(lines)

            # A: 原始真实字幕
            assA = real_ass
            # B: 修改 Default 的 outline
            assB = replace_style_outline(real_ass, 'Default', '8')

            # 把 ASS 注入页面并触发渲染循环（优先使用 startRendering）
            page.evaluate("(text)=>{ window.player.subtitleRenderer.parseASSFile(text); window.player.subtitles = window.player.subtitles || []; }", assA)
            # 确认页面已解析到字幕项
            subs_count = page.evaluate('() => (window.player && window.player.subtitles) ? window.player.subtitles.length : 0')
            assert subs_count > 0, 'ASS 未能解析为字幕事件，无法继续测试'

            page.wait_for_function('() => document.querySelector("#videoCanvas") && document.querySelector("#videoCanvas").width>0')
            page.evaluate('() => { try{ const v=window.player.videoPlayer; if(v){ v.currentTime=0; } } catch(e){}; if(window.player && window.player.startRendering){ window.player.startRendering(); } else { window.player.subtitleRenderer.renderVideoWithSubtitles(); } }')

            # 等待直到画布上出现非透明像素或超时
            px = _wait_for_nontransparent_pixel(page, timeout_ms=2000, step=20)

            browser.close()
            assert px is not None, '期待在字幕区域找到非透明像素，但画布看起来为空'


    def test_subtitle_styles_affect_pixels():
        """测试：改变轮廓宽度后，画布采样像素应不同（验证样式影响绘制）。"""
        port = 8006
        _make_static_index()
        server_thread = threading.Thread(target=run_static_server, args=(port,), daemon=True)
        server_thread.start()
        time.sleep(0.3)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                from .artifacts import register_page
                register_page(page)
            except Exception:
                pass
            page_path = f'http://127.0.0.1:{port}/templates/index_static.html'
            page.goto(page_path)
            page.wait_for_load_state('domcontentloaded')
            page.wait_for_function('() => window.player && window.player.subtitleRenderer')

            # 使用真实 ASS 作为基础
            real_ass = r"""[Script Info]
    ; This is an Advanced Sub Station Alpha v4+ script.
    Title: untitled
    ScriptType: v4.00+
    PlayDepth: 0
    ScaledBorderAndShadow: Yes
    PlayResX: 1920
    PlayResY: 1080
    WrapStyle: 3

    [V4+ Styles]
    Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    Style: Default,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,50,50,240,1
    Style: 中文字幕,Comic Sans MS,80,&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3.0,3.0,2,30,30,140,1
    Style: 英文大字幕,Comic Sans MS,100,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4.0,4.0,2,80,80,65,1
    Style: 中文大字幕,Comic Sans MS,70,&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2.0,2.0,2,10,10,12,1
    Style: 中文字幕 - 下移一行,Comic Sans MS,70,&H0000FFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,40,1
    Style: Default 上移一行,Comic Sans MS,80,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,3,2,10,10,300,1

    [Events]
    Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    Dialogue: -10,0:00:00.06,0:00:00.16,Default,,0,0,0,,{\c&H00ff00&}On{\c} the Unstable SMP,
    Dialogue: 10,0:00:00.06,0:00:00.98,中文字幕,,0,0,0,,在不稳定SMP上，
    Dialogue: -10,0:00:00.16,0:00:00.30,Default,,0,0,0,,On {\c&H00ff00&}the{\c} Unstable SMP,
    Dialogue: -10,0:00:00.30,0:00:00.68,Default,,0,0,0,,On the {\c&H00ff00&}Unstable{\c} SMP,
    Dialogue: -10,0:00:00.68,0:00:00.98,Default,,0,0,0,,On the Unstable {\c&H00ff00&}SMP,
    Dialogue: 10,0:00:01.20,0:00:04.90,中文字幕,,0,0,0,,我们俩要迎战一千名玩家大军。
    Dialogue: -10,0:00:01.20,0:00:01.42,Default,,0,0,0,,{\c&H00ff00&}I'm{\c} about to fight an army of 1,000 players all at the same time,
    """

            def replace_style_outline(ass_text: str, style_name: str, new_outline: str) -> str:
                lines = ass_text.splitlines()
                fmt_idx = None
                for i, L in enumerate(lines):
                    if L.strip().startswith('Format:'):
                        fmt_fields = [f.strip() for f in L.split(':', 1)[1].split(',')]
                        try:
                            outline_idx = fmt_fields.index('Outline')
                        except ValueError:
                            return ass_text
                        fmt_idx = i
                        break
                if fmt_idx is None:
                    return ass_text

                for i, L in enumerate(lines):
                    if L.startswith('Style:') and L[len('Style:'):].lstrip().startswith(style_name + ','):
                        body = L.split(':', 1)[1]
                        parts = [p for p in body.split(',', len(fmt_fields)-1)]
                        if len(parts) == len(fmt_fields):
                            parts[outline_idx] = str(new_outline)
                            lines[i] = 'Style: ' + ','.join(parts)
                return '\n'.join(lines)

            assA = real_ass
            assB = replace_style_outline(real_ass, 'Default', '8')

            # 渲染 A
            page.evaluate('(text)=>{ window.player.subtitleRenderer.parseASSFile(text); }', assA)
            page.evaluate('() => { if(window.player && window.player.startRendering){ window.player.startRendering(); } else { window.player.subtitleRenderer.renderVideoWithSubtitles(); } }')
            page.wait_for_timeout(500)

            subs_count = page.evaluate('() => (window.player && window.player.subtitles) ? window.player.subtitles.length : 0')
            assert subs_count > 0, 'ASS 未能解析为字幕事件，无法继续测试'

            pxA = _wait_for_nontransparent_pixel(page, timeout_ms=2000, step=20)
            assert pxA is not None, '期望第一次渲染能在画布上采样到非透明像素'
            checksumA = _canvas_grid_checksum(page, step=10)

            # 清空并渲染 B
            page.evaluate('() => { if(window.player){ window.player.subtitles = []; } }')
            page.evaluate('(text)=>{ window.player.subtitleRenderer.parseASSFile(text); }', assB)
            page.evaluate('() => { if(window.player && window.player.startRendering){ window.player.startRendering(); } else { window.player.subtitleRenderer.renderVideoWithSubtitles(); } }')
            page.wait_for_timeout(1000)
            pxB = _wait_for_nontransparent_pixel(page, timeout_ms=2000, step=20)
            assert pxB is not None, '期望第二次渲染能在画布上采样到非透明像素'
            checksumB = _canvas_grid_checksum(page, step=10)

            browser.close()

        assert checksumA and checksumB, '期望两次渲染都能在画布上采样到像素数据'
        assert checksumA != checksumB, f'期望不同的 outline 导致不同的画布校验和，得到相同: {checksumA}'
