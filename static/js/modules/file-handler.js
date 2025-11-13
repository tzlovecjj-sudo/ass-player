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
     * 加载本地视频文件。
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
        const url = this.player.onlineVideoUrl.value.trim();
        if (!url) {
            this.player.showStatus('请输入有效的视频 URL。', 'error');
            return;
        }

        this.player.showStatus('正在解析视频链接...', 'info');

        // 调用 videoParser（后端 /api/auto-parse 接口）来解析 URL
        this.player.videoParser.parseVideo(url)
            .then(videoUrl => {
                if (!videoUrl) return; // 如果未返回可用直链，说明已提示用户
                console.log('✅ 视频链接解析成功:', videoUrl);
                this.player.showStatus('链接解析成功，正在加载视频...', 'success');
                this.player.videoPlayer.src = videoUrl;
                this.player.videoPlayer.load();
                this.player.videoPlayer.onerror = () => {
                    console.error('❌ 加载解析后的视频失败。');
                    this.player.showStatus('视频加载失败，可能是链接已过期或跨域问题。', 'error');
                };
                this.player.videoPlayer.oncanplay = () => {
                    console.log('✅ 视频已准备好，可以播放。');
                    this.player.showStatus('视频加载完成。', 'success');
                    this.player.videoPlayer.play().catch(() => {});
                };
                this.player.updateOnlineVideoInfo(url);
                if (this.player.playPauseBtn) {
                    this.player.playPauseBtn.focus();
                }
            })
            .catch(error => {
                // 解析失败时，video-parser 会自动显示详细提示，这里只做兜底
                if (error && error.message && error.message.includes('无法直接在线播放')) {
                    // 已有详细提示，无需重复
                    return;
                }
                console.error('❌ 视频链接解析失败:', error);
                this.player.showStatus(`链接解析失败: ${error.message}`, 'error');
            });
    }
}
