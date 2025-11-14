#!/usr/bin/env python3
"""Tests for CDN persistence to SQLite via BiliBiliParser"""
import unittest
import sqlite3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ass_player.bilibili import BiliBiliParser


class TestCdnPersistence(unittest.TestCase):
    def setUp(self):
        # 使用临时文件作为 sqlite 数据库
        self.db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'test_cdn.db')
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except Exception:
            pass
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)

    def tearDown(self):
        try:
            self.conn.close()
        except Exception:
            pass
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
        except Exception:
            pass

    def test_persist_and_load(self):
        parser = BiliBiliParser(session=None, disk_cache_conn=self.conn)
        # 标记为国内并记录一次耗时
        parser.mark_cdn_hostname('cdn.example.cn', True)
        parser.record_cdn_load('cdn.example.cn', 120.0)

        # 强制创建新的解析器，注入同一连接，应能加载到之前的数据
        parser2 = BiliBiliParser(session=None, disk_cache_conn=self.conn)
        stats = parser2._cdn_stats
        self.assertIn('cdn.example.cn', stats)
        entry = stats['cdn.example.cn']
        self.assertTrue(entry.get('is_china'))
        self.assertIsNotNone(entry.get('avg_load'))
        self.assertGreater(entry.get('count', 0), 0)


if __name__ == '__main__':
    unittest.main()
