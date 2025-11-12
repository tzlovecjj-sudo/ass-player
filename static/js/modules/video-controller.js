// 视频控制器模块
export default class VideoController {
    /**
     * 构造函数
     * @param {EmbeddedASSPlayer} player - 播放器主实例的引用
     */
    constructor(player) {
        this.player = player; // 保存对主播放器实例的引用
        this.isPlaying = false; // 视频是否正在播放的状态标志（当前未使用）
        this.currentTime = 0;   // 当前播放时间（当前未使用）
        this.duration = 0;      // 视频总时长（当前未使用）
    }

    // --- 视频控制方法 ---

    /**
     * 切换视频的播放/暂停状态。
     */
    togglePlayPause() {
        if (this.player.videoPlayer.paused) {
            // 如果视频已暂停，则尝试播放
            this.player.videoPlayer.play().then(() => {
                // 播放成功后，启动字幕渲染并更新按钮状态
                this.player.startRendering();
                this.player.updatePlayPauseButton(true);
            }).catch(error => {
                // 捕获并处理播放失败的情况（例如，浏览器策略限制自动播放）
                console.error('视频播放失败:', error);
                this.player.showStatus('播放失败: ' + error.message, 'error');
            });
        } else {
            // 如果视频正在播放，则暂停
            this.player.videoPlayer.pause();
            // 暂停后，停止字幕渲染并更新按钮状态
            this.player.stopRendering();
            this.player.updatePlayPauseButton(false);
        }
    }

    /**
     * 从头开始重新播放视频。
     */
    restartVideo() {
        this.player.videoPlayer.currentTime = 0; // 将播放头重置到 0
        if (this.player.videoPlayer.paused) {
            // 如果视频当前是暂停的，手动启动渲染以显示第一帧的字幕
            this.player.startRendering();
            // 并且尝试播放视频
            this.player.videoPlayer.play();
        }
    }

    /**
     * 跳转到视频的指定时间点。
     * @param {number} time - 要跳转到的时间（秒）
     */
    seekTo(time) {
        this.player.videoPlayer.currentTime = time;
        // 跳转后，如果视频是暂停的，需要手动启动一次渲染来更新字幕
        if (this.player.videoPlayer.paused) {
            this.player.startRendering();
        }
    }

    // --- 时间与进度条更新 ---

    /**
     * 更新详细的当前时间显示（HH:MM:SS.CS）。
     * 注意：此功能可能已被 formatTime 和 updateProgress 取代。
     */
    updateCurrentTime() {
        const time = this.player.videoPlayer.currentTime || 0;
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        const centiseconds = Math.floor((time % 1) * 100);
        
        if (this.player.currentTimeDisplay) {
            this.player.currentTimeDisplay.textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
        }
    }

    /**
     * 更新进度条的显示和当前时间文本。
     */
    updateProgress() {
        // 如果视频总时长未知，或者用户正在拖动进度条，则不更新
        if (!this.player.videoPlayer.duration || this.player.progressController.isSeeking) return;
        
        const progressPercentage = (this.player.videoPlayer.currentTime / this.player.videoPlayer.duration) * 100;
        if (this.player.progress) {
            this.player.progress.style.width = `${progressPercentage}%`;
        }
        
        if (this.player.currentProgressTime) {
            this.player.currentProgressTime.textContent = this.formatTime(this.player.videoPlayer.currentTime);
        }
    }

    /**
     * 更新显示视频总时长的文本。
     */
    updateTotalTime() {
        if (!this.player.videoPlayer.duration) return;
        
        if (this.player.totalTime) {
            this.player.totalTime.textContent = this.formatTime(this.player.videoPlayer.duration);
        }
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

    // --- 视频原生事件处理器 ---

    /**
     * 当视频元数据加载完成时调用。
     */
    onVideoLoaded() {
        console.log('视频元数据已加载。');
        this.player.setupCanvas(); // 根据视频尺寸设置 Canvas 大小
        this.updateTotalTime();    // 更新总时长显示
        this.player.showStatus('视频已加载，可以播放。', 'success');
        
        // 自动播放视频
        this.player.videoPlayer.play().then(() => {
            console.log('视频自动播放成功');
        }).catch(error => {
            console.warn('视频自动播放失败:', error);
            this.player.showStatus('自动播放失败，请手动点击播放按钮', 'warning');
        });
    }

    /**
     * 当视频播放时间更新时调用。
     */
    onTimeUpdate() {
        this.updateCurrentTime(); // 更新详细时间（可能已废弃）
        this.updateProgress();    // 更新进度条
    }

    /**
     * 当视频播放结束时调用。
     */
    onVideoEnded() {
        this.player.stopRendering(); // 停止渲染循环
        this.player.updatePlayPauseButton(false); // 更新按钮为“播放”状态
        this.player.showStatus('视频播放结束。', 'info');
    }

    /**
     * 当视频开始播放时调用（包括从暂停状态恢复）。
     */
    onVideoPlay() {
        this.player.startRendering(); // 启动渲染循环
        this.player.updatePlayPauseButton(true); // 更新按钮为“暂停”状态
    }

    /**
     * 当视频暂停时调用。
     */
    onVideoPause() {
        this.player.stopRendering(); // 停止渲染循环
        this.player.updatePlayPauseButton(false); // 更新按钮为“播放”状态
    }
}
