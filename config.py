#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置文件 - 支持环境变量和默认值
"""

import os
from typing import Dict, Any


class Config:
    """应用配置类"""
    
    # Flask配置
    HOST = os.environ.get('ASS_PLAYER_HOST', '127.0.0.1')
    PORT = int(os.environ.get('ASS_PLAYER_PORT', '8080'))
    DEBUG = os.environ.get('ASS_PLAYER_DEBUG', 'false').lower() == 'true'
    
    # 安全配置
    RATE_LIMIT_SECONDS = int(os.environ.get('ASS_PLAYER_RATE_LIMIT', '1'))
    ALLOWED_DOMAINS = ['bilibili.com']  # 域名白名单
    
    # 解析器配置
    PARSER_TIMEOUT = int(os.environ.get('ASS_PARSER_TIMEOUT', '10'))
    PARSER_RETRIES = int(os.environ.get('ASS_PARSER_RETRIES', '3'))
    
    # 缓存配置
    CACHE_ENABLED = os.environ.get('ASS_CACHE_ENABLED', 'true').lower() == 'true'
    CACHE_TTL = int(os.environ.get('ASS_CACHE_TTL', '3600'))  # 1小时
    
    # 日志配置
    LOG_LEVEL = os.environ.get('ASS_LOG_LEVEL', 'INFO')
    
    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            key: value for key, value in cls.__dict__.items()
            if not key.startswith('_') and not callable(value)
        }


# 开发环境配置
class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


# 生产环境配置
class ProductionConfig(Config):
    DEBUG = False
    LOG_LEVEL = 'WARNING'


# 测试环境配置
class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    CACHE_ENABLED = False


# 配置映射
configs = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': Config
}


def get_config(config_name: str = None) -> Config:
    """获取配置实例"""
    if config_name is None:
        config_name = os.environ.get('ASS_ENV', 'default')
    return configs.get(config_name, Config)
