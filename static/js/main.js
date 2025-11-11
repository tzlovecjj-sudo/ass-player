// 主入口文件 - 非模块化版本

// 初始化播放器
document.addEventListener('DOMContentLoaded', () => {
    console.log('初始化ASS播放器...');
    try {
        window.player = new EmbeddedASSPlayer();
        console.log('播放器初始化成功');
    } catch (error) {
        console.error('播放器初始化失败:', error);
    }
});