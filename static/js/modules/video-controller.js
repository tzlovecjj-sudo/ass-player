// 视频控制器模块
export default class VideoController {
    constructor(player) {
        this.player = player;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
    }

    // 视频控制方法
    togglePlayPause() {
        if (this.player.videoPlayer.paused) {
            this.player.videoPlayer.play().then(() => {
                this.player.startRendering();
                this.player.updatePlayPauseButton(true);
            }).catch(error => {
                console.error('播放失败:', error);
                this.player.showStatus('播放失败: ' + error.message, 'error');
            });
        } else {
            this.player.videoPlayer.pause();
            this.player.stopRendering();
            this.player.updatePlayPauseButton(false);
        }
    }

    restartVideo() {
        this.player.videoPlayer.currentTime = 0;
        if (this.player.videoPlayer.paused) {
            this.player.startRendering();
            this.player.updatePlayPauseButton(true);
        }
    }

    seekTo(time) {
        this.player.videoPlayer.currentTime = time;
        this.player.startRendering();
    }

    // 时间相关方法
    updateCurrentTime() {
        const time = this.player.videoPlayer.currentTime || 0;
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        const cs = Math.floor((time % 1) * 100);
        
        if (this.player.currentTimeDisplay) {
            this.player.currentTimeDisplay.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
        }
    }

    updateProgress() {
        if (!this.player.videoPlayer.duration || this.player.isSeeking) return;
        
        const progress = (this.player.videoPlayer.currentTime / this.player.videoPlayer.duration) * 100;
        if (this.player.progress) {
            this.player.progress.style.width = `${progress}%`;
        }
        
        if (this.player.currentProgressTime) {
            this.player.currentProgressTime.textContent = this.formatTime(this.player.videoPlayer.currentTime);
        }
    }

    updateTotalTime() {
        if (!this.player.videoPlayer.duration) return;
        
        if (this.player.totalTime) {
            this.player.totalTime.textContent = this.formatTime(this.player.videoPlayer.duration);
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 视频事件处理
    onVideoLoaded() {
        console.log('视频元数据已加载');
        this.player.setupCanvas();
        this.updateTotalTime();
        this.player.showStatus('视频已加载，可以开始播放', 'success');
    }

    onTimeUpdate() {
        this.updateCurrentTime();
        this.updateProgress();
    }

    onVideoEnded() {
        this.player.stopRendering();
        this.player.updatePlayPauseButton(false);
        this.player.showStatus('视频播放结束', 'info');
    }

    onVideoPlay() {
        this.player.startRendering();
        this.player.updatePlayPauseButton(true);
    }

    onVideoPause() {
        this.player.stopRendering();
        this.player.updatePlayPauseButton(false);
    }
}