#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缓存管理器单元测试
"""

import unittest
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cache_manager import CacheManager


class TestCacheManager(unittest.TestCase):
    """CacheManager测试类"""
    
    def setUp(self):
        """测试前置设置"""
        # 缓存机制已被移除，CacheManager 保留接口但不存储数据
        self.cache = CacheManager(enabled=True, ttl=1)  # ttl 保留但无实际作用
    
    def test_cache_disabled(self):
        """测试缓存禁用"""
        cache = CacheManager(enabled=False)
        
        cache.set("test_url", {"data": "test"})
        result = cache.get("test_url")
        
        self.assertIsNone(result)
    
    def test_cache_set_and_get(self):
        """测试缓存设置和获取"""
        test_data = {"video_url": "https://example.com/video.mp4", "quality": "720P"}
        # 因为缓存已禁用，set 不会生效，get 始终返回 None
        self.cache.set("test_url", test_data)
        result = self.cache.get("test_url")
        self.assertIsNone(result)
    
    def test_cache_expiration(self):
        """测试缓存过期"""
        test_data = {"video_url": "https://example.com/video.mp4"}
        # 缓存被禁用，直接返回 None
        self.cache.set("test_url", test_data)
        result = self.cache.get("test_url")
        self.assertIsNone(result)
    
    def test_cache_key_generation(self):
        """测试缓存键生成"""
        url1 = "https://example.com/video1"
        url2 = "https://example.com/video2"
        
        key1 = self.cache._generate_key(url1)
        key2 = self.cache._generate_key(url2)
        
        self.assertNotEqual(key1, key2)
        self.assertEqual(len(key1), 32)  # MD5 hash长度
    
    def test_cache_clear(self):
        """测试缓存清空"""
        # 清空是无害的调用（即便没有缓存）
        self.cache.set("test_url1", {"data": "test1"})
        self.cache.set("test_url2", {"data": "test2"})
        self.cache.clear()
        self.assertEqual(len(self.cache._cache), 0)
    
    def test_cache_stats(self):
        """测试缓存统计"""
        stats = self.cache.get_stats()
        # 目前缓存功能被禁用
        self.assertEqual(stats['enabled'], False)
        self.assertEqual(stats['size'], 0)
        self.assertEqual(stats['ttl'], 1)


if __name__ == '__main__':
    unittest.main()