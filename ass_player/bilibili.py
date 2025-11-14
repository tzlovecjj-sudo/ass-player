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

    def __init__(self, session: Optional[requests.Session] = None, timeout: int = 10, cache_path: Optional[str] = None, disk_cache_conn: Optional[object] = None):
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
        # 内存 CDN 统计缓存：
        # 格式: { hostname: { 'is_china': bool|None, 'count': int, 'avg_load': float } }
        # 由运行时记录加载成功的时间来更新 `avg_load`，并由 `_get_best_china_host` 返回最快的国内 CDN
        self._cdn_stats = {}
        # 全局最优国内 CDN hostname（基于历史平均加载时间）
        self._best_china_host = None
        # 如果外部注入了磁盘缓存连接，则保存引用并初始化磁盘表/加载数据
        self._disk_cache_conn = disk_cache_conn
        try:
            if getattr(self, '_disk_cache_conn', None) is not None:
                try:
                    self._ensure_disk_cache()
                except Exception:
                    logger.exception('初始化磁盘 CDN 缓存时发生异常')
        except Exception:
            logger.debug('设置 disk_cache_conn 时发生异常')
    # NOTE: 不再缓存或主动获取远端资源的 Content-Length（避免在本地解析时发生阻塞）

        # 已移除缓存机制：不再在内存或磁盘中保存解析结果
        # 保留 cache_path/disk_cache_conn 参数以保持向后兼容，但不使用

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
            logger.info("开始解析 Bilibili URL 或 BV 号（仅使用官方 API）: %s", url_for_log)

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

            # 解析流程：仅使用官方 API 获取 720P MP4 链接
            try:
                mp4_url = self._get_720p_mp4(url)
                if mp4_url:
                    # 优化：仅使用官方 API 得到的直链，并对某些镜像域名做无阻塞的主机替换（不发起网络验证）
                    final_url = self._try_convert_cdn_url(mp4_url)
                    # 不再缓存解析结果，直接返回最终 URL
                    return final_url
                else:
                    logger.warning("官方 API 未返回有效的 720P MP4 链接: %s", url)
                    return None
            except Exception as ex:
                logger.exception("通过官方 API 解析 %s 时发生异常: %s", url_for_log, ex)
                return None
        except Exception as ex:
            # 捕获 get_real_url 中的任何未处理异常，记录并返回 None
            try:
                logger.exception("解析 %s 时发生未知异常: %s", url_for_log, ex)
            except Exception:
                logger.exception("解析时发生未知异常（无法记录 URL）")
            return None

    def __del__(self):
        # 不再使用磁盘缓存或持有外部连接，因此无需在析构时关闭任何缓存连接
        return


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
        对已解析出的直链做最小、无阻塞的主机替换：
        - 仅当 hostname 包含 akamaized/mirror/edgesuite/akam 时，直接替换为
          upos-sz-estgcos.bilivideo.com，并将查询参数中的 os 设置为 estgcos（如果存在或需新增）。
        - 不进行任何网络验证（HEAD/GET），也不尝试其他候选域名或读取远端大小。

        目的是在本地或受限环境中避免任何额外网络探测，同时提高在常见镜像域下的兼容性。
        """
        try:
            parsed = urllib_parse(url)
            hostname = (parsed.hostname or '').lower()
            # 保守替换策略：仅在判定为“国外 CDN”时，才尝试用已知的国内 CDN替换。
            # 已知并推荐的默认国内 host（当缓存中尚无更好候选时可作为后备）
            default_china_host = 'upos-sz-estgcos.bilivideo.com'

            # 快速路径：如果 hostname 已经是某个国内候选或默认 host，则保持不变
            if hostname in (default_china_host, (self._best_china_host or '').lower()):
                return url

            # 简单启发式判定：包含常见国外 CDN 关键字则认为来源于国外 CDN
            foreign_keywords = ('akamaized', 'akamai', 'edgesuite', 'cloudfront', 'fastly', 'cdn77', 'cdn.cloudflare')
            china_keywords = ('bilivideo', 'bcebos', 'alicdn', '.cn', 'tencent', 'qcloud', 'upai', 'estgcos')

            is_foreign = any(k in hostname for k in foreign_keywords)
            is_china = any(k in hostname for k in china_keywords)

            # 记录首次见到的 host 信息（不覆盖已有的 is_china 判断，除非为 True）
            entry = self._cdn_stats.get(hostname)
            if entry is None:
                self._cdn_stats[hostname] = {'is_china': True if is_china else (False if is_foreign else None), 'count': 0, 'avg_load': None}

            # 如果该 host 被判定为国内，则无需替换
            if is_china:
                return url

            # 如果被判定为国外 CDN，则尝试用缓存中最优国内 CDN 替换
            if is_foreign:
                # 优先使用显式设置的 _best_china_host（例如测试中直接赋值的情况），
                # 否则回退到基于统计计算的最优国内 host
                best = self._best_china_host or self._get_best_china_host()
                target = best or default_china_host
                try:
                    new_parsed = parsed._replace(netloc=target)
                    new_url = urlunparse(new_parsed)
                    logger.debug('保守替换国外 CDN 主机 %s -> %s', hostname, target)
                    return new_url
                except Exception:
                    logger.debug('替换 CDN 主机时发生异常，返回原始 URL')
                    return url

            # 未明确判定为国内或国外时，保持原始 URL（避免误替换）
            return url
        except Exception:
            logger.debug('无阻塞主机替换发生异常，返回原始 URL')
            return url

    def _ensure_disk_cache(self):
        """确保磁盘中的 CDN 统计表存在并加载已有数据到内存缓存。"""
        conn = getattr(self, '_disk_cache_conn', None)
        if conn is None:
            return
        try:
            cur = conn.cursor()
            cur.execute("""
            CREATE TABLE IF NOT EXISTS cdn_stats (
                hostname TEXT PRIMARY KEY,
                is_china INTEGER,
                count INTEGER,
                avg_load REAL,
                updated_ts REAL
            )""")
            conn.commit()
            # 加载已有数据
            try:
                cur.execute("SELECT hostname, is_china, count, avg_load FROM cdn_stats")
                rows = cur.fetchall()
                for hostname, is_china, cnt, avg in rows:
                    try:
                        self._cdn_stats[hostname] = {'is_china': (bool(is_china) if is_china is not None else None), 'count': (cnt or 0), 'avg_load': avg}
                    except Exception:
                        logger.debug('加载单条 CDN 记录失败: %s', hostname)
                # 计算最优国内 CDN
                self._best_china_host = self._get_best_china_host()
            except Exception:
                logger.debug('从磁盘加载 CDN 统计数据失败')
        except Exception:
            logger.exception('创建或初始化 cdn_stats 表时失败')

    def _save_cdn_entry(self, hostname: str):
        """将内存中单条 CDN 统计写入磁盘（INSERT OR REPLACE）。"""
        conn = getattr(self, '_disk_cache_conn', None)
        if conn is None or not hostname:
            return
        h = hostname.lower()
        entry = self._cdn_stats.get(h)
        if not entry:
            return
        try:
            cur = conn.cursor()
            cur.execute("INSERT OR REPLACE INTO cdn_stats (hostname, is_china, count, avg_load, updated_ts) VALUES (?, ?, ?, ?, ?)",
                        (h, (1 if entry.get('is_china') else (0 if entry.get('is_china') is False else None)), entry.get('count', 0), entry.get('avg_load'), time.time()))
            conn.commit()
        except Exception:
            logger.exception('将 CDN 统计写入磁盘时发生异常: %s', hostname)

    def mark_cdn_hostname(self, hostname: str, is_china: bool):
        """记录或更新主机是否为国内 CDN 的判断（由运行时或集成点调用）。"""
        if not hostname:
            return
        h = hostname.lower()
        entry = self._cdn_stats.get(h)
        if entry is None:
            self._cdn_stats[h] = {'is_china': is_china, 'count': 0, 'avg_load': None}
        else:
            # 只有在尚未明确或为 False 时更新为 True，避免误覆盖
            if entry.get('is_china') is None or (not entry.get('is_china') and is_china):
                entry['is_china'] = is_china
        # 持久化到磁盘（若可用）
        try:
            self._save_cdn_entry(hostname)
        except Exception:
            logger.debug('持久化 CDN 主机标记时发生异常')

    def record_cdn_load(self, hostname: str, load_time: float):
        """记录一次 CDN 加载成功的耗时，更新运行平均值并刷新 `_best_china_host`。

        :param hostname: 发生加载的 CDN host
        :param load_time: 本次加载耗时（秒或毫秒，调用方需一致）
        """
        if not hostname or load_time is None:
            return
        h = hostname.lower()
        entry = self._cdn_stats.get(h)
        if entry is None:
            entry = {'is_china': None, 'count': 0, 'avg_load': None}
            self._cdn_stats[h] = entry

        # 更新运行平均值
        try:
            cnt = entry.get('count', 0) + 1
            prev_avg = entry.get('avg_load')
            if prev_avg is None:
                new_avg = float(load_time)
            else:
                # 在线平均计算，权重均一
                new_avg = prev_avg + (float(load_time) - prev_avg) / cnt
            entry['count'] = cnt
            entry['avg_load'] = new_avg
        except Exception:
            logger.debug('更新 CDN 统计时发生异常 for %s', hostname)

        # 如果该 host 已被标注为国内，则可能影响最佳 host
        if entry.get('is_china'):
            self._best_china_host = self._get_best_china_host()
        # 持久化更新
        try:
            self._save_cdn_entry(hostname)
        except Exception:
            logger.debug('持久化 CDN 统计时发生异常')

    def _get_best_china_host(self) -> Optional[str]:
        """返回缓存中平均加载时间最小的国内 CDN host（如果存在）。"""
        best = None
        best_time = None
        for h, e in self._cdn_stats.items():
            if not e:
                continue
            if not e.get('is_china'):
                continue
            avg = e.get('avg_load')
            if avg is None:
                continue
            if best_time is None or avg < best_time:
                best_time = avg
                best = h
        return best

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
