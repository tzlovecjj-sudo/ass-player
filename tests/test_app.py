#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flask应用单元测试
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app


class TestFlaskApp(unittest.TestCase):
    """Flask应用测试类"""
    
    def setUp(self):
        """测试前置设置"""
        self.app = app.test_client()
        self.app.testing = True
    
    def test_index_route(self):
        """测试主页路由"""
        response = self.app.get('/')
        
        self.assertEqual(response.status_code, 200)
        # 使用ASCII字符检查
        self.assertIn(b'ASS', response.data)
    
    def test_instructions_route(self):
        """测试使用说明路由"""
        response = self.app.get('/instructions')
        
        self.assertEqual(response.status_code, 200)
    
    def test_static_files_route(self):
        """测试静态文件路由"""
        response = self.app.get('/static/css/main.css')
        
        # 可能返回404如果文件不存在，但路由应该工作
        self.assertIn(response.status_code, [200, 404])

    def test_ass_files_route(self):
        """测试ass_files字幕文件路由"""
        # 只测试路由可访问性，不要求文件一定存在
        response = self.app.get('/ass_files/2%20Minecraft%20Pros%20VS%201000%20Players.ass')
        self.assertIn(response.status_code, [200, 404])

    def test_404_route(self):
        """测试404页面"""
        response = self.app.get('/not-exist-url')
        self.assertEqual(response.status_code, 404)

    def test_auto_parse_success(self):
        """测试自动解析API成功分支（mock解析器）"""
        import unittest.mock as mock
        with mock.patch('ass_player.bilibili.BiliBiliParser.get_real_url', return_value='https://test.com/video.mp4'):
            response = self.app.get('/api/auto-parse?url=https://www.bilibili.com/video/BV1xx411c7mD')
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'success', response.data)
            self.assertIn(b'video_url', response.data)
    
    def test_auto_parse_missing_url(self):
        """测试缺少URL参数的自动解析"""
        response = self.app.get('/api/auto-parse')
        
        self.assertEqual(response.status_code, 400)
    
    def test_auto_parse_invalid_domain(self):
        """测试无效域名的自动解析"""
        response = self.app.get('/api/auto-parse?url=https://example.com/video')
        
        self.assertEqual(response.status_code, 400)
    
    def test_auto_parse_rate_limit(self):
        """测试速率限制"""
        # 第一次请求
        response1 = self.app.get('/api/auto-parse?url=https://www.bilibili.com/video/BV1xx411c7mD')
        
        # 立即第二次请求（应该被限制）
        response2 = self.app.get('/api/auto-parse?url=https://www.bilibili.com/video/BV1xx411c7mD')
        
        # 至少有一个应该返回429
        status_codes = [response1.status_code, response2.status_code]
        self.assertTrue(429 in status_codes)


if __name__ == '__main__':
    unittest.main()