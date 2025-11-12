// 进度条控制器模块
export default class ProgressController {
    constructor(player) {
        this.player = player;
        this.isSeeking = false;
    }

    // 进度条控制
    startSeeking(e) {
        this.isSeeking = true;
        this.handleProgressClick(e);
    }

    handleSeeking(e) {
        this.handleProgressClick(e);
    }

    stopSeeking() {
        this.isSeeking = false;
    }

    handleProgressClick(e) {
        if (!this.player.videoPlayer.duration) return;
        
        const rect = this.player.progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * this.player.videoPlayer.duration;
        
        this.player.videoPlayer.currentTime = time;
        if (this.player.progress) {
            this.player.progress.style.width = `${percent * 100}%`;
        }
        
        if (this.player.currentProgressTime) {
            this.player.currentProgressTime.textContent = this.formatTime(time);
        }
        
        this.player.startRendering();
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}