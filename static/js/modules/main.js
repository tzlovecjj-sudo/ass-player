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
        let isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        if (urlInput && !urlInput.value) {
            urlInput.value = 'https://www.bilibili.com/video/BV1NmyXBTEGD';
        }

        // 防止重复请求和 demo/手动互斥
        let isParsing = false;
        let lastParsedUrl = '';
        if (loadBtn && urlInput) {
            loadBtn.textContent = '加载';
            loadBtn.onclick = async () => {
                const url = urlInput.value.trim();
                if (!url) {
                    window.player.showStatus('请输入有效的视频 URL。', 'error');
                    return;
                }
                if (isParsing) {
                    window.player.showStatus('正在解析中，请勿重复点击。', 'info');
                    return;
                }
                if (lastParsedUrl === url) {
                    window.player.showStatus('该视频已解析过，请勿重复请求。', 'info');
                    return;
                }
                isParsing = true;
                loadBtn.disabled = true;
                window.player.showStatus('正在解析视频链接...', 'info');
                try {
                    const resp = await fetch(`/api/auto-parse?url=${encodeURIComponent(url)}`);
                    const status = resp.status;
                    const data = await resp.json().catch(() => ({}));
                    if (status === 429) {
                        let retry = data.retry_after || 2;
                        window.player.showStatus((data.error || '请求过于频繁，请稍后重试。') + ` (${retry}s后可重试)`, 'error');
                        setTimeout(() => { isParsing = false; loadBtn.disabled = false; }, retry * 1000);
                        return;
                    }
                    if (data.success && data.video_url) {
                        lastParsedUrl = url;
                        window.player.fileHandler.loadOnlineVideoWithUrl(data.video_url, url, data.content_length);
                    } else if (data.success) {
                        const dlUrl = data.download_url || data.video_url;
                        if (dlUrl) {
                            window.player.uiController.showDownloadPanel(dlUrl, '视频下载链接', data.content_length);
                        } else {
                            window.player.showStatus(data.error || '未获取到视频直链。', 'error');
                        }
                    } else {
                        window.player.showStatus(data.error || '未获取到视频直链。', 'error');
                    }
                } catch (e) {
                    console.error('解析视频链接异常:', e);
                    window.player.showStatus('解析视频链接失败，请检查网络或稍后重试。', 'error');
                } finally {
                    isParsing = false;
                    loadBtn.disabled = false;
                }
            };
        }
        // 下载按钮已移除：不再提供单独的下载按钮，下载提示将仅在加载成功时显示

        // --- 在线 Demo：默认加载示例字幕与对应 B 站视频（仅本地演示时自动加载） ---
        if (isLocal) {
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
