// 文件处理模块
export default class FileHandler {
    constructor(player) {
        this.player = player;
    }

    // 视频文件处理
    loadVideo(file) {
        if (!file) {
            console.error('没有选择文件');
            return;
        }
        
        console.log('加载视频文件:', file.name, '类型:', file.type);
        
        // 验证文件类型
        if (!file.type.startsWith('video/')) {
            this.player.showStatus('请选择有效的视频文件', 'error');
            return;
        }
        
        // 创建对象URL
        const url = URL.createObjectURL(file);
        console.log('创建的对象URL:', url);
        
        // 重置视频元素
        this.player.videoPlayer.src = url;
        this.player.videoPlayer.load();
        
        // 更新文件信息
        this.player.updateVideoInfo(file);
        
        this.player.showStatus('视频文件加载成功', 'success');
    }

    // 字幕文件处理
    loadSubtitles(file) {
        if (!file) return;
        
        console.log('加载字幕文件:', file.name);
        
        // 验证文件类型
        if (!file.name.toLowerCase().endsWith('.ass')) {
            this.player.showStatus('请选择ASS字幕文件', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.player.subtitleRenderer.parseASSFile(e.target.result);
                this.player.updateSubtitleInfo(file);
                this.player.showStatus('字幕文件解析成功', 'success');
                console.log('解析到的字幕数量:', this.player.subtitles.length);
                console.log('解析到的样式数量:', Object.keys(this.player.styles).length);
            } catch (error) {
                this.player.showStatus('字幕文件解析失败: ' + error.message, 'error');
                console.error('ASS解析错误:', error);
            }
        };
        reader.onerror = () => {
            this.player.showStatus('读取字幕文件失败', 'error');
        };
        reader.readAsText(file, 'utf-8');
    }

    // 在线视频处理
    loadOnlineVideo() {
        const url = this.player.onlineVideoUrl.value.trim();
        if (!url) {
            this.player.showStatus('请输入视频URL', 'error');
            return;
        }

        this.player.showStatus('正在解析视频...', 'info');

        // 使用内置代理解析视频
        this.player.videoParser.parseVideo(url, true)
            .then(videoUrl => {
                console.log('✅ 视频解析成功:', videoUrl);
                this.player.showStatus('视频解析成功，正在加载...', 'success');
                
                // 设置视频源
                this.player.videoPlayer.src = videoUrl;
                this.player.videoPlayer.load();
                
                // 监听视频错误
                this.player.videoPlayer.onerror = () => {
                    console.error('❌ 视频加载失败');
                    this.player.showStatus('视频加载失败，请尝试其他视频URL', 'error');
                };
                
                // 监听视频可以播放
                this.player.videoPlayer.oncanplay = () => {
                    console.log('✅ 视频可以播放');
                    this.player.showStatus('视频加载完成，可以播放', 'success');
                };
                
                // 更新文件信息
                this.player.updateOnlineVideoInfo(url);
            })
            .catch(error => {
                console.error('❌ 视频解析失败:', error);
                this.player.showStatus(`视频解析失败: ${error.message}`, 'error');
            });
    }
}