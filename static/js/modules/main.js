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

        // 动态切换“加载/下载”按钮
        const onlineBtn = document.getElementById('loadOnlineVideoBtn');
        const urlInput = document.getElementById('onlineVideoUrl');
        let isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
        if (onlineBtn && urlInput) {
            if (isLocal) {
                onlineBtn.textContent = '加载';
                onlineBtn.onclick = () => window.player.fileHandler.loadOnlineVideo();
            } else {
                onlineBtn.textContent = '下载';
                onlineBtn.onclick = async () => {
                    const url = urlInput.value.trim();
                    if (!url) {
                        window.player.showStatus('请输入有效的视频 URL。', 'error');
                        return;
                    }
                    window.player.showStatus('正在获取下载链接...', 'info');
                    try {
                        const resp = await fetch(`/api/auto-parse?url=${encodeURIComponent(url)}`);
                        const data = await resp.json();
                        if (data.success && data.download_url) {
                            // 直接跳转下载
                            window.open(data.download_url, '_blank');
                            window.player.showStatus('请下载后用“打开本地文件”播放。', 'success');
                        } else {
                            window.player.showStatus(data.error || '未获取到下载链接。', 'error');
                        }
                    } catch (e) {
                        window.player.showStatus('获取下载链接失败。', 'error');
                    }
                };
            }
        }

        // --- 在线 Demo：默认加载示例字幕与对应 B 站视频（仅本地演示时自动加载） ---
        if (isLocal) {
            const demoBiliUrl = 'https://www.bilibili.com/video/BV1NmyXBTEGD';
            const demoAssName = '2 Minecraft Pros VS 1000 Players.ass';
            const demoAssPath = '/ass_files/' + encodeURIComponent(demoAssName);
            let demoVideoLoaded = false;
            let demoSubtitleLoaded = false;
            let autoPlayed = false;
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
            if (window.player.onlineVideoUrl) {
                window.player.onlineVideoUrl.value = demoBiliUrl;
                const v = window.player.videoPlayer;
                v.addEventListener('canplay', function handler() {
                    v.removeEventListener('canplay', handler);
                    demoVideoLoaded = true;
                    tryAutoPlay();
                });
                window.player.fileHandler.loadOnlineVideo();
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
