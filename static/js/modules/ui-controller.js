// UI 控制器模块
export default class UIController {
    /**
     * 构造函数
     * @param {EmbeddedASSPlayer} player - 播放器主实例的引用
     */
    constructor(player) {
        this.player = player; // 保存对主播放器实例的引用
    }

    // --- UI 状态更新 ---

    /**
     * 根据播放状态更新播放/暂停按钮的图标和标题。
     * @param {boolean} isPlaying - 视频是否正在播放
     */
    updatePlayPauseButton(isPlaying) {
        if (this.player.playPauseBtn) {
            this.player.playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️'; // 使用 emoji 作为图标
            this.player.playPauseBtn.title = isPlaying ? '暂停' : '播放';
        }
    }

    /**
     * 更新界面上显示的本地视频文件信息。
     * @param {File} file - 加载的视频文件对象
     */
    updateVideoInfo(file) {
        const videoInfo = document.getElementById('videoInfo');
        if (videoInfo) {
            videoInfo.textContent = `视频文件: ${file.name} (${this.formatFileSize(file.size)})`;
        }
    }

    /**
     * 更新界面上显示的字幕文件信息。
     * @param {File} file - 加载的字幕文件对象
     */
    updateSubtitleInfo(file) {
        const subtitleInfo = document.getElementById('subtitleInfo');
        if (subtitleInfo) {
            subtitleInfo.textContent = 
                `字幕文件: ${file.name} (${this.formatFileSize(file.size)}) | ${this.player.subtitles.length} 条对话, ${Object.keys(this.player.styles).length} 种样式`;
        }
    }

    /**
     * 更新界面上显示的在线视频信息。
     * @param {string} url - 加载的在线视频 URL
     */
    updateOnlineVideoInfo(url) {
        const videoInfo = document.getElementById('videoInfo');
        if (videoInfo) {
            // 使用正确的HTML结构，确保URL能够正确换行和省略
            videoInfo.innerHTML = `
                <div class="file-info-item">
                    <span class="file-info-label">视频文件:</span>
                    <span class="file-info-value">在线视频</span>
                </div>
                <div class="file-info-item">
                    <span class="file-info-label">URL:</span>
                    <span class="file-info-value">${this.escapeHtml(url)}</span>
                </div>
                <div class="file-info-item">
                    <span class="file-info-label">时长:</span>
                    <span class="file-info-value">-</span>
                </div>
            `;
        }
    }

    // --- 状态消息显示 ---

    /**
     * 在指定元素上显示一条状态消息，并在几秒后自动消失。
     * @param {string} message - 要显示的消息内容
     * @param {'success'|'error'|'info'} type - 消息类型，用于应用不同的 CSS 样式
     * @param {string} [elementId='uploadStatus'] - 用于显示消息的 DOM 元素的 ID
     */
    showStatus(message, type, elementId = 'uploadStatus') {
        const statusEl = document.getElementById(elementId);
        if (!statusEl) {
            console.log(`状态 [${type}]: ${message}`);
            return;
        }
        // 支持 HTML 内容
        statusEl.innerHTML = `<span>${message}</span><button id="closeStatusBtn" style="margin-left:10px;">关闭</button>`;
        statusEl.className = `status ${type}`;
        // 绑定关闭按钮
        const closeBtn = document.getElementById('closeStatusBtn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                statusEl.innerHTML = '';
                statusEl.className = 'status';
            };
        }
    }

    // --- 工具方法 ---

    /**
     * 将文件大小（字节）格式化为更易读的字符串（如 KB, MB）。
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} 格式化后的文件大小字符串
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 对文本进行 HTML 转义，以防止 XSS 攻击，并确保文本在 HTML 中正确显示。
     * @param {string} text - 原始文本字符串
     * @returns {string} HTML 转义后的字符串
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text; // 将文本设置为 div 的 textContent，浏览器会自动转义特殊字符
        return div.innerHTML;   // 获取转义后的 HTML 字符串
    }

    // --- Canvas 尺寸设置 ---

    /**
     * 根据视频的原始尺寸和容器的当前尺寸，设置 Canvas 的大小和样式，以实现正确的缩放和居中。
     */
    setupCanvas() {
        // 确保视频的尺寸信息已经加载
        if (!this.player.videoPlayer.videoWidth || !this.player.videoPlayer.videoHeight) {
            console.warn('视频尺寸信息尚未准备好，100ms 后重试...');
            setTimeout(() => this.setupCanvas(), 100);
            return;
        }
        
        console.log(`开始设置 Canvas 尺寸，视频原始尺寸: ${this.player.videoPlayer.videoWidth}x${this.player.videoPlayer.videoHeight}`);
        
        // 1. 设置 Canvas 的绘图表面尺寸与视频原始尺寸一致，确保字幕渲染的清晰度
        this.player.videoCanvas.width = this.player.videoPlayer.videoWidth;
        this.player.videoCanvas.height = this.player.videoPlayer.videoHeight;
        
        // 2. 计算并设置 Canvas 的 CSS 显示尺寸，使其在保持宽高比的同时适应父容器
        const container = this.player.videoCanvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const videoAspectRatio = this.player.videoPlayer.videoWidth / this.player.videoPlayer.videoHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        if (containerAspectRatio > videoAspectRatio) {
            // 容器比视频更“宽”，因此以容器高度为基准进行缩放
            this.player.videoCanvas.style.height = '100%';
            this.player.videoCanvas.style.width = 'auto';
        } else {
            // 容器比视频更“高”，因此以容器宽度为基准进行缩放
            this.player.videoCanvas.style.width = '100%';
            this.player.videoCanvas.style.height = 'auto';
        }
        
        console.log('Canvas 尺寸设置完成。');
    }

    /**
     * 当浏览器窗口大小改变时调用的事件处理器。
     */
    onWindowResize() {
        // 只有在视频已经加载（有尺寸信息）的情况下，才重新计算 Canvas 尺寸
        if (this.player.videoPlayer.videoWidth && this.player.videoPlayer.videoHeight) {
            this.setupCanvas();
        }
    }
}
