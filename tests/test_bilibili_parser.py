#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B站解析器单元测试
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ass_player.bilibili import BiliBiliParser, _is_private_host


class TestBilibiliParser(unittest.TestCase):
    """BiliBiliParser测试类"""
    
    def setUp(self):
        """测试前置设置"""
        self.parser = BiliBiliParser()
        self.valid_bilibili_url = "https://www.bilibili.com/video/BV1xx411c7mD"
        self.invalid_url = "https://example.com/video"
    
    def test_private_host_detection(self):
        """测试私有主机检测"""
        # 测试私有IP
        with patch('socket.getaddrinfo') as mock_getaddrinfo:
            mock_getaddrinfo.return_value = [(None, None, None, None, ('192.168.1.1', None))]
            self.assertTrue(_is_private_host('test.local'))
        
        # 测试公网IP
        with patch('socket.getaddrinfo') as mock_getaddrinfo:
            mock_getaddrinfo.return_value = [(None, None, None, None, ('8.8.8.8', None))]
            self.assertFalse(_is_private_host('google.com'))
    
    @patch('ass_player.bilibili.BiliBiliParser._get_720p_mp4')
    def test_get_real_url_success(self, mock_get_720p):
        """测试成功获取真实URL"""
        mock_get_720p.return_value = "https://example.com/video.mp4"
        
        result = self.parser.get_real_url(self.valid_bilibili_url)
        
        self.assertEqual(result, "https://example.com/video.mp4")
        mock_get_720p.assert_called_once_with(self.valid_bilibili_url)
    
    def test_get_real_url_invalid_domain(self):
        """测试无效域名处理"""
        result = self.parser.get_real_url(self.invalid_url)
        
        self.assertIsNone(result)
    
    @patch('ass_player.bilibili.BiliBiliParser._get_720p_mp4')
    @patch('ass_player.bilibili.BiliBiliParser._extract_playinfo_from_html')
    def test_get_real_url_fallback_strategies(self, mock_extract_playinfo, mock_get_720p):
        """测试fallback策略"""
        # 所有策略都失败
        mock_get_720p.return_value = None
        mock_extract_playinfo.return_value = None
        
        result = self.parser.get_real_url(self.valid_bilibili_url)
        
        self.assertIsNone(result)
        mock_get_720p.assert_called_once()
    
    def test_detect_actual_quality(self):
        """测试视频质量检测"""
        test_cases = [
            ("https://example.com/video-192.mp4", "720P"),
            ("https://example.com/video-80.m4s", "1080P"),
            ("https://example.com/video-64.m4s", "720P"),
            ("https://example.com/video-32.m4s", "480P"),
            ("https://example.com/video-16.m4s", "360P"),
            ("https://example.com/unknown.mp4", "未知"),
        ]
        
        for url, expected_quality in test_cases:
            with self.subTest(url=url):
                quality = self.parser._detect_actual_quality(url)
                self.assertEqual(quality, expected_quality)
    
    def test_get_quality_name(self):
        """测试质量名称映射"""
        test_cases = [
            (120, "4K"),
            (116, "1080P60"),
            (112, "1080P+"),
            (80, "1080P"),
            (64, "720P"),
            (32, "480P"),
            (16, "360P"),
            (999, "未知清晰度(999)"),  # 未知质量
        ]
        
        for quality_id, expected_name in test_cases:
            with self.subTest(quality_id=quality_id):
                quality_name = self.parser._get_quality_name(quality_id)
                self.assertEqual(quality_name, expected_name)

    def test_extract_playinfo_from_html(self):
        """测试从HTML中提取playinfo JSON"""
        html = '<script>window.__playinfo__ = {"data": {"durl": [{"url": "https://test.com/1.mp4"}]}} </script>'
        playinfo = self.parser._extract_playinfo_from_html(html)
        self.assertIsInstance(playinfo, dict)
        self.assertIn('data', playinfo)

    # 已移除：不再在 HTML 中进行盲目正则搜索 MP4 链接（易误判且带来安全隐患）

    def test_extract_playinfo_json_error(self):
        """测试playinfo JSON解析异常分支"""
        # 非法JSON
        html = '<script>window.__playinfo__ = {bad json </script>'
        playinfo = self.parser._extract_playinfo_from_html(html)
        self.assertIsNone(playinfo)


if __name__ == '__main__':
    unittest.main()