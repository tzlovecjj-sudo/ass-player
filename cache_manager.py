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
        self.enabled = enabled
        self.ttl = ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        
    def _generate_key(self, url: str) -> str:
        """生成缓存键"""
        return hashlib.md5(url.encode()).hexdigest()
    
    def get(self, url: str) -> Optional[Dict[str, Any]]:
        """获取缓存数据"""
        if not self.enabled:
            return None
            
        key = self._generate_key(url)
        cached_data = self._cache.get(key)
        
        if cached_data:
            # 检查是否过期
            if time.time() - cached_data['timestamp'] < self.ttl:
                logger.debug("缓存命中: %s", url)
                return cached_data['data']
            else:
                # 清理过期缓存
                del self._cache[key]
                logger.debug("缓存过期: %s", url)
        
        return None
    
    def set(self, url: str, data: Dict[str, Any]) -> None:
        """设置缓存数据"""
        if not self.enabled:
            return
            
        key = self._generate_key(url)
        self._cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
        logger.debug("缓存设置: %s", url)
    
    def clear(self) -> None:
        """清空缓存"""
        self._cache.clear()
        logger.info("缓存已清空")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        return {
            'enabled': self.enabled,
            'size': len(self._cache),
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