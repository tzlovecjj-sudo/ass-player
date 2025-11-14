from ass_player.bilibili import BiliBiliParser


def test_try_convert_cdn_replaces_foreign_keyword_with_default():
    p = BiliBiliParser()
    url = 'https://example.akamaized.net/path/video-192.mp4?os=orig'
    out = p._try_convert_cdn_url(url)
    assert 'upos-sz-estgcos.bilivideo.com' in out


def test_try_convert_cdn_uses_best_china_host_if_available():
    p = BiliBiliParser()
    # Simulate a known best host
    p._best_china_host = 'best-china.example.com'
    url = 'https://cdn.akamai.net/media.mp4'
    out = p._try_convert_cdn_url(url)
    assert 'best-china.example.com' in out


def test_try_convert_cdn_keeps_china_host_unchanged():
    p = BiliBiliParser()
    url = 'https://upos-sz-estgcos.bilivideo.com/upgcxcode/xxx-192.mp4'
    out = p._try_convert_cdn_url(url)
    assert out == url
