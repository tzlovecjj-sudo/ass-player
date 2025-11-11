"""
A refactored BiliBiliParser extracted from start.py.
This module provides a reusable parser class with requests session reuse, retry logic, and better error handling.
"""
import re
import json
import logging
import ipaddress
import socket
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

def _is_private_host(hostname: str) -> bool:
    try:
        # Resolve to IP; could return multiple, check all
        for res in socket.getaddrinfo(hostname, None):
            ip = res[4][0]
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved:
                return True
    except Exception:
        # If DNS resolution fails, do not assume private
        logger.debug("DNS resolution failed for %s", hostname)
    return False

class BiliBiliParser:
    """BiliBiliParser - focused on obtaining high-quality 720P MP4 links.

    Usage:
        parser = BiliBiliParser()
        url = parser.get_real_url(bilibili_url)
    """

    def __init__(self, session: Optional[requests.Session] = None, timeout: int = 10):
        if session is None:
            session = requests.Session()
            retries = Retry(total=3, backoff_factor=0.5, status_forcelist=(429, 502, 503, 504))
            adapter = HTTPAdapter(max_retries=retries)
            session.mount("https://", adapter)
            session.mount("http://", adapter)
        self.session = session
        self.timeout = timeout
        # use mobile UA similar to original script
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9',
        })

    def get_real_url(self, url: str) -> Optional[str]:
        """Main entry: try multiple strategies to obtain a direct video URL."""
        try:
            logger.info("Start parsing Bilibili URL: %s", url)

            # Basic validation
            if not url or 'bilibili.com' not in url:
                logger.warning("Not a Bilibili URL: %s", url)
                return None

            # Strategy 1: try API-driven 720P MP4
            mp4 = self._get_720p_mp4(url)
            if mp4:
                return mp4

            # Fetch HTML and try to extract playinfo
            resp = self.session.get(url, timeout=self.timeout)
            html = resp.text

            # Strategy 2: try window.__playinfo__
            playinfo = self._extract_playinfo_from_html(html)
            if playinfo:
                v = self._extract_720p_from_playinfo(playinfo)
                if v:
                    return v

            # Strategy 3: regex-find any mp4 link
            mp4 = self._find_mp4_in_html(html)
            if mp4:
                return mp4

            logger.info("All parsing strategies failed for %s", url)
            return None
        except Exception:
            logger.exception("Exception while parsing %s", url)
            return None

    def _get_720p_mp4(self, url: str) -> Optional[str]:
        try:
            bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', url)
            if not bvid_match:
                return None
            bvid = bvid_match.group(0)
            logger.debug("Found BV: %s", bvid)

            api_url = "https://api.bilibili.com/x/web-interface/view"
            params = {"bvid": bvid}
            r = self.session.get(api_url, params=params, timeout=self.timeout)
            data = r.json()
            if data.get('code') != 0:
                return None

            video_data = data['data']
            cid = video_data.get('cid')
            if cid is None:
                return None

            play_url = "https://api.bilibili.com/x/player/playurl"
            params = {
                'bvid': bvid,
                'cid': cid,
                'qn': 64,  # 720P
                'fnval': 0,
                'platform': 'html5'
            }
            r2 = self.session.get(play_url, params=params, timeout=self.timeout)
            play_data = r2.json()
            if play_data.get('code') == 0:
                data2 = play_data.get('data', {})
                if 'durl' in data2 and data2['durl']:
                    video_url = data2['durl'][0].get('url')
                    if video_url and self._is_url_allowed(video_url):
                        logger.info("Obtained mp4 via API: %s", video_url)
                        return video_url
            return None
        except Exception:
            logger.exception("_get_720p_mp4 failed")
            return None

    def _is_url_allowed(self, url: str) -> bool:
        # Basic scheme check
        parsed = urllib_parse(url)
        if not parsed:
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        # disallow private hosts to mitigate SSRF
        if _is_private_host(hostname):
            logger.warning("Hostname resolves to private IP: %s", hostname)
            return False
        return True

    def _extract_playinfo_from_html(self, html: str) -> Optional[dict]:
        # Try to find window.__playinfo__ = {...}</script>
        try:
            m = re.search(r'window\\.__playinfo__\s*=\s*({.+?})\s*</script>', html, re.DOTALL)
            if not m:
                return None
            playinfo_json = m.group(1)
            # Try to load JSON safely
            return json.loads(playinfo_json)
        except json.JSONDecodeError:
            # Try a relaxed fix
            try:
                corrected = playinfo_json.replace("\\u002F", "/")
                return json.loads(corrected)
            except Exception:
                logger.exception("Failed to decode playinfo JSON")
                return None
        except Exception:
            logger.exception("Error extracting playinfo from HTML")
            return None

    def _extract_720p_from_playinfo(self, playinfo: dict) -> Optional[str]:
        try:
            if 'data' not in playinfo:
                return None
            data = playinfo['data']
            # prefer dash.video id 64
            if 'dash' in data and 'video' in data['dash']:
                video_list = data['dash']['video']
                for v in video_list:
                    if v.get('id') == 64:
                        url = v.get('baseUrl')
                        if url and self._is_url_allowed(url):
                            return url
                # fallback highest id
                video_list.sort(key=lambda x: x.get('id', 0), reverse=True)
                if video_list:
                    url = video_list[0].get('baseUrl')
                    if url and self._is_url_allowed(url):
                        return url
            # fallback durl
            if 'durl' in data and data['durl']:
                url = data['durl'][0].get('url')
                if url and self._is_url_allowed(url):
                    return url
            return None
        except Exception:
            logger.exception("_extract_720p_from_playinfo failed")
            return None

    def _find_mp4_in_html(self, html: str) -> Optional[str]:
        """In HTML text, find MP4 links and return the first allowed candidate or None."""
        try:
            patterns = [
                r'https?://[^\s"\'<>]+\.mp4(?:[^\s"\'<>]*)',
                r'"url"\s*:\s*"(https?://[^"]+?\.mp4[^"]*)"',
                r'src\s*=\s*"(https?://[^"]+?\.mp4[^"]*)"',
                r'href\s*=\s*"(https?://[^"]+?\.mp4[^"]*)"',
            ]
            for pat in patterns:
                for m in re.findall(pat, html, flags=re.IGNORECASE):
                    # re.findall may return tuples when there are groups; normalize to string
                    candidate = m if isinstance(m, str) else (m[0] if m else None)
                    if not candidate:
                        continue
                    if hasattr(self, "_is_url_allowed") and not self._is_url_allowed(candidate):
                        continue
                    logger.info("Found mp4 via regex: %s", candidate)
                    return candidate
        except Exception:
            logger.exception("_find_mp4_in_html failed")
        return None

    def _detect_actual_quality(self, url: str) -> str:
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

    def _get_quality_name(self, quality_id: int) -> str:
        quality_map = {120: '4K', 116: '1080P60', 112: '1080P+', 80: '1080P', 64: '720P', 32: '480P', 16: '360P'}
        return quality_map.get(quality_id, f'质量{quality_id}')

# helper: minimal url parse to avoid heavy deps
from urllib.parse import urlparse as urllib_parse