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

    // 不再主动尝试通过 HEAD/Range 请求获取远端文件大小（避免阻塞）
        if (size && typeof size === 'number') {
            sizeEl.textContent = `大小：${this.formatFileSize(size)}`;
        } else {
            sizeEl.textContent = '大小：未知';
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

        // 清理页面中可能重复存在的当前时间 DOM（有时因为旧模板或 artifact 被直接打开会出现重复）
        try {
            const timeEls = document.querySelectorAll('#currentTime');
            if (timeEls && timeEls.length > 1) {
                console.debug('[UI] 检测到多个 #currentTime 元素，保留第一个并移除其余');
                for (let i = 1; i < timeEls.length; i++) {
                    try { timeEls[i].remove(); } catch (e) {}
                }
            }
        } catch (e) {
            // 忽略清理失败
        }
        
        console.log(`开始设置 Canvas 尺寸，视频原始尺寸: ${this.player.videoPlayer.videoWidth}x${this.player.videoPlayer.videoHeight}`);
        
        // 1. 先根据视频自然尺寸和容器计算出 CSS 显示尺寸（逻辑像素）
        const container = this.player.videoCanvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const videoAspectRatio = this.player.videoPlayer.videoWidth / this.player.videoPlayer.videoHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        // 根据 fullscreen 或容器宽高比决定 CSS 展示行为（与之前逻辑保持一致）
        const isWebFs = document.body.classList && document.body.classList.contains('web-fullscreen-mode');
        const isBrowserFs = document.body.classList && document.body.classList.contains('browser-fullscreen-mode');
        if (isWebFs || isBrowserFs) {
            this.player.videoCanvas.style.height = '100%';
            this.player.videoCanvas.style.width = 'auto';
        } else if (containerAspectRatio > videoAspectRatio) {
            this.player.videoCanvas.style.height = '100%';
            this.player.videoCanvas.style.width = 'auto';
        } else {
            this.player.videoCanvas.style.width = '100%';
            this.player.videoCanvas.style.height = 'auto';
        }

        // 2. 等待浏览器把 CSS 尺寸计算好（clientWidth/clientHeight），然后基于 CSS 尺寸和 devicePixelRatio 设置内部像素尺寸
        //    这样能保证绘制时的逻辑坐标以 CSS 像素为单位，且内部像素被乘以 DPR 以保证清晰度。
        // 获取最终的 CSS 显示尺寸
        const cssWidth = Math.max(1, this.player.videoCanvas.clientWidth);
        const cssHeight = Math.max(1, this.player.videoCanvas.clientHeight);
        const dpr = window.devicePixelRatio || 1;

        // 设置内部像素尺寸为 CSS 尺寸 * DPR
        this.player.videoCanvas.width = Math.max(1, Math.round(cssWidth * dpr));
        this.player.videoCanvas.height = Math.max(1, Math.round(cssHeight * dpr));
        // 强制把 canvas 的 CSS 显示尺寸锁定为我们计算的逻辑像素尺寸（避免样式表或百分比导致的二次缩放）
        try {
            this.player.videoCanvas.style.width = cssWidth + 'px';
            this.player.videoCanvas.style.height = cssHeight + 'px';
        } catch (e) {
            // 忽略在某些受限环境中设置样式可能失败的情况
        }

        // 将上下文变换为以 CSS 像素为单位的坐标系（ctx 以逻辑像素工作）
        const ctx = this.player.videoCanvas.getContext('2d');
        // 先重置变换，确保没有遗留的 transform
        try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch (e) {}
        // 应用 DPR 缩放
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.player.ctx = ctx; // 确保 player.ctx 指向新的 context（或已调整的 context）

        // 记录 DPR 与逻辑尺寸，供渲染器使用
        this.player.dpr = dpr;
        this.player.logicalCanvasWidth = cssWidth;
        this.player.logicalCanvasHeight = cssHeight;

        // 输出调试信息，便于排查 CSS 尺寸与内部像素是否一致
        console.log('Canvas 尺寸设置完成 (css:', cssWidth + 'x' + cssHeight, ', computed client:', this.player.videoCanvas.clientWidth + 'x' + this.player.videoCanvas.clientHeight, ', internal:', this.player.videoCanvas.width + 'x' + this.player.videoCanvas.height, ', dpr:', dpr, ').');
        // 如果计算的 client 与实际 client 有明显偏差，给出提示
        try {
            const clientW = this.player.videoCanvas.clientWidth;
            const clientH = this.player.videoCanvas.clientHeight;
            if (Math.abs(clientW - cssWidth) > 1 || Math.abs(clientH - cssHeight) > 1) {
                console.warn('警告：canvas CSS 尺寸与预期不匹配 (预期 cssWidth/cssHeight 与实际 clientWidth/clientHeight 差异较大)，这可能导致绘制缩放异常。', {cssWidth, cssHeight, clientW, clientH});
            }
        } catch (e) {
            // 忽略调试检查错误
        }

        // 如果存在紧凑的字体缩放控件且用户没有显式保存过缩放值，自动根据 PlayResY 建议一个默认缩放
        try {
            const popup = document.getElementById('fontScalePopup');
                if (popup && this.player.playResY) {
                    // 优先使用视频自然高度（videoHeight）作为建议缩放，回退到 CSS 显示高度
                    const videoH = (this.player.videoPlayer && this.player.videoPlayer.videoHeight) ? this.player.videoPlayer.videoHeight : null;
                    const base = videoH || cssHeight;
                    const suggested = Math.max(0.5, Math.min(2.0, base / this.player.playResY));
                    console.debug('[FontScale] setupCanvas suggested', { base, cssHeight, videoNaturalHeight: videoH, playResY: this.player.playResY, suggested });
                    const slider = popup.querySelector('input[type="range"]');
                    if (slider) {
                        slider.value = suggested.toString();
                        // 触发 input 事件让控件应用该值
                        try { slider.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { }
                    }
            }
        } catch (e) {
            // 忽略本步可能的错误
        }
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

    /**
    * 在播放器控制栏中创建一个字体缩放滑块，允许用户调整字幕渲染的缩放系数。
    * 值域：0.5 - 2.0，步进 0.05，默认 1.0。该值为会话级别（不再在刷新或新视频时自动复用上一次的值）。
     */
    createFontScaleControl() {
        try {
            // 小图标 + 弹出滑块的实现：将图标插入到静音按钮左侧
            if (document.getElementById('fontScaleIcon')) return; // 已存在则跳过

            const controlsRight = document.querySelector('.controls .controls-right');
            if (!controlsRight) return;

            // 确保容器为相对定位，以便弹出框使用绝对定位
            if (getComputedStyle(controlsRight).position === 'static') {
                controlsRight.style.position = 'relative';
            }

            const muteBtn = controlsRight.querySelector('#muteBtn');

            // 图标按钮（紧凑）
            const iconBtn = document.createElement('button');
            iconBtn.id = 'fontScaleIcon';
            iconBtn.title = '字幕缩放';
            iconBtn.type = 'button';
            iconBtn.style.width = '30px';
            iconBtn.style.height = '28px';
            iconBtn.style.padding = '2px';
            iconBtn.style.marginRight = '6px';
            iconBtn.style.border = 'none';
            iconBtn.style.background = 'transparent';
            iconBtn.style.color = '#dfe8f8';
            iconBtn.style.cursor = 'pointer';
            iconBtn.style.fontSize = '14px';
            iconBtn.innerText = 'A↕';

            // 弹出框（默认隐藏）
            const popup = document.createElement('div');
            popup.id = 'fontScalePopup';
            popup.style.position = 'absolute';
            popup.style.bottom = '36px';
            popup.style.right = (muteBtn ? (muteBtn.offsetWidth + 8) + 'px' : '0px');
            popup.style.padding = '8px';
            popup.style.background = 'rgba(10,12,16,0.95)';
            popup.style.border = '1px solid rgba(255,255,255,0.06)';
            popup.style.borderRadius = '6px';
            popup.style.display = 'none';
            popup.style.zIndex = '9999';
            popup.style.minWidth = '140px';
            popup.style.boxShadow = '0 6px 18px rgba(0,0,0,0.5)';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0.5';
            slider.max = '2.0';
            slider.step = '0.05';
            // 优先使用 localStorage 中保存的值；否则尝试根据当前 canvas 逻辑高度与 ASS 的 PlayResY 建议一个默认值
                // 优先使用视频自然高度来计算建议缩放（视频加载完成时），回退到 canvas 的逻辑高度
                const videoH = (this.player.videoPlayer && this.player.videoPlayer.videoHeight) ? this.player.videoPlayer.videoHeight : null;
                if (videoH && this.player.playResY) {
                    const suggested = Math.max(0.5, Math.min(2.0, videoH / this.player.playResY));
                    slider.value = suggested.toString();
                    console.debug('[FontScale] init: suggested from video naturalHeight/playResY', { videoNaturalHeight: videoH, playResY: this.player.playResY, suggested });
                } else if (this.player.logicalCanvasHeight && this.player.playResY) {
                    const suggested = Math.max(0.5, Math.min(2.0, this.player.logicalCanvasHeight / this.player.playResY));
                    slider.value = suggested.toString();
                    console.debug('[FontScale] init: suggested from logicalCanvasHeight/playResY', { logicalCanvasHeight: this.player.logicalCanvasHeight, playResY: this.player.playResY, suggested });
                } else {
                    slider.value = (this.player.fontScale || 1.0).toString();
                    console.debug('[FontScale] init: fallback to player.fontScale', slider.value);
                }
            slider.style.width = '100%';

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';

            const valLabel = document.createElement('div');
            valLabel.style.color = '#9fc7ff';
            valLabel.style.fontSize = '12px';
            valLabel.textContent = (parseFloat(slider.value) * 100).toFixed(0) + '%';

            const resetIcon = document.createElement('button');
            resetIcon.type = 'button';
            resetIcon.title = '重置为100%';
            resetIcon.style.border = 'none';
            resetIcon.style.background = 'transparent';
            resetIcon.style.color = '#dfe8f8';
            resetIcon.style.cursor = 'pointer';
            resetIcon.style.fontSize = '14px';
            resetIcon.textContent = '⟲';

            row.appendChild(valLabel);
            row.appendChild(resetIcon);

            popup.appendChild(slider);
            popup.appendChild(row);

            // 插入 icon（在 muteBtn 左侧）
            if (muteBtn && muteBtn.parentElement) {
                muteBtn.parentElement.insertBefore(iconBtn, muteBtn);
            } else {
                controlsRight.appendChild(iconBtn);
            }
            controlsRight.appendChild(popup);

            const applyScale = (v) => {
                const scale = parseFloat(v) || 1.0;
                this.player.fontScale = scale;
                // 不再持久化到 localStorage，避免刷新/新视频时复用上次的值
                try { if (this.player.textMetricsCache && typeof this.player.textMetricsCache.clear === 'function') this.player.textMetricsCache.clear(); } catch (e) {}
                try { if (this.player.subtitleRenderer) this.player.subtitleRenderer.renderVideoWithSubtitles(); } catch (e) {}
                valLabel.textContent = (scale * 100).toFixed(0) + '%';
            };

            slider.addEventListener('input', (e) => {
                applyScale(e.target.value);
            });

            resetIcon.addEventListener('click', () => {
                slider.value = '1.0';
                applyScale('1.0');
            });

            // 切换弹出框显示
            iconBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popup.style.display = (popup.style.display === 'none') ? 'block' : 'none';
            });

            // 点击外部时关闭弹出框
            document.addEventListener('click', (ev) => {
                if (!popup.contains(ev.target) && ev.target !== iconBtn) {
                    popup.style.display = 'none';
                }
            });

            // 初始化应用当前值
            applyScale(slider.value);
        } catch (e) {
            console.debug('创建紧凑字体缩放控件失败：', e);
        }
    }
}
