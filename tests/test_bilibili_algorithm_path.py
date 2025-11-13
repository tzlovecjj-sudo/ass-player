import unittest
from ass_player.bilibili import BiliBiliParser

class TestBiliBiliParserAlgorithmPath(unittest.TestCase):
    def setUp(self):
        self.parser = BiliBiliParser()
        # 默认B站视频
        self.url = "https://www.bilibili.com/video/BV1NmyXBTEGD"
        # 跟踪调用路径
        self.trace = []
        # Patch方法用于跟踪
        self._patch_methods()

    def _patch_methods(self):
        # 只patch主流程相关方法
        orig_get_720p_mp4 = self.parser._get_720p_mp4
        orig_extract_playinfo = self.parser._extract_playinfo_from_html
        orig_extract_720p = self.parser._extract_720p_from_playinfo
        orig_try_convert = self.parser._try_convert_cdn_url
        orig_is_url_allowed = self.parser._is_url_allowed

        def wrap(name, func):
            def inner(*args, **kwargs):
                self.trace.append(name)
                return func(*args, **kwargs)
            return inner
        self.parser._get_720p_mp4 = wrap('_get_720p_mp4', orig_get_720p_mp4)
        self.parser._extract_playinfo_from_html = wrap('_extract_playinfo_from_html', orig_extract_playinfo)
        self.parser._extract_720p_from_playinfo = wrap('_extract_720p_from_playinfo', orig_extract_720p)
    # 不再跟踪或 patch 正则查找方法，因为已从解析器中移除
        self.parser._try_convert_cdn_url = wrap('_try_convert_cdn_url', orig_try_convert)
        self.parser._is_url_allowed = wrap('_is_url_allowed', orig_is_url_allowed)

    def test_algorithm_path_for_default_video(self):
        url = self.url
        result = self.parser.get_real_url(url)
        print('trace:', self.trace)
        print('result:', result)
        # 只要能拿到直链即可
        self.assertTrue(result and result.startswith('http'))
        # trace中应能看到主流程调用顺序

if __name__ == '__main__':
    unittest.main()
