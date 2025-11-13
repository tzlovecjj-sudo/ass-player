#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缓存管理器 - 支持内存缓存和可选的Redis缓存
"""

import time
import logging
from typing import Optional, Any, Dict
import json
import hashlib

logger = logging.getLogger(__name__)


class CacheManager:
    """缓存管理器"""
    
    def __init__(self, enabled: bool = True, ttl: int = 3600):
        # 缓存已被移除：保留接口但不再存储任何数据
        # 为保持向后兼容，保留 enabled/ttl 属性，但实现为无操作
        self.enabled = False
        self.ttl = ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        
    def _generate_key(self, url: str) -> str:
        """生成缓存键"""
        return hashlib.md5(url.encode()).hexdigest()
    
    def get(self, url: str) -> Optional[Dict[str, Any]]:
        """获取缓存数据"""
        # 缓存已禁用，始终返回 None
        return None
    
    def set(self, url: str, data: Dict[str, Any]) -> None:
        """设置缓存数据"""
        # no-op: 不再写入缓存
        return
    
    def clear(self) -> None:
        """清空缓存"""
        # 清空无操作缓存（兼容调用）
        self._cache.clear()
        logger.info("缓存功能已禁用，已清空（无实际缓存）")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        return {
            'enabled': False,
            'size': 0,
            'ttl': self.ttl
        }


# 全局缓存实例
cache_manager = CacheManager()


def setup_cache(enabled: bool = True, ttl: int = 3600):
    """设置缓存配置"""
    global cache_manager
    cache_manager = CacheManager(enabled=enabled, ttl=ttl)


def get_cache() -> CacheManager:
    """获取缓存实例"""
    return cache_manager