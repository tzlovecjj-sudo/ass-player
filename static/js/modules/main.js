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
    } catch (error) {
        // 捕获并记录初始化过程中可能发生的任何错误。
        console.error('播放器初始化过程中发生严重错误:', error);
    }
});
