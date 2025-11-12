// 主入口文件（非模块化版本）

/**
 * 当页面的 DOM 内容完全加载并解析完毕后，执行此回调函数。
 * 这是应用程序的启动点。
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 加载完成，开始初始化 ASS 播放器...');
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
