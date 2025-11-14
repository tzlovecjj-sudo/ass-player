// 文件处理模块
export default class FileHandler {
    /**
     * 构造函数
     * @param {EmbeddedASSPlayer} player - 播放器主实例的引用
     */
    constructor(player) {
        this.player = player; // 保存对主播放器实例的引用
    }
 
    

    /**
     * 加载未获取到下载链接。本地视频文件。
     * @param {File} file - 用户通过文件输入选择的视频文件
     */
    loadVideo(file) {
        if (!file) {
            console.warn('未选择任何视频文件。');
            return;
        }
        
        console.log(`开始加载视频文件: ${file.name}, 类型: ${file.type}`);
        
        // 简单验证文件 MIME 类型是否为视频
        if (!file.type.startsWith('video/')) {
            this.player.showStatus('请选择一个有效的视频文件。', 'error');
            return;
        }
        
        // 使用 URL.createObjectURL 为本地文件创建一个临时的 URL
        const videoUrl = URL.createObjectURL(file);
        console.log('创建的本地视频对象 URL:', videoUrl);
        
        // 将视频播放器的源设置为这个 URL
        this.player.videoPlayer.src = videoUrl;
        this.player.videoPlayer.load(); // 指示播放器加载新的源
        
        // 更新 UI 上的文件信息
        this.player.updateVideoInfo(file);
        
        this.player.showStatus('视频文件加载成功。', 'success');
        
        // 设置焦点到播放按钮，避免空格键弹出文件选择框
        if (this.player.playPauseBtn) {
            this.player.playPauseBtn.focus();
        }
    }

    /**
     * 加载并解析本地 ASS 字幕文件。
     * @param {File} file - 用户通过文件输入选择的字幕文件
     */
    loadSubtitles(file) {
        if (!file) return;
        
        console.log(`开始加载字幕文件: ${file.name}`);
        
        // 验证文件扩展名是否为 .ass
        if (!file.name.toLowerCase().endsWith('.ass')) {
            this.player.showStatus('请选择一个 .ass 格式的字幕文件。', 'error');
            return;
        }
        
        const reader = new FileReader();
        
        // 文件读取成功后的回调
        reader.onload = (e) => {
            try {
                // 调用字幕渲染器来解析 ASS 文件内容
                this.player.subtitleRenderer.parseASSFile(e.target.result);
                // 更新 UI 上的字幕信息
                this.player.updateSubtitleInfo(file);
                this.player.showStatus('字幕文件解析成功。', 'success');
                console.log(`字幕解析完成: ${this.player.subtitles.length} 条对话, ${Object.keys(this.player.styles).length} 种样式。`);
                
                // 设置焦点到播放按钮，避免空格键弹出文件选择框
                if (this.player.playPauseBtn) {
                    this.player.playPauseBtn.focus();
                }
            } catch (error) {
                // 处理 ASS 解析过程中可能发生的错误
                this.player.showStatus(`字幕文件解析失败: ${error.message}`, 'error');
                console.error('ASS 解析时发生错误:', error);
            }
        };
        
        // 文件读取失败的回调
        reader.onerror = () => {
            this.player.showStatus('读取字幕文件时发生错误。', 'error');
        };
        
        // 以 UTF-8 编码读取文件内容
        reader.readAsText(file, 'utf-8');
    }

    /**
     * 加载在线视频 URL。
     * 它会通过后端的 API 来解析 Bilibili 等网站的 URL 以获取直接播放地址。
     */
    loadOnlineVideo() {
        // 该方法已被上层逻辑替换为先调用后端 /api/auto-parse，再调用 loadOnlineVideoWithUrl
        // 为兼容性保留老逻辑：尝试使用 videoParser 解析并加载
        const url = this.player.onlineVideoUrl.value.trim();
        if (!url) {
            this.player.showStatus('请输入有效的视频 URL。', 'error');
            return;
        }
        this.player.showStatus('正在解析视频链接...', 'info');
        this.player.videoParser.parseVideo(url)
            .then(videoUrl => {
                if (!videoUrl) return;
                this.loadOnlineVideoWithUrl(videoUrl, url);
            })
            .catch(error => {
                console.error('视频解析或加载失败:', error);
                this.player.showStatus(`链接解析失败: ${error.message || error}`, 'error');
            });
    }

