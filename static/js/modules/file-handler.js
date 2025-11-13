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
    loadOnlineVideoWithUrl(videoUrl, originalUrl = '', size = null) {
        if (!videoUrl) {
            this.player.showStatus('未提供有效的视频直链。', 'error');
            return;
        }
        console.log('通过直链加载视频：', videoUrl);

        // 先设置播放成功与失败的回调处理器（确保无论哪种加载方式都能触发）
        this.player.videoPlayer.oncanplay = () => {
            this.player.showStatus('视频加载完成，正在播放...', 'success');
            this.player.videoPlayer.play().catch(() => {});
            this.player.updateOnlineVideoInfo(originalUrl || videoUrl);
            // 只有在成功加载播放时才展示下载提示（按照你的需求）
            try {
                this.player.uiController.showDownloadPanel(videoUrl, '视频下载链接', size);
            } catch (e) {
                console.debug('显示下载面板失败:', e);
            }
        };

        this.player.videoPlayer.onerror = () => {
            console.error('加载视频失败，播放不可用；不展示下载链接。');
            this.player.showStatus('无法播放该视频（可能受防盗链或链接签名限制）。', 'error');
        };

        // 如果是 Bilibili/bilivideo 的视频源，优先尝试使用带 Referer 的 fetch -> Blob 回退加载
        let attempted = false;
        try {
            if (videoUrl.includes('bilivideo.com') || videoUrl.includes('upos') || videoUrl.includes('bilibili')) {
                if (typeof this.player.videoParser !== 'undefined' && typeof this.player.videoParser.setupBilibiliVideoHeaders === 'function') {
                    attempted = true;
                    // setupBilibiliVideoHeaders 会处理加载并触发上面的 oncanplay/onerror
                    this.player.videoParser.setupBilibiliVideoHeaders(this.player.videoPlayer, videoUrl);
                }
            }
        } catch (e) {
            console.warn('尝试使用带 Referer 的加载回退失败，退回到直接设置 src', e);
            attempted = false;
        }

        if (!attempted) {
            // 直接设置 src 和加载
            this.player.videoPlayer.src = videoUrl;
            try { this.player.videoPlayer.load(); } catch (e) { console.debug('video.load() 抛出异常', e); }
        }

        // 处理加载成功
        this.player.videoPlayer.oncanplay = () => {
            this.player.showStatus('视频加载完成，正在播放...', 'success');
            this.player.videoPlayer.play().catch(() => {});
            this.player.updateOnlineVideoInfo(originalUrl || videoUrl);
        };

        // 处理加载失败：提示下载（持久显示带手动链接）
        this.player.videoPlayer.onerror = () => {
            console.error('加载视频失败，准备提示下载链接');
            // 使用更人性化的下载面板，包含复制/在新标签打开/强制下载功能，且为持久显示
            this.player.uiController.showDownloadPanel(videoUrl, '视频下载链接');
        };
    }
}
