"""测试运行时的 artifact 注册器。

用法：在 E2E 测试中调用 register_page(page) 来注册当前页面，
当 pytest 检测到测试失败时，conftest.py 会把注册的 page 的截图、HTML 和控制台日志保存到 artifacts/ 目录，
便于 CI 上自动上传供调试使用。
"""
from typing import List

# 存储已注册的 page 对象与其收集的控制台消息
_registered_pages: List[dict] = []


def register_page(page):
    """注册 Playwright 的 page 实例以便在测试失败时收集 artifact。

    此函数会为 page 添加一个简单的 console 消息收集器并将 page 推入内部列表。
    """
    entry = {
        'page': page,
        'console': [],
    }

    def _on_console(msg):
        try:
            entry['console'].append({'type': msg.type, 'text': msg.text})
        except Exception:
            # 忽略收集控制台日志时的任何异常
            pass

    try:
        page.on('console', _on_console)
    except Exception:
        # 如果 page 不支持事件绑定，仍然把 page 注册（降级）
        pass

    _registered_pages.append(entry)


def get_registered_pages():
    return list(_registered_pages)


def clear_registered_pages():
    _registered_pages.clear()
