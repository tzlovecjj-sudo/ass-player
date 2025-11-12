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
        self.cache = CacheManager(enabled=True, ttl=1)  # 1秒TTL便于测试
    
    def test_cache_disabled(self):
        """测试缓存禁用"""
        cache = CacheManager(enabled=False)
        
        cache.set("test_url", {"data": "test"})
        result = cache.get("test_url")
        
        self.assertIsNone(result)
    
    def test_cache_set_and_get(self):
        """测试缓存设置和获取"""
        test_data = {"video_url": "https://example.com/video.mp4", "quality": "720P"}
        
        self.cache.set("test_url", test_data)
        result = self.cache.get("test_url")
        
        self.assertEqual(result, test_data)
    
    def test_cache_expiration(self):
        """测试缓存过期"""
        test_data = {"video_url": "https://example.com/video.mp4"}
        
        self.cache.set("test_url", test_data)
        
        # 等待缓存过期
        time.sleep(1.1)
        
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
        self.cache.set("test_url1", {"data": "test1"})
        self.cache.set("test_url2", {"data": "test2"})
        
        self.assertEqual(len(self.cache._cache), 2)
        
        self.cache.clear()
        
        self.assertEqual(len(self.cache._cache), 0)
    
    def test_cache_stats(self):
        """测试缓存统计"""
        stats = self.cache.get_stats()
        
        self.assertEqual(stats['enabled'], True)
        self.assertEqual(stats['size'], 0)
        self.assertEqual(stats['ttl'], 1)
        
        self.cache.set("test_url", {"data": "test"})
        
        stats = self.cache.get_stats()
        self.assertEqual(stats['size'], 1)


if __name__ == '__main__':
    unittest.main()