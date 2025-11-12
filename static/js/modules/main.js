// 模块化入口文件
import EmbeddedASSPlayer from '../ass-player.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化ASS播放器 (模块化版本)...');
    try {
        window.player = new EmbeddedASSPlayer();
        console.log('播放器初始化成功');
    } catch (error) {
        console.error('播放器初始化失败:', error);
    }
});