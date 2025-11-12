// UI控制器模块
export default class UIController {
    constructor(player) {
        this.player = player;
    }

    // 更新UI状态
    updatePlayPauseButton(isPlaying) {
        if (this.player.playPauseBtn) {
            this.player.playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
            this.player.playPauseBtn.title = isPlaying ? '暂停' : '播放';
        }
    }

    updateVideoInfo(file) {
        const videoInfo = document.getElementById('videoInfo');
        if (videoInfo) {
            videoInfo.textContent = `视频文件: ${file.name} (${this.formatFileSize(file.size)})`;
        }
    }

    updateSubtitleInfo(file) {
        const subtitleInfo = document.getElementById('subtitleInfo');
        if (subtitleInfo) {
            subtitleInfo.textContent = 
                `字幕文件: ${file.name} (${this.formatFileSize(file.size)}) - ${this.player.subtitles.length} 条字幕, ${Object.keys(this.player.styles).length} 种样式`;
        }
    }

    updateOnlineVideoInfo(url) {
        const videoInfo = document.getElementById('videoInfo');
        if (videoInfo) {
            videoInfo.textContent = `在线视频: ${url} (使用内置代理)`;
        }
    }

    // 状态显示
    showStatus(message, type, elementId = 'uploadStatus') {
        const statusEl = document.getElementById(elementId);
        if (!statusEl) {
            console.log(`状态: ${message} (${type})`);
            return;
        }
        
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status';
        }, 5000);
    }

    // 工具方法
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Canvas设置
    setupCanvas() {
        if (!this.player.videoPlayer.videoWidth || !this.player.videoPlayer.videoHeight) {
            console.log('视频尺寸未就绪，稍后重试');
            setTimeout(() => this.setupCanvas(), 100);
            return;
        }
        
        console.log('设置Canvas尺寸:', this.player.videoPlayer.videoWidth, 'x', this.player.videoPlayer.videoHeight);
        
        // 设置Canvas尺寸与视频相同
        this.player.videoCanvas.width = this.player.videoPlayer.videoWidth;
        this.player.videoCanvas.height = this.player.videoPlayer.videoHeight;
        
        // 设置Canvas显示尺寸（保持比例）
        const container = this.player.videoCanvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const videoRatio = this.player.videoPlayer.videoHeight / this.player.videoPlayer.videoWidth;
        const containerRatio = containerHeight / containerWidth;
        
        if (containerRatio > videoRatio) {
            // 容器高度相对较大，宽度占满
            this.player.videoCanvas.style.width = '100%';
            this.player.videoCanvas.style.height = (containerWidth * videoRatio) + 'px';
        } else {
            // 容器宽度相对较大，高度占满
            this.player.videoCanvas.style.height = '100%';
            this.player.videoCanvas.style.width = (containerHeight / videoRatio) + 'px';
        }
        
        console.log('Canvas设置完成');
    }

    // 窗口大小改变处理
    onWindowResize() {
        if (this.player.videoPlayer.videoWidth && this.player.videoPlayer.videoHeight) {
            this.setupCanvas();
        }
    }
}