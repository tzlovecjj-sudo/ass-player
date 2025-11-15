# 本地按需验证运行器（on-demand local verification runner）
# 说明（中文注释为强制）：
# 该脚本用于在你要求我“执行测试并准备本地人工验收”时使用。
# 工作流程：
#  1. 运行仓库中的单元测试（tests/ 目录）。
#  2. 若单元测试全部通过：停止任何由之前运行器/我启动的本地服务（使用 server.pid 文件中的 PID，如果存在）。
#  3. 使用开发模式启动本地项目（调用 start.py），并将新进程 PID 写入 server.pid。
#  4. 等待开发服务器监听（默认 http://127.0.0.1:8080/），然后运行 Playwright 验收脚本 tests_e2e/local_acceptance_capture.py，保存截图与日志到 artifacts/local_acceptance/。
#  5. 完成后脚本会打印 artifact 路径，供你手动查看并在对话中反馈人工验收结果。
# 注意：
#  - 本脚本只在你明确要求时运行；不应作为后台服务或自动触发器使用。
#  - 运行本脚本前请确保已激活项目虚拟环境（.venv）并已安装 Playwright 浏览器二进制（python -m playwright install chromium）。
#  - 所有操作均在本地完成，不会向远端推送任何代码。

import subprocess
import sys
import os
import time
import signal
import socket

ROOT = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
PID_FILE = os.path.join(ROOT, 'server.pid')
ACCEPTANCE_SCRIPT = os.path.join(ROOT, 'tests_e2e', 'local_acceptance_capture.py')


def run_unit_tests():
    """运行 projects 下的单元测试目录（tests/）。返回 (returncode, output)."""
    print('运行单元测试：pytest tests/ ...')
    cmd = [sys.executable, '-m', 'pytest', 'tests', '-q']
    proc = subprocess.run(cmd, cwd=ROOT)
    return proc.returncode


def stop_previous_server():
    """尝试停止此前记录在 server.pid 中的进程（若存在）。"""
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, 'r') as f:
                pid = int(f.read().strip())
        except Exception:
            print('无法读取 PID 文件，跳过停止步骤。')
            return
        print(f'尝试停止已有进程 PID={pid} ...')
        try:
            # Windows 与 POSIX 都尝试发送 SIGTERM/CTRL_BREAK，然后强制杀死
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(pid), '/F'], check=False)
            else:
                os.kill(pid, signal.SIGTERM)
                time.sleep(0.5)
                try:
                    os.kill(pid, 0)
                except Exception:
                    pass
        except Exception as e:
            print('停止进程时发生错误（可能进程已不存在）：', e)
        try:
            os.remove(PID_FILE)
        except Exception:
            pass
    else:
        print('未检测到 server.pid，跳过停止步骤。')


def start_dev_server():
    """以开发模式启动 start.py，并把 PID 写入 server.pid。
    返回 Popen 对象。
    """
    print('以开发模式启动本地服务（start.py）...')
    # 在 Windows 上，use creationflags to create new process group if needed
    kwargs = {}
    if os.name == 'nt':
        # DETACHED_PROCESS / CREATE_NEW_PROCESS_GROUP not necessary here; keep it simple
        kwargs.update(dict(shell=False))
    cmd = [sys.executable, 'start.py']
    proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    pid = proc.pid
    with open(PID_FILE, 'w') as f:
        f.write(str(pid))
    print(f'已启动开发服务器，PID={pid}（已写入 server.pid）')
    return proc


def wait_for_port(host='127.0.0.1', port=8080, timeout=30):
    print(f'等待 {host}:{port} 可用（超时 {timeout}s）...')
    start = time.time()
    while time.time() - start < timeout:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.0)
        try:
            s.connect((host, port))
            s.close()
            print('检测到服务可用。')
            return True
        except Exception:
            time.sleep(0.5)
    print('等待服务就绪超时。')
    return False


def run_acceptance_script():
    print('运行 Playwright 验收脚本以截图并保存日志...')
    if not os.path.exists(ACCEPTANCE_SCRIPT):
        print('未找到验收脚本：', ACCEPTANCE_SCRIPT)
        return 1
    cmd = [sys.executable, ACCEPTANCE_SCRIPT]
    proc = subprocess.run(cmd, cwd=ROOT)
    return proc.returncode


if __name__ == '__main__':
    # 1. 运行单元测试
    rc = run_unit_tests()
    if rc != 0:
        print('单元测试未全部通过，终止流程。请先修复失败的测试。')
        sys.exit(rc)

    # 2. 停止此前运行的本地服务（如果有）
    stop_previous_server()

    # 3. 启动本地开发服务器
    proc = start_dev_server()

    # 4. 等待服务就绪
    ok = wait_for_port('127.0.0.1', 8080, timeout=30)
    if not ok:
        print('服务未在超时内就绪，请检查 start.py 输出或手动启动服务。')
        sys.exit(2)

    # 5. 运行验收脚本（会保存 artifacts）
    rc2 = run_acceptance_script()
    if rc2 != 0:
        print('验收脚本运行返回非零代码：', rc2)
    else:
        print('验收脚本运行完成，查看 artifacts/local_acceptance/ 以获取截图与日志。')

    print('本次按需本地验证流程执行完毕（本地操作）。')
    sys.exit(rc2)
