from unittest.mock import patch

from ass_player import bilibili


def test_is_private_host_detects_private_ip():
    with patch('ass_player.bilibili.socket.getaddrinfo') as m:
        m.return_value = [(None, None, None, None, ('192.168.1.100', 0))]
        assert bilibili._is_private_host('test.local') is True


def test_is_private_host_detects_public_ip():
    with patch('ass_player.bilibili.socket.getaddrinfo') as m:
        m.return_value = [(None, None, None, None, ('8.8.8.8', 0))]
        assert bilibili._is_private_host('example.com') is False


def test_is_private_host_dns_failure_returns_false():
    with patch('ass_player.bilibili.socket.getaddrinfo', side_effect=Exception('DNS fail')):
        # On DNS failure the implementation conservatively treats as non-private
        assert bilibili._is_private_host('no-resolve.example') is False


def test_is_url_allowed_blocks_private_addresses():
    p = bilibili.BiliBiliParser()
    with patch('ass_player.bilibili.socket.getaddrinfo') as m:
        m.return_value = [(None, None, None, None, ('10.0.0.5', 0))]
        assert p._is_url_allowed('http://10.0.0.5/secret') is False


def test_is_url_allowed_accepts_public_addresses():
    p = bilibili.BiliBiliParser()
    with patch('ass_player.bilibili.socket.getaddrinfo') as m:
        m.return_value = [(None, None, None, None, ('93.184.216.34', 0))]  # example.com
        assert p._is_url_allowed('http://example.com/video') is True