    /**
     * 直接使用已解析出的直链加载视频，并在加载失败时提示下载链接（持久显示）。
     * @param {string} videoUrl - 直接播放的直链
     * @param {string} originalUrl - 原始用户输入的 URL（用于更新 UI）
     */
    loadOnlineVideoWithUrl(videoUrl, originalUrl = '', size = null, parseStartTime = null) {
        if (!videoUrl) {
            this.player.showStatus('未提供有效的视频直链。', 'error');
            return;
        }
        // 后端已返回直链：立即把直链设置到播放器并尝试播放，同时展示下载面板供用户下载/打开
        try {
            // 更新 UI 上的在线视频信息（显示原始 URL 或直链）
            this.player.updateOnlineVideoInfo(originalUrl || videoUrl);
        } catch (e) {
            console.debug('更新在线视频信息失败：', e);
        }

        // 1) 尝试把直链放到播放器上（不做任何自定义请求头或 fetch 回退）
        try {
            console.log('设置播放器直链并尝试加载播放：', videoUrl);
            this.player.videoPlayer.src = videoUrl;
            try { this.player.videoPlayer.load(); } catch (e) { console.debug('video.load() 抛出异常', e); }
            // 尝试自动播放（若浏览器阻止自动播放，将由浏览器策略决定）
            this.player.videoPlayer.play().catch((e) => { console.debug('自动 play() 被阻止或失败：', e); });
        } catch (e) {
            console.debug('将直链设置到播放器时出错：', e);
        }

        // 2) 如果前端提供了解析开始时间（parseStartTime），则监听播放成功事件并上报至后端
        try {
            if (parseStartTime && typeof parseStartTime === 'number') {
                const videoEl = this.player.videoPlayer;
                let reported = false;
                // 使用后端注入的配置（如果存在），否则回退到默认值
                const REPORT_TIMEOUT_MS = (typeof window !== 'undefined' && window.ASS_PLAYER_CONFIG && window.ASS_PLAYER_CONFIG.REPORT_TIMEOUT_MS) ?
                    Number(window.ASS_PLAYER_CONFIG.REPORT_TIMEOUT_MS) : 3000;
                const report = (eventName) => {
                    if (reported) return;
                    reported = true;
                    try {
                        let elapsed;
                        if (eventName === 'timeout') {
                            // 使用固定超时值以避免小范围计时差异影响统计
                            elapsed = Math.round(REPORT_TIMEOUT_MS);
                        } else {
                            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                            elapsed = Math.round(now - parseStartTime);
                        }
                        // 从 videoUrl 中提取 hostname
                        let hostname = '';
                        try { hostname = (new URL(videoUrl)).hostname; } catch (e) { hostname = '' + videoUrl; }
                        const payload = JSON.stringify({ hostname: hostname, load_ms: elapsed, event: eventName });
                        // 使用 sendBeacon 以在页面卸载时仍尽量发送成功
                        if (navigator && navigator.sendBeacon) {
                            const blob = new Blob([payload], { type: 'application/json' });
                            navigator.sendBeacon('/api/report-cdn', blob);
                        } else {
                            // 退回到 fetch，使用 keepalive 以提高成功率
                            try { fetch('/api/report-cdn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }); } catch (e) { /* 忽略 */ }
                        }
                    } catch (e) {
                        console.debug('上报 CDN 统计失败：', e);
                    }
                    // 移除事件监听
                    try { videoEl.removeEventListener('playing', onPlaying); } catch (e) {}
                    try { videoEl.removeEventListener('canplay', onCanplay); } catch (e) {}
                    try { clearTimeout(timeoutId); } catch (e) {}
                };

                const onPlaying = () => report('playing');
                const onCanplay = () => report('canplay');
                // 超时回退：若在 15s 内都未收到播放事件，则放弃
                const timeoutId = setTimeout(() => report('timeout'), 15000);
                videoEl.addEventListener('playing', onPlaying, { once: true });
                videoEl.addEventListener('canplay', onCanplay, { once: true });
            }
        } catch (e) {
            console.debug('设置播放上报监听时出错：', e);
        }

        // 2) 同时展示下载面板（始终可见，供手动下载或在新标签打开）
        try {
            this.player.uiController.showDownloadPanel(videoUrl, '视频下载链接', size);
            this.player.showStatus('已获取视频直链，已设置播放器并展示下载链接。', 'success');
        } catch (e) {
            console.error('展示下载面板失败：', e);
            // 兜底：在状态栏显示直链文本
            this.player.showStatus(`已获取视频直链： ${videoUrl}`, 'info');
        }
    }
}
