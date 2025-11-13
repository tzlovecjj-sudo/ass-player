// 模块化入口文件
// 注意：此文件与 `static/js/main.js` 功能相似，都用于初始化播放器。
// 项目中可能存在两种入口点，或此文件为备用/旧的模块化入口。

import EmbeddedASSPlayer from '../ass-player.js'; // 导入播放器主类

/**
 * 当页面的 DOM 内容完全加载并解析完毕后，执行此回调函数。
 * 这是模块化版本的应用程序启动点。
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 加载完成，开始初始化 ASS 播放器 (模块化版本)...');
    try {
        window.player = new EmbeddedASSPlayer();
        console.log('播放器实例创建成功。');

        // 分离加载和下载按钮逻辑
        const loadBtn = document.getElementById('loadOnlineVideoBtn');
        const downloadBtn = document.getElementById('downloadOnlineVideoBtn');
        const urlInput = document.getElementById('onlineVideoUrl');
    // 扩展本地判断：当在本机或绑定到 0.0.0.0 时也认为是本地演示环境。
    // 许多开发场景下服务会绑定到 0.0.0.0 或通过本机局域网 IP 访问，
    // 我们允许 127.x, localhost, 0.0.0.0 和 IPv6 回环 ::1 自动加载示例。
    const host = (location.hostname || '').toLowerCase();
    let isLocal = host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.startsWith('127.');
        if (urlInput && !urlInput.value) {
            urlInput.value = 'https://www.bilibili.com/video/BV1NmyXBTEGD';
        }

        // 加载按钮处理（注意：客户端不再实施时间窗口限流，仅在一次点击期间禁用按钮以避免 UI 闪烁）
        if (loadBtn && urlInput) {
            loadBtn.textContent = '加载';
            loadBtn.onclick = async () => {
                const url = urlInput.value.trim();
                if (!url) {
                    window.player.showStatus('请输入有效的视频 URL。', 'error');
                    return;
                }

                loadBtn.disabled = true; // 临时禁用按钮，避免用户快速连点
                window.player.showStatus('正在解析视频链接...', 'info');
                try {
                    const resp = await fetch(`/api/auto-parse?url=${encodeURIComponent(url)}`);
                    const status = resp.status;
                    let data = {};
                    try {
                        data = await resp.json();
                    } catch (jsonErr) {
                        console.warn('解析 API 返回的 JSON 失败：', jsonErr);
                        data = {};
                    }
                    console.log('auto-parse response:', { status, data });

                    // 如果后端返回 429，前端只展示提示，不在客户端设置额外的时间窗口限制
                    if (status === 429) {
                        const retry = data.retry_after || 2;
                        window.player.showStatus((data.error || '请求过于频繁，请稍后重试。') + ` （参考: ${retry}s）`, 'error');
                        return;
                    }

                    if (resp.ok && data && data.success && data.video_url) {
                        window.player.fileHandler.loadOnlineVideoWithUrl(data.video_url, url);
                    } else if (data && data.success) {
                        const dlUrl = data.download_url || data.video_url;
                        if (dlUrl) {
                            window.player.uiController.showDownloadPanel(dlUrl, '视频下载链接');
                        } else {
                            window.player.showStatus(data.error || '未获取到视频直链。', 'error');
                        }
                    } else {
                        const errMsg = data && data.error ? data.error : `解析失败，HTTP ${status}`;
                        console.warn('解析未成功，返回数据：', data);
                        window.player.showStatus(errMsg || '未获取到视频直链。', 'error');
                    }
                } catch (e) {
                    console.error('解析视频链接异常:', e);
                    window.player.showStatus('解析视频链接失败，请检查网络或稍后重试。', 'error');
                } finally {
                    // 始终恢复按钮状态，避免客户端自我节流
                    loadBtn.disabled = false;
                }
            };
        }
        // 下载按钮已移除：不再提供单独的下载按钮，下载提示将仅在加载成功时显示

    // --- 在线 Demo：默认加载示例字幕与对应 B 站视频（页面进入即自动加载与播放） ---
    // 无论是否本地或绑定域名，进入页面都尝试自动加载示例视频与字幕
    if (true) {
            const demoBiliUrl = 'https://www.bilibili.com/video/BV1NmyXBTEGD';
            const demoAssName = '2 Minecraft Pros VS 1000 Players.ass';
            const demoAssPath = '/ass_files/' + encodeURIComponent(demoAssName);
            let demoVideoLoaded = false;
            let demoSubtitleLoaded = false;
            let autoPlayed = false;
            let demoParsing = false;
            function tryAutoPlay() {
                if (demoVideoLoaded && demoSubtitleLoaded && !autoPlayed) {
                    autoPlayed = true;
                    const v = window.player.videoPlayer;
                    if (v) v.muted = true;
                    if (v && v.readyState >= 2) {
                        v.play().catch(() => {});
                    } else if (v) {
                        v.addEventListener('canplay', function handler() {
                            v.removeEventListener('canplay', handler);
                            v.play().catch(() => {});
                        });
                    }
                }
            }
            // demo 加载和手动点击互斥
            if (window.player.onlineVideoUrl) {
                window.player.onlineVideoUrl.value = demoBiliUrl;
                const v = window.player.videoPlayer;
                v.addEventListener('canplay', function handler() {
                    v.removeEventListener('canplay', handler);
                    demoVideoLoaded = true;
                    tryAutoPlay();
                });
                if (!demoParsing) {
                    demoParsing = true;
                    window.player.fileHandler.loadOnlineVideo();
                }
            }
            fetch(demoAssPath)
                .then(resp => {
                    if (!resp.ok) throw new Error('获取示例字幕失败');
                    return resp.text();
                })
                .then(text => {
                    window.player.subtitleRenderer.parseASSFile(text);
                    window.player.updateSubtitleInfo({ name: demoAssName, size: text.length });
                    window.player.showStatus('已加载示例字幕。', 'success');
                    demoSubtitleLoaded = true;
                    tryAutoPlay();
                })
                .catch(err => {
                    console.warn('示例字幕加载失败：', err);
                    window.player.showStatus('示例字幕加载失败', 'error');
                });
        }
    } catch (error) {
        console.error('播放器初始化过程中发生严重错误:', error);
    }
});
