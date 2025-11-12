// 进度条控制器模块
export default class ProgressController {
    /**
     * 构造函数
     * @param {EmbeddedASSPlayer} player - 播放器主实例的引用
     */
    constructor(player) {
        this.player = player; // 保存对主播放器实例的引用
        this.isSeeking = false; // 标志，指示用户是否正在拖动进度条
    }

    // --- 进度条控制方法 ---

    /**
     * 开始拖动进度条。
     * @param {MouseEvent} e - 鼠标事件对象
     */
    startSeeking(e) {
        this.isSeeking = true; // 设置拖动状态为 true
        this.handleProgressClick(e); // 立即处理点击位置，更新视频时间
    }

    /**
     * 处理拖动进度条时的鼠标移动事件。
     * @param {MouseEvent} e - 鼠标事件对象
     */
    handleSeeking(e) {
        // 只有在正在拖动时才处理
        if (this.isSeeking) {
            this.handleProgressClick(e);
        }
    }

    /**
     * 停止拖动进度条。
     */
    stopSeeking() {
        this.isSeeking = false; // 设置拖动状态为 false
    }

    /**
     * 根据鼠标点击或拖动的位置更新视频播放时间。
     * @param {MouseEvent} e - 鼠标事件对象
     */
    handleProgressClick(e) {
        // 如果视频总时长未知，则不进行处理
        if (!this.player.videoPlayer.duration) return;
        
        // 获取进度条容器的尺寸和位置
        const rect = this.player.progressBar.getBoundingClientRect();
        // 计算鼠标点击位置相对于进度条的百分比 (0 到 1)
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        // 根据百分比计算出对应的视频时间
        const time = percent * this.player.videoPlayer.duration;
        
        // 更新视频播放时间
        this.player.videoPlayer.currentTime = time;
        // 更新进度条的视觉宽度
        if (this.player.progress) {
            this.player.progress.style.width = `${percent * 100}%`;
        }
        
        // 更新当前时间显示文本
        if (this.player.currentProgressTime) {
            this.player.currentProgressTime.textContent = this.formatTime(time);
        }
        
        // 强制启动一次渲染，以确保字幕在跳转后立即更新
        this.player.startRendering();
    }

    /**
     * 将秒数格式化为 HH:MM:SS 的字符串格式。
     * @param {number} seconds - 总秒数
     * @returns {string} 格式化后的时间字符串
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}
