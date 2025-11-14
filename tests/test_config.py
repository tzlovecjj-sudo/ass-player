from config import get_config, Config, TestingConfig


def test_report_timeout_default():
    cfg = get_config('default')
    assert cfg.REPORT_TIMEOUT_MS == 3000


def test_testing_config_overrides_cache():
    cfg = get_config('testing')
    assert cfg.CACHE_ENABLED is False
