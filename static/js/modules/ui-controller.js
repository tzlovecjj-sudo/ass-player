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
        // 保证容器为相对定位，以便放置绝对定位的关闭按钮
        statusEl.style.position = 'relative';
        statusEl.className = `status ${type}`;
        // 插入消息内容
        statusEl.innerHTML = `<div class="status-content">${message}</div>`;

        // 创建并插入右上角小叉关闭按钮
        let closeBtn = statusEl.querySelector('.status-close');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.className = 'status-close';
            closeBtn.setAttribute('aria-label', '关闭提示');
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '6px';
            closeBtn.style.right = '6px';
            closeBtn.style.border = 'none';
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = '#999';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.fontSize = '14px';
            closeBtn.style.padding = '2px 6px';
            closeBtn.textContent = '✕';
            closeBtn.onclick = () => {
                statusEl.innerHTML = '';
                statusEl.className = 'status';
            };
            statusEl.appendChild(closeBtn);
        }
    }

    /**
     * 显示一个持久的下载面板，包含下载链接、复制按钮、在新标签打开按钮以及关闭按钮。
     * 该面板不会自动消失，用户可手动关闭。
     * @param {string} url - 直接下载地址
     * @param {string} [label] - 可选的友好文件名或说明
     */
    showDownloadPanel(url, label = '', size = null) {
        const elementId = 'uploadStatus';
        const statusEl = document.getElementById(elementId);
        if (!statusEl) {
            console.log('下载链接:', url);
            return;
        }
        statusEl.style.position = 'relative';
        statusEl.className = 'status download-panel';

        // 清空并构建下载面板
        statusEl.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'download-container';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'space-between';
        container.style.gap = '12px';

        const info = document.createElement('div');
        info.className = 'download-info';
        info.style.flex = '1';
        info.style.minWidth = '0';

        const title = document.createElement('div');
        title.innerHTML = label ? `<strong>${this.escapeHtml(label)}</strong>` : `<strong>下载链接已就绪</strong>`;
        title.style.marginBottom = '6px';

        const linkEl = document.createElement('div');
        linkEl.className = 'download-link';
        linkEl.style.overflow = 'hidden';
        linkEl.style.textOverflow = 'ellipsis';
        linkEl.style.whiteSpace = 'nowrap';
        linkEl.title = url;
        linkEl.textContent = url;

        info.appendChild(title);
        info.appendChild(linkEl);

        // 仅显示一个文字超链接（点击下载），并显示文件大小（若可获取）
        const linkAnchor = document.createElement('a');
        linkAnchor.className = 'download-link-a';
        linkAnchor.href = url;
        linkAnchor.target = '_blank';
        linkAnchor.rel = 'noopener';
        linkAnchor.textContent = '点击下载';
        linkAnchor.download = '';
        linkAnchor.style.display = 'inline-block';
        linkAnchor.style.fontSize = '13px';
        linkAnchor.style.color = '#9fc7ff';
        linkAnchor.style.textDecoration = 'underline';
        linkAnchor.title = url;

        // 显示文件大小占位
        const sizeEl = document.createElement('div');
        sizeEl.className = 'download-size';
        sizeEl.style.marginTop = '6px';
        sizeEl.style.fontSize = '12px';
        sizeEl.style.color = '#bfcfe8';
        if (size && typeof size === 'number') {
            sizeEl.textContent = `大小：${this.formatFileSize(size)}`;
        } else {
            sizeEl.textContent = '大小：检测中...';
        }

        // 把链接和大小放入 info 区域
        info.appendChild(linkAnchor);
        info.appendChild(sizeEl);

        container.appendChild(info);

        // 异步尝试获取文件大小（HEAD 或 Range 请求）。注意：可能被 CDN 的 CORS 限制阻止。
        if (!size) {
            (async () => {
                const self = this;
                try {
                    // 优先尝试 HEAD 请求以获取 Content-Length
                    let resp = await fetch(url, { method: 'HEAD' });
                    let s = resp.headers.get('content-length');
                    if (!s) {
                        // 如果 HEAD 没有返回长度，尝试 Range 请求以读取响应头中的 Content-Range
                        resp = await fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-0' } });
                        s = resp.headers.get('content-length') || (resp.headers.get('content-range') ? resp.headers.get('content-range').split('/')[1] : null);
                    }
                    if (s) {
                        const n = parseInt(s, 10);
                        const pretty = self.formatFileSize ? self.formatFileSize(n) : (n ? `${(n / 1024).toFixed(2)} KB` : '未知');
                        sizeEl.textContent = `大小：${pretty}`;
                    } else {
                        sizeEl.textContent = '大小：未知';
                    }
                } catch (e) {
                    // 可能被 CORS 阻止或网络错误
                    sizeEl.textContent = '大小：未知';
                }
            })();
        }

        statusEl.appendChild(container);

        // 创建并插入右上角小叉关闭按钮（复用 showStatus 的样式）
        let closeBtn = statusEl.querySelector('.status-close');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.className = 'status-close';
            closeBtn.setAttribute('aria-label', '关闭提示');
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '6px';
            closeBtn.style.right = '6px';
            closeBtn.style.border = 'none';
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = '#999';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.fontSize = '14px';
            closeBtn.style.padding = '2px 6px';
            closeBtn.textContent = '✕';
            closeBtn.onclick = () => {
                statusEl.innerHTML = '';
                statusEl.className = 'status';
            };
            statusEl.appendChild(closeBtn);
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
