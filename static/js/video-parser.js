// 视频解析模块 - ES6模块化版本
export default class VideoParser {
    constructor() {
        this.autoParseApi = '/api/auto-parse';
    }

    // 检测视频平台
    detectVideoPlatform(url) {
        if (url.includes('bilibili.com') || url.includes('b23.tv')) {
            return 'bilibili';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        } else if (url.match(/\.(mp4|webm|ogg|mov|mkv|avi|wmv|flv|m4v)(\?.*)?$/i)) {
            return 'direct';
        } else if (url.includes('m3u8')) {
            return 'm3u8';
        } else {
            return 'unknown';
        }
    }

    // 主解析方法 - 使用自动化解析API
    async parseVideo(url) {
        const platform = this.detectVideoPlatform(url);
        console.log(`🎬 检测到视频平台: ${platform}, URL: ${url}`);
        
        // 直接视频链接，直接返回
        if (platform === 'direct' || platform === 'm3u8') {
            console.log(`✅ 直接视频流: ${url}`);
            return url;
        }
        
        // B站视频，使用自动化解析
        if (platform === 'bilibili') {
            console.log('🔄 使用自动化解析B站视频...');
            return await this.parseWithAutomation(url);
        }
        
        // 其他平台提示不支持
        throw new Error(`暂不支持 ${platform} 平台的视频解析`);
    }

    // 使用自动化解析API
    async parseWithAutomation(url) {
        try {
            console.log('🔄 调用自动化解析API...');
            
            const response = await fetch(`${this.autoParseApi}?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            
            if (data.success && data.video_url) {
                console.log('✅ 自动化解析成功:', data.video_url);
                return data.video_url;
            } else {
                // 自动化解析失败，回退到手动解析指南
                this.showManualGuide(url, data.error || '自动化解析失败');
                throw new Error(data.error || '自动化解析失败');
            }
            
        } catch (error) {
            console.error('❌ 自动化解析失败:', error);
            // 网络错误等情况，回退到手动解析指南
            this.showManualGuide(url, error.message);
            throw error;
        }
    }

    // 显示手动解析指南（备用方案）
    showManualGuide(originalUrl, errorMessage) {
        const guideHtml = `
            <div class="parse-guide" style="
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 20px;
                margin: 15px 0;
                text-align: left;
            ">
                <h3 style="margin-top: 0; color: #856404;">⚠️ 自动化解析失败</h3>
                <p><strong>错误信息: ${errorMessage}</strong></p>
                <p>请使用手动解析：</p>
                <ol style="margin-bottom: 15px;">
                    <li>点击下方链接打开 SnapAny 网站</li>
                    <li>将B站视频URL粘贴到输入框中</li>
                    <li>点击"提取视频图片"按钮</li>
                    <li>等待解析完成，点击"下载视频"按钮</li>
                    <li>在新标签页中复制视频直链URL</li>
                    <li>回到本页面，将直链粘贴到在线视频URL输入框</li>
                </ol>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="https://snapany.com/zh/bilibili" target="_blank" 
                       style="background: #2c5aa0; color: white; padding: 10px 15px; 
                              border-radius: 5px; text-decoration: none; display: inline-flex; 
                              align-items: center; gap: 5px;">
                        🔗 打开 SnapAny
                    </a>
                    <button onclick="copyBilibiliUrl('${originalUrl}')" 
                            style="background: #28a745; color: white; padding: 10px 15px; 
                                   border-radius: 5px; border: none; cursor: pointer;
                                   display: inline-flex; align-items: center; gap: 5px;">
                        📋 复制B站链接
                    </button>
                </div>
                <div style="margin-top: 15px; font-size: 0.9em; color: #856404;">
                    <strong>💡 提示：</strong> 获取到视频直链后，直接粘贴到上方的"在线视频URL"输入框即可播放
                </div>
            </div>
        `;
        
        // 显示指南
        const statusEl = document.getElementById('uploadStatus');
        if (statusEl) {
            statusEl.innerHTML = guideHtml;
        }
        
        // 添加复制函数到全局
        window.copyBilibiliUrl = function(url) {
            navigator.clipboard.writeText(url).then(() => {
                alert('✅ B站链接已复制到剪贴板');
            }).catch(() => {
                // 备用方案
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('✅ B站链接已复制到剪贴板');
            });
        };
    }

    // 验证视频URL
    isValidVideoUrl(url) {
        if (!url) return false;
        
        const videoPatterns = [
            /\.(mp4|webm|ogg|mov|mkv|avi|wmv|flv|m4v)(\?.*)?$/i,
            /\.m3u8/i,
            /googlevideo\.com/,
            /bilivideo\.com/,
            /akamaized\.net/,
            /bcbolb\.com/,
            /upos-sz/,
            /upgcxcode/  // 添加B站特定的视频路径模式
        ];
        
        return videoPatterns.some(pattern => pattern.test(url));
    }

    // 直接解析视频URL（用于手动输入的直链）
    async parseDirectUrl(url) {
        if (this.isValidVideoUrl(url)) {
            return url;
        }
        throw new Error('这不是有效的视频直链');
    }

    // 为B站视频URL添加Referer头（重要！）
    setupBilibiliVideoHeaders(videoElement, videoUrl) {
        if (videoUrl.includes('bilivideo.com')) {
            console.log('🔧 设置B站视频请求头...');
            
            // 方法1: 使用fetch获取视频流
            this.loadVideoWithHeaders(videoElement, videoUrl).catch(error => {
                console.error('❌ 使用headers加载失败:', error);
                // 方法2: 回退到直接设置src，但设置crossOrigin
                videoElement.crossOrigin = 'anonymous';
                videoElement.src = videoUrl;
            });
        } else {
            // 其他视频直接设置src
            videoElement.src = videoUrl;
        }
    }

    // 使用fetch加载视频并设置正确的headers
    async loadVideoWithHeaders(videoElement, videoUrl) {
        try {
            const response = await fetch(videoUrl, {
                headers: {
                    'Referer': 'https://www.bilibili.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Origin': 'https://www.bilibili.com'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            videoElement.src = blobUrl;
            
            console.log('✅ 使用headers成功加载视频');
            
            // 清理blob URL
            videoElement.addEventListener('load', () => {
                URL.revokeObjectURL(blobUrl);
            });
            
        } catch (error) {
            console.error('❌ 使用headers加载视频失败:', error);
            throw error;
        }
    }
}