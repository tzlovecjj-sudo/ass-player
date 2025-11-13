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

        // --- 在线 Demo：默认加载示例字幕与对应 B 站视频 ---
        const demoBiliUrl = 'https://www.bilibili.com/video/BV1NmyXBTEGD';
        const demoAssName = '2 Minecraft Pros VS 1000 Players.ass';
        const demoAssPath = '/ass_files/' + encodeURIComponent(demoAssName);

        // 自动播放协调器（静音以兼容浏览器策略）
        let demoVideoLoaded = false;
        let demoSubtitleLoaded = false;
        let autoPlayed = false;
        function tryAutoPlay() {
            if (demoVideoLoaded && demoSubtitleLoaded && !autoPlayed) {
                autoPlayed = true;
                const v = window.player.videoPlayer;
                if (v) v.muted = true; // 静音，提升自动播放成功率
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

        // 1) 预填并解析在线视频（使用后端解析接口）
        if (window.player.onlineVideoUrl) {
            window.player.onlineVideoUrl.value = demoBiliUrl;
            // 触发解析并加载视频
            // 在 canplay 事件中标记 demoVideoLoaded
            const v = window.player.videoPlayer;
            v.addEventListener('canplay', function handler() {
                v.removeEventListener('canplay', handler);
                demoVideoLoaded = true;
                tryAutoPlay();
            });
            window.player.fileHandler.loadOnlineVideo();
        }

        // 2) 拉取并解析示例字幕
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
    } catch (error) {
        console.error('播放器初始化过程中发生严重错误:', error);
    }
});
