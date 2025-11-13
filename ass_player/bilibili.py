"""
BiliBiliParser 模块，从旧的 start.py 中重构而来。

该模块提供了一个专门用于解析 Bilibili 视频链接的类 BiliBiliParser。
它封装了多种解析策略，支持请求会话复用、自动重试和更完善的错误处理机制，
旨在稳定、高效地获取 Bilibili 视频的真实播放地址。
"""
# 导入标准库
import re
import json
import logging
import ipaddress
import socket
from typing import Optional
from urllib.parse import urlparse as urllib_parse  # 使用 urllib.parse 进行 URL 解析，减少对重型库的依赖
from urllib.parse import parse_qsl, urlencode, urlunparse
import time
import sqlite3

# 导入第三方库
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 初始化日志记录器
logger = logging.getLogger(__name__)

def _is_private_host(hostname: str) -> bool:
    """
    检查给定的主机名是否解析为私有、环回或保留 IP 地址。
    这是为了防止服务器端请求伪造（SSRF）攻击。

    :param hostname: 需要检查的主机名。
    :return: 如果主机名解析为私有地址，则返回 True，否则返回 False。
    """
    try:
        # 解析主机名到 IP 地址列表（一个主机名可能对应多个 IP）
        for res in socket.getaddrinfo(hostname, None):
            ip_str = res[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            # 检查 IP 地址是否为私有、环回或保留地址
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved:
                logger.warning("检测到私有主机名: %s -> %s", hostname, ip_str)
                return True
    except Exception:
        # 如果 DNS 解析失败，我们假设它不是私有地址，以避免误报
        logger.debug("主机名 %s 的 DNS 解析失败", hostname)
    return False

class BiliBiliParser:
    """
    Bilibili 视频解析器。

    该类封装了获取 Bilibili 视频真实播放链接的逻辑，主要目标是获取 720P 清晰度的 MP4 格式链接。
    它通过一个共享的 requests.Session 实例来管理网络请求，实现了连接复用和自动重试。

    使用示例:
        parser = BiliBiliParser()
        video_url = parser.get_real_url("https://www.bilibili.com/video/BV1...")
    """

    def __init__(self, session: Optional[requests.Session] = None, timeout: int = 10, cache_path: Optional[str] = None):
        """
        初始化 BiliBiliParser。

        :param session: 可选的 requests.Session 对象。如果未提供，将创建一个新的会话。
        :param timeout: 网络请求的默认超时时间（秒）。
        :param cache_path: 本地磁盘缓存文件路径（如 None 则默认 'bilibili_cache.db'）。
        """
        if session is None:
            # 如果没有提供 session，则创建一个新的
            session = requests.Session()
            # 配置重试逻辑：总共重试 3 次，退避因子为 0.5，对特定状态码进行重试
            retries = Retry(total=3, backoff_factor=0.5, status_forcelist=(429, 502, 503, 504))
            adapter = HTTPAdapter(max_retries=retries)
            # 为 HTTP 和 HTTPS 协议挂载适配器
            session.mount("https://", adapter)
            session.mount("http://", adapter)
        
        self.session = session
        self.timeout = timeout
        # 缓存解析到的资源大小，key 为最终可用的 URL，value 为整数字节数
        self._content_length_cache = {}

        # 新增：缓存“BV号/URL -> 直链”，避免重复解析（简单 LRU，最大 100 条）
        from collections import OrderedDict
        self._url_cache = OrderedDict()
        self._url_cache_max = 100

        # 本地磁盘缓存（SQLite，懒加载），适合单实例短期持久化
        import os
        if cache_path is None:
            cache_path = os.path.join(os.path.dirname(__file__), 'bilibili_cache.db')
        # sqlite 文件路径
        self._disk_cache_path = cache_path
        # SQLite 连接（懒打开）
        self._disk_cache_conn = None
        # 磁盘缓存 TTL（秒），默认 30 分钟
        self._disk_cache_ttl = 1800
        # 缓存表名
        self._disk_cache_table = 'cache'

        # 设置默认的请求头，模拟移动端浏览器访问
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9',
        })

    def get_real_url(self, url: str) -> Optional[str]:
        """
        获取 Bilibili 视频的真实播放链接。

        这是解析器的主入口方法，它会按顺序尝试多种策略来获取视频链接。
        :param url: Bilibili 视频页面的 URL 或 BV 号。
        :return: 成功时返回视频的真实 URL，否则返回 None。
        """
        url_for_log = url
        try:
            logger.info("开始解析 Bilibili URL 或 BV 号: %s", url_for_log)

            # 如果输入的是 BV 号，先转换为完整的 URL
            bvid_match = re.fullmatch(r'BV[a-zA-Z0-9]{10}', url_for_log)
            if bvid_match:
                bvid = bvid_match.group(0)
                url = f"https://www.bilibili.com/video/{bvid}"
                url_for_log = url
                logger.info("检测到 BV 号，已转换为 URL: %s", url_for_log)
            
            # 对 URL 进行基本验证
            if not url or 'bilibili.com' not in url:
                logger.warning("输入内容不是有效的 Bilibili URL 或 BV 号: %s", url_for_log)
                return None

            # 新增：缓存查找，key 用 BV号或URL
            cache_key = None
            bvid_match2 = re.search(r'BV[a-zA-Z0-9]{10}', url)
            if bvid_match2:
                cache_key = bvid_match2.group(0)
            else:
                cache_key = url
            # 先查内存缓存
            if cache_key in self._url_cache:
                logger.info("命中解析缓存: %s -> %s", cache_key, self._url_cache[cache_key])
                # LRU: 移到末尾
                self._url_cache.move_to_end(cache_key)
                return self._url_cache[cache_key]

            # 再查本地磁盘缓存（带过期时间）
            disk_hit = False
            try:
                v = self._get_disk_cache(cache_key)
                if v and isinstance(v, dict) and 'url' in v and 'ts' in v:
                    if time.time() - v['ts'] < self._disk_cache_ttl:
                        logger.info('命中本地磁盘缓存: %s -> %s', cache_key, v['url'])
                        # 写入内存缓存
                        self._url_cache[cache_key] = v['url']
                        if len(self._url_cache) > self._url_cache_max:
                            self._url_cache.popitem(last=False)
                        disk_hit = True
                        return v['url']
                    else:
                        # 过期，删除
                        self._del_disk_cache(cache_key)
            except Exception as e:
                logger.warning('读取本地磁盘缓存异常: %s', e)
            # --- 解析策略优化 ---
            # 1. 优先官方 API（最快、最稳定）
            mp4_url = self._get_720p_mp4(url)
            if mp4_url:
                real_url = self._try_convert_cdn_url(mp4_url)
                # 写入内存缓存
                self._url_cache[cache_key] = real_url
                try:
                    self._set_disk_cache(cache_key, real_url)
                except Exception as e:
                    logger.warning('写入本地磁盘缓存异常: %s', e)
                if len(self._url_cache) > self._url_cache_max:
                    self._url_cache.popitem(last=False)
                return real_url
            html = ''
            try:
                resp = self.session.get(url, timeout=self.timeout)
                html = resp.text
            except Exception as e:
                logger.warning('请求页面 HTML 失败: %s', e)
                html = ''

            playinfo = self._extract_playinfo_from_html(html)
            if playinfo:
                video_url = self._extract_720p_from_playinfo(playinfo)
                if video_url:
                    real_url = self._try_convert_cdn_url(video_url)
                    self._url_cache[cache_key] = real_url
                    try:
                        self._set_disk_cache(cache_key, real_url)
                    except Exception as e:
                        logger.warning('写入本地磁盘缓存异常: %s', e)
                    if len(self._url_cache) > self._url_cache_max:
                        self._url_cache.popitem(last=False)
                    return real_url

            # 3. 最后兜底：正则暴力搜索 MP4 链接
            mp4_url = self._find_mp4_in_html(html)
            if mp4_url:
                real_url = self._try_convert_cdn_url(mp4_url)
                self._url_cache[cache_key] = real_url
                try:
                    self._set_disk_cache(cache_key, real_url)
                except Exception as e:
                    logger.warning('写入本地磁盘缓存异常: %s', e)
                if len(self._url_cache) > self._url_cache_max:
                    self._url_cache.popitem(last=False)
                return real_url

            logger.warning("所有解析策略均失败，无法为 %s 获取视频链接", url)
            return None
        except Exception as ex:
            # 捕获 get_real_url 中的任何未处理异常，记录并返回 None
            try:
                logger.exception("解析 %s 时发生未知异常: %s", url_for_log, ex)
            except Exception:
                logger.exception("解析时发生未知异常（无法记录 URL）")
            return None

    def __del__(self):
        try:
            if getattr(self, '_disk_cache_conn', None):
                try:
                    self._disk_cache_conn.close()
                except Exception:
                    pass
        except Exception:
            pass

    def _ensure_disk_cache(self):
        """
        确保 SQLite 连接已打开并且表已初始化（懒加载）。
        """
        if getattr(self, '_disk_cache_conn', None):
            return
        try:
            conn = sqlite3.connect(self._disk_cache_path, check_same_thread=False)
            cur = conn.cursor()
            cur.execute(f"""CREATE TABLE IF NOT EXISTS {self._disk_cache_table} (
                key TEXT PRIMARY KEY,
                url TEXT,
                ts REAL
            )""")
            conn.commit()
            self._disk_cache_conn = conn
        except Exception:
            logger.exception('打开或初始化磁盘缓存失败')

    def _get_disk_cache(self, key: str):
        try:
            self._ensure_disk_cache()
            if not getattr(self, '_disk_cache_conn', None):
                return None
            cur = self._disk_cache_conn.cursor()
            cur.execute(f"SELECT url, ts FROM {self._disk_cache_table} WHERE key = ?", (key,))
            row = cur.fetchone()
            if not row:
                return None
            return {'url': row[0], 'ts': row[1]}
        except Exception:
            logger.exception('读取磁盘缓存项失败: %s', key)
            return None

    def _set_disk_cache(self, key: str, url: str):
        try:
            self._ensure_disk_cache()
            if not getattr(self, '_disk_cache_conn', None):
                return
            cur = self._disk_cache_conn.cursor()
            cur.execute(f"INSERT OR REPLACE INTO {self._disk_cache_table} (key, url, ts) VALUES (?, ?, ?)", (key, url, time.time()))
            self._disk_cache_conn.commit()
        except Exception:
            logger.exception('写入磁盘缓存项失败: %s', key)

    def _del_disk_cache(self, key: str):
        try:
            self._ensure_disk_cache()
            if not getattr(self, '_disk_cache_conn', None):
                return
            cur = self._disk_cache_conn.cursor()
            cur.execute(f"DELETE FROM {self._disk_cache_table} WHERE key = ?", (key,))
            self._disk_cache_conn.commit()
        except Exception:
            logger.exception('删除磁盘缓存项失败: %s', key)

    def _get_720p_mp4(self, url: str) -> Optional[str]:
        """
        策略 1: 尝试通过 Bilibili 官方 API 获取 720P MP4 视频链接。

        :param url: Bilibili 视频页面的 URL。
        :return: 成功时返回 720P MP4 链接，否则返回 None。
        """
        try:
            # 从 URL 中提取 BV 号
            bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', url)
            if not bvid_match:
                return None
            bvid = bvid_match.group(0)
            logger.debug("从 URL 中提取到 BV 号: %s", bvid)

            # 第一步：调用 view 接口获取视频信息，主要是 cid
            api_url = "https://api.bilibili.com/x/web-interface/view"
            params = {"bvid": bvid}
            # 为 API 请求添加 Referer 头，模拟从 Bilibili 页面发出的请求
            headers = {'Referer': 'https://www.bilibili.com/'}
            r = self.session.get(api_url, params=params, headers=headers, timeout=self.timeout)
            data = r.json()
            if data.get('code') != 0:
                logger.warning("API /view 请求失败: %s", data.get('message'))
                return None

            video_data = data['data']
            cid = video_data.get('cid')
            if cid is None:
                logger.warning("在 /view 响应中未找到 cid")
                return None

            # 第二步：调用 playurl 接口获取播放链接
            play_url = "https://api.bilibili.com/x/player/playurl"
            params = {
                'bvid': bvid,
                'cid': cid,
                'qn': 64,      # qn=64 代表 720P 清晰度
                'fnval': 0,    # fnval=0 表示需要 MP4 格式
                'platform': 'html5'
            }
            # 为 API 请求添加 Referer 头
            headers = {'Referer': 'https://www.bilibili.com/'}
            r2 = self.session.get(play_url, params=params, headers=headers, timeout=self.timeout)
            play_data = r2.json()
            if play_data.get('code') == 0:
                data2 = play_data.get('data', {})
                if 'durl' in data2 and data2['durl']:
                    video_url = data2['durl'][0].get('url')
                    # 对获取到的 URL 进行安全检查
                    if video_url and self._is_url_allowed(video_url):
                        logger.info("通过 API 成功获取到 720P MP4 链接: %s", video_url)
                        return video_url
            logger.warning("API /playurl 请求未返回有效的 durl 链接")
            return None
        except Exception:
            logger.exception("通过 API 获取 720P MP4 链接时发生异常")
            return None

    def _is_url_allowed(self, url: str) -> bool:
        """
        对给定的 URL 进行安全检查，以防止 SSRF 攻击。

        :param url: 需要检查的 URL。
        :return: 如果 URL 安全，则返回 True，否则返回 False。
        """
        try:
            # 解析 URL
            parsed = urllib_parse(url)
            if not parsed or not parsed.hostname:
                logger.warning("URL 格式无效: %s", url)
                return False
            
            hostname = parsed.hostname
            # 检查主机名是否解析为私有 IP 地址
            if _is_private_host(hostname):
                logger.warning("检测到指向私有网络的 URL，已阻止: %s", url)
                return False
            
            return True
        except Exception:
            logger.exception("URL 安全检查时发生异常: %s", url)
            return False

    def _extract_playinfo_from_html(self, html: str) -> Optional[dict]:
        """
        策略 2a: 从网页 HTML 中提取 `window.__playinfo__` 的 JSON 数据。

        :param html: 网页的 HTML 文本。
        :return: 成功时返回解析后的字典，否则返回 None。
        """
        try:
            # 使用正则表达式查找 `window.__playinfo__` 的内容
            match = re.search(r'window\.__playinfo__\s*=\s*({.+?})\s*</script>', html, re.DOTALL)
            if not match:
                logger.debug("在 HTML 中未找到 window.__playinfo__")
                return None
            
            playinfo_json_str = match.group(1)
            # 将提取的字符串解析为 JSON 对象
            return json.loads(playinfo_json_str)
        except json.JSONDecodeError:
            logger.warning("解析 window.__playinfo__ JSON 失败")
            # 尝试进行一些修复，例如处理转义的斜杠
            try:
                corrected_json_str = playinfo_json_str.replace("\\u002F", "/")
                return json.loads(corrected_json_str)
            except Exception:
                logger.exception("修正后的 playinfo JSON 仍然解析失败")
                return None
        except Exception:
            logger.exception("从 HTML 提取 playinfo 时发生异常")
            return None

    def _extract_720p_from_playinfo(self, playinfo: dict) -> Optional[str]:
        """
        从 `playinfo` 字典中提取 720P 视频链接。

        :param playinfo: 从 `window.__playinfo__` 解析得到的字典。
        :return: 成功时返回视频 URL，否则返回 None。
        """
        try:
            data = playinfo.get('data')
            if not data:
                return None

            # 优先从 dash.video 列表中查找 720P (id=64) 的视频
            if 'dash' in data and 'video' in data['dash']:
                video_list = data['dash']['video']
                for video_info in video_list:
                    if video_info.get('id') == 64:  # 64 代表 720P
                        url = video_info.get('baseUrl')
                        if url and self._is_url_allowed(url):
                            logger.info("从 playinfo.dash 中找到 720P 链接")
                            return url
                
                # 如果没有找到 720P，则回退到清晰度最高的视频
                video_list.sort(key=lambda x: x.get('id', 0), reverse=True)
                if video_list:
                    url = video_list[0].get('baseUrl')
                    if url and self._is_url_allowed(url):
                        logger.info("从 playinfo.dash 中回退到最高清晰度链接")
                        return url

            # 如果 dash 中没有，则尝试从 durl 字段中获取
            if 'durl' in data and data['durl']:
                url = data['durl'][0].get('url')
                if url and self._is_url_allowed(url):
                    logger.info("从 playinfo.durl 中找到链接")
                    return url
            
            return None
        except Exception:
            logger.exception("从 playinfo 提取 720P 链接时发生异常")
            return None

    def _find_mp4_in_html(self, html: str) -> Optional[str]:
        """
        策略 3: 在 HTML 文本中使用正则表达式暴力搜索 MP4 链接。

        这是一个备用策略，当前面所有方法都失败时使用。
        :param html: 网页的 HTML 文本。
        :return: 返回找到的第一个安全的 MP4 链接，否则返回 None。
        """
        try:
            # 定义一系列可能匹配 MP4 链接的正则表达式
            patterns = [
                r'https?://[^\s"\'<>]+\.mp4(?:[^\s"\'<>]*)',  # 通用 MP4 链接
                r'"url"\s*:\s*"(https?://[^"]+?\.mp4[^"]*)"',   # JSON 中的 url 字段
                r'src\s*=\s*"(https?://[^"]+?\.mp4[^"]*)"',    # src 属性
                r'href\s*=\s*"(https?://[^"]+?\.mp4[^"]*)"',   # href 属性
            ]
            for pattern in patterns:
                matches = re.findall(pattern, html, flags=re.IGNORECASE)
                for match in matches:
                    # re.findall 可能会返回元组（当正则有捕获组时），需要处理
                    candidate_url = match if isinstance(match, str) else (match[0] if match else None)
                    if candidate_url and self._is_url_allowed(candidate_url):
                        logger.info("通过正则表达式暴力搜索找到 MP4 链接: %s", candidate_url)
                        return candidate_url
        except Exception:
            logger.exception("在 HTML 中搜索 MP4 链接时发生异常")
        return None

    def _detect_actual_quality(self, url: str) -> str:
        """
        根据视频 URL 中的特征字符串猜测视频的实际清晰度。

        :param url: 视频的 URL。
        :return: 表示清晰度的字符串（如 '720P', '1080P'）或 '未知'。
        """
        if '-192.mp4' in url or 'bw=1737943' in url:
            return '720P'
        if '-80.m4s' in url or '30080' in url:
            return '1080P'
        if '-64.m4s' in url or '30064' in url:
            return '720P'
        if '-32.m4s' in url or '30032' in url:
            return '480P'
        if '-16.m4s' in url:
            return '360P'
        return '未知'

    def _try_convert_cdn_url(self, url: str) -> str:
        """
        如果解析到的 URL 指向 akamaized/edgesuite 等不可访问的镜像域，尝试替换为可访问的 upos 域名并验证可达性。

        说明：不同的 CDN 镜像可能携带不同的签名参数。这里采用保守策略：
        - 仅在 hostname 中包含 'akamaized'/'mirror'/'edgesuite' 时尝试替换；
        - 以一组候选的 upos 域名（目前包含常见的 estgcos 节点）替换 hostname，并尝试 HEAD/GET 返回 200/206 即认为可用；
        - 若替换得到可用链接则返回之，否则返回原始 URL。

        注意：某些可用镜像需要特定的签名（upsig/hdnts），替换并不能总是成功。这种尝试旨在提高在云端环境中命中可用镜像的概率。
        """
        try:
            parsed = urllib_parse(url)
            hostname = parsed.hostname or ''
            low = hostname.lower()
            if not ('akamaized' in low or 'mirror' in low or 'edgesuite' in low or 'akam' in low):
                return url

            # 候选替换域名（可按需扩展）
            # 说明：这是一个经验性的候选列表，旨在提高在不同区域或镜像上的命中率。
            # 如果某些场景要求更严格验证，可以增加更多验证或关闭 best-effort fallback。
            candidates = [
                'upos-sz-estgcos.bilivideo.com',
                'upos-hz-mirrorakam.akamaized.net',
                'upos-sz-mirrorakam.akamaized.net',
                'upos-hz.akamaized.net',
                'upos-sz.bilivideo.com'
            ]

            # 解析并保留原始查询参数，必要时调整部分参数（例如 os -> estgcos）
            orig_qs = dict(parse_qsl(parsed.query, keep_blank_values=True))

            # 快速路径：某些场景下简单地把 upos-hz-mirrorakam.akamaized.net 替换为
            # upos-sz-estgcos.bilivideo.com 即可恢复可访问性。优先短路返回以提高命中率。
            if 'upos-hz-mirrorakam.akamaized.net' in low:
                quick_netloc = 'upos-sz-estgcos.bilivideo.com'
                new_parsed = parsed._replace(netloc=quick_netloc, query=urlencode(orig_qs, doseq=True))
                quick_url = urlunparse(new_parsed)
                logger.info('按用户提示进行快速替换：%s -> %s', hostname, quick_netloc)
                # 性能优化：不再做 HEAD 请求
                return quick_url

            # 使用较短的超时时间以避免在云端阻塞过久
            short_timeout = min(3, self.timeout)

            for cand in candidates:
                # 构造新的查询参数副本
                q = orig_qs.copy()
                # 如果存在 os 参数并且候选域名含 estgcos，则尝试设置 os=estgcos
                if 'estgcos' in cand:
                    q['os'] = 'estgcos'
                # 保持 platform 字段为 html5（若存在）
                if 'platform' not in q:
                    q['platform'] = 'html5'

                new_query = urlencode(q, doseq=True)
                new_parsed = parsed._replace(netloc=cand, query=new_query)
                new_url = urlunparse(new_parsed)

                # 采用 HEAD 请求验证可达性，部分服务器对 HEAD 不友好，则退回用 GET 的 Range 请求
                # 优先尝试 HEAD（轻量），但如果 HEAD 返回非 200/206，也尝试使用带 Range 的 GET
                try:
                    head_headers = {'Referer': 'https://www.bilibili.com/'}
                    h = self.session.head(new_url, timeout=short_timeout, allow_redirects=True, headers=head_headers)
                    if h.status_code in (200, 206):
                        # 尝试读取 Content-Length
                        size = h.headers.get('content-length')
                        if not size and h.headers.get('content-range'):
                            # Content-Range: bytes 0-0/12345
                            cr = h.headers.get('content-range')
                            try:
                                size = cr.split('/')[-1]
                            except Exception:
                                size = None
                        if size:
                            try:
                                self._content_length_cache[new_url] = int(size)
                            except Exception:
                                pass
                        logger.info('替换 CDN 主机成功：%s -> %s (status=%s)', hostname, cand, h.status_code)
                        return new_url
                    # 如果 HEAD 未返回成功状态，继续尝试使用带 Range 的 GET（某些 CDN 对 HEAD 返回 403 或 401）
                    logger.debug('HEAD 返回非预期状态 (%s) - 尝试使用 GET Range 验证候选 CDN %s', h.status_code, cand)
                except Exception:
                    logger.debug('HEAD 请求候选 CDN %s 时抛出异常，准备使用 GET Range 作为回退', cand)

                # 使用 GET 带 Range 作进一步验证
                try:
                    get_headers = {'Referer': 'https://www.bilibili.com/', 'Range': 'bytes=0-0'}
                    # 保留 session 的 User-Agent（已在 session headers 中设置），并允许重定向
                    r = self.session.get(new_url, timeout=short_timeout, headers=get_headers, allow_redirects=True)
                    if r.status_code in (200, 206):
                        size = r.headers.get('content-length') or (r.headers.get('content-range').split('/')[-1] if r.headers.get('content-range') else None)
                        if size:
                            try:
                                self._content_length_cache[new_url] = int(size)
                            except Exception:
                                pass
                        logger.info('通过 GET Range 验证替换 CDN 主机可用：%s -> %s (status=%s)', hostname, cand, r.status_code)
                        return new_url
                    else:
                        logger.debug('GET Range 返回非预期状态 (%s) for %s', r.status_code, cand)
                except Exception:
                    logger.debug('尝试验证候选 CDN %s 时失败', cand)

            # 如果没有任何候选被验证为可用，采用 best-effort 策略：返回第一个候选构造的 URL
            try:
                first = candidates[0]
                q = orig_qs.copy()
                if 'estgcos' in first:
                    q['os'] = 'estgcos'
                if 'platform' not in q:
                    q['platform'] = 'html5'
                be_query = urlencode(q, doseq=True)
                be_parsed = parsed._replace(netloc=first, query=be_query)
                best_effort_url = urlunparse(be_parsed)
                logger.info('未验证到可用候选，返回首个候选作为 best-effort 替换：%s -> %s', hostname, first)
                return best_effort_url
            except Exception:
                logger.debug('构造 best-effort URL 失败，退回返回原始 URL')
                return url
        except Exception:
            logger.exception('在尝试转换 CDN 链接时发生异常')
            return url

    def _get_quality_name(self, quality_id: int) -> str:
        """
        根据 Bilibili 的清晰度 ID 返回对应的名称。

        :param quality_id: 清晰度 ID (例如 80, 64)。
        :return: 清晰度名称 (例如 '1080P', '720P')。
        """
        quality_map = {
            120: '4K',
            116: '1080P60',
            112: '1080P+',
            80: '1080P',
            64: '720P',
            32: '480P',
            16: '360P'
        }
        return quality_map.get(quality_id, f'未知清晰度({quality_id})')
