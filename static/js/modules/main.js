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
        // 实例化播放器主类，并将其挂载到 window 对象上，
        // 以便在浏览器的开发者工具中进行调试。
        window.player = new EmbeddedASSPlayer();
        console.log('播放器实例创建成功。');

        // --- 在线 Demo：默认加载示例字幕与对应 B 站视频 ---
        // 示例视频（B 站页面）
        const demoBiliUrl = 'https://www.bilibili.com/video/BV1NmyXBTEGD';
        // 示例字幕（本项目 ass_files 目录）
        const demoAssName = '2 Minecraft Pros VS 1000 Players.ass';
        const demoAssPath = '/ass_files/' + encodeURIComponent(demoAssName);

        // 1) 预填并解析在线视频（使用后端解析接口）
        if (window.player.onlineVideoUrl) {
            window.player.onlineVideoUrl.value = demoBiliUrl;
            // 触发解析并加载视频
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
                // 伪造一个文件对象以复用 UI 更新逻辑
                window.player.updateSubtitleInfo({ name: demoAssName, size: text.length });
                window.player.showStatus('已加载示例字幕。', 'success');
            })
            .catch(err => {
                console.warn('示例字幕加载失败：', err);
                window.player.showStatus('示例字幕加载失败', 'error');
            });
    } catch (error) {
        // 捕获并记录初始化过程中可能发生的任何错误。
        console.error('播放器初始化过程中发生严重错误:', error);
    }
});
