// 视频解析模块 - ES6 模块化版本
export default class VideoParser {
    /**
     * 构造函数
     */
    constructor() {
        // 后端自动化解析 API 的路径
        this.autoParseApi = '/api/auto-parse';
    }

    /**
     * 检测给定 URL 所属的视频平台或类型。
     * @param {string} url - 视频 URL
     * @returns {string} 视频平台或类型 ('bilibili', 'youtube', 'direct', 'm3u8', 'unknown')
     */
    /**
     * 检测给定 URL 所属的视频平台或类型。
     * @param {string} url - 视频 URL
     * @returns {string} 视频平台或类型 ('bilibili', 'youtube', 'direct', 'm3u8', 'unknown')
     */
    detectVideoPlatform(url) {
        // 检查是否为 Bilibili 视频 (包括完整 URL 和纯 BV 号)
        if (url.includes('bilibili.com') || url.includes('b23.tv') || /^BV[a-zA-Z0-9]{10}$/.test(url)) {
            return 'bilibili'; // Bilibili 视频
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube'; // YouTube 视频
        } else if (url.match(/\.(mp4|webm|ogg|mov|mkv|avi|wmv|flv|m4v)(\?.*)?$/i)) {
            return 'direct'; // 直接视频文件链接 (常见视频格式)
        } else if (url.includes('m3u8')) {
            return 'm3u8'; // HLS 流媒体链接
        } else {
            return 'unknown'; // 未知平台或类型
        }
    }

    /**
     * 主视频解析方法。根据 URL 类型决定是直接返回还是调用后端 API 进行解析。
     * @param {string} url - 原始视频 URL
     * @returns {Promise<string>} 解析成功后返回真实的视频播放 URL
     * @throws {Error} 如果解析失败或平台不支持
     */
    async parseVideo(url) {
        const platform = this.detectVideoPlatform(url);
        console.log(`🎬 检测到视频平台: ${platform}, 原始 URL: ${url}`);
        
        // 如果是直接视频文件链接或 M3U8 链接，则直接返回原始 URL
        if (platform === 'direct' || platform === 'm3u8') {
            console.log(`✅ 识别为直接视频流或 M3U8，直接使用 URL: ${url}`);
            return url;
        }
        
        // 如果是 Bilibili 视频，则调用后端自动化解析 API
        if (platform === 'bilibili') {
            console.log('🔄 识别为 Bilibili 视频，尝试使用后端自动化解析...');
            return await this.parseWithAutomation(url);
        }
        
        // 对于其他不支持的平台，抛出错误
        throw new Error(`当前暂不支持 ${platform} 平台的视频解析。`);
    }

    /**
     * 调用后端自动化解析 API 来获取视频的真实播放 URL。
     * @param {string} url - 原始视频 URL (例如 Bilibili 页面 URL)
     * @returns {Promise<string>} 解析成功后返回真实的视频播放 URL
     * @throws {Error} 如果 API 返回错误或网络请求失败
     */
    async parseWithAutomation(url) {
        try {
            console.log('🔄 正在调用后端自动化解析 API...');
            
            // 发送 GET 请求到后端 API，并传入原始 URL 作为参数
            const response = await fetch(`${this.autoParseApi}?url=${encodeURIComponent(url)}`);
            const data = await response.json(); // 解析 JSON 响应
            
            if (data.success && data.video_url) {
                console.log('✅ 后端自动化解析成功，获取到视频 URL:', data.video_url);
                return data.video_url;
            } else {
                // 如果后端 API 返回失败，显示手动解析指南
                const errorMessage = data.error || '后端自动化解析失败，未提供具体错误信息。';
                console.error('❌ 后端自动化解析失败:', errorMessage);
                this.showManualGuide(url, errorMessage);
                throw new Error(errorMessage);
            }
            
        } catch (error) {
            // 捕获网络请求或 JSON 解析错误
            console.error('❌ 调用后端自动化解析 API 时发生错误:', error);
            // 显示手动解析指南作为备用方案
            this.showManualGuide(url, error.message || '网络请求失败');
            throw error;
        }
    }

    /**
     * 当自动化解析失败时，显示手动解析的指南和备用方案。
     * @param {string} originalUrl - 原始的 Bilibili 视频 URL
     * @param {string} errorMessage - 自动化解析失败的错误信息
     */
    showManualGuide(originalUrl, errorMessage) {
        // 构建 HTML 字符串，包含手动解析的步骤和相关链接/按钮
        const guideHtml = `
            <div class="parse-guide" style="
                background: #fff3cd; /* 浅黄色背景 */
                border: 1px solid #ffeaa7; /* 边框 */
                border-radius: 8px; /* 圆角 */
                padding: 20px;
                margin: 15px 0;
                text-align: left;
            ">
                <h3 style="margin-top: 0; color: #856404;">⚠️ 自动化解析失败</h3>
                <p><strong>错误信息: ${errorMessage}</strong></p>
                <p>请尝试使用手动解析方法：</p>
                <ol style="margin-bottom: 15px;">
                    <li>点击下方链接打开 SnapAny 网站。</li>
                    <li>将原始 Bilibili 视频 URL 粘贴到 SnapAny 的输入框中。</li>
                    <li>点击 "提取视频图片" 按钮。</li>
                    <li>等待解析完成，点击 "下载视频" 按钮。</li>
                    <li>在新打开的标签页中复制视频的直接播放链接 (直链 URL)。</li>
                    <li>回到本页面，将复制的直链粘贴到上方的 "在线视频URL" 输入框中，然后点击 "加载在线视频"。</li>
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
                        📋 复制 Bilibili 链接
                    </button>
                </div>
                <div style="margin-top: 15px; font-size: 0.9em; color: #856404;">
                    <strong>💡 提示：</strong> 获取到视频直链后，直接粘贴到上方的"在线视频URL"输入框即可播放。
                </div>
            </div>
        `;
        
        // 将生成的 HTML 插入到状态显示区域
        const statusEl = document.getElementById('uploadStatus');
        if (statusEl) {
            statusEl.innerHTML = guideHtml;
        }
        
        // 在全局作用域中定义一个辅助函数，用于复制 URL 到剪贴板
        window.copyBilibiliUrl = function(url) {
            navigator.clipboard.writeText(url).then(() => {
                alert('✅ Bilibili 链接已复制到剪贴板。');
            }).catch(() => {
                // 如果 navigator.clipboard 不可用（例如非 HTTPS 环境），提供备用复制方案
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy'); // 旧版浏览器 API
                document.body.removeChild(textArea);
                alert('✅ Bilibili 链接已复制到剪贴板。');
            });
        };
    }

    /**
     * 验证一个 URL 是否为有效的视频直接播放链接。
     * @param {string} url - 要验证的 URL
     * @returns {boolean} 如果是有效的视频 URL 则返回 true，否则返回 false
     */
    isValidVideoUrl(url) {
        if (!url) return false;
        
        // 定义一系列正则表达式模式，用于匹配常见的视频文件扩展名或视频服务域名
        const videoPatterns = [
            /\.(mp4|webm|ogg|mov|mkv|avi|wmv|flv|m4v)(\?.*)?$/i, // 常见视频文件扩展名
            /\.m3u8/i,                                          // HLS 流媒体
            /googlevideo\.com/,                                 // Google Video (YouTube 视频源)
            /bilivideo\.com/,                                   // Bilibili 视频源
            /akamaized\.net/,                                   // Akamai CDN (常见视频 CDN)
            /bcbolb\.com/,                                      // 另一个视频 CDN
            /upos-sz/,                                          // Bilibili 视频源路径
            /upgcxcode/                                         // Bilibili 视频源路径
        ];
        
        // 检查 URL 是否匹配任何一个视频模式
        return videoPatterns.some(pattern => pattern.test(url));
    }

    /**
     * 直接解析视频 URL。主要用于验证用户手动输入的视频直链。
     * @param {string} url - 视频直链 URL
     * @returns {Promise<string>} 如果是有效直链则返回该 URL
     * @throws {Error} 如果不是有效的视频直链
     */
    async parseDirectUrl(url) {
        if (this.isValidVideoUrl(url)) {
            return url;
        }
        throw new Error('输入的不是有效的视频直链。');
    }

    /**
     * 为 Bilibili 视频 URL 设置正确的 Referer 头，以解决跨域播放问题。
     * Bilibili 的视频源通常需要特定的 Referer 头才能播放。
     * @param {HTMLVideoElement} videoElement - 视频 DOM 元素
     * @param {string} videoUrl - Bilibili 视频的直接播放 URL
     */
    setupBilibiliVideoHeaders(videoElement, videoUrl) {
        if (videoUrl.includes('bilivideo.com')) {
            console.log('🔧 检测到 Bilibili 视频源，尝试设置请求头以解决跨域问题...');
            
            // 尝试方法 1: 使用 Fetch API 获取视频流并创建 Blob URL
            // 这种方法可以完全控制请求头，但会增加内存使用
            this.loadVideoWithHeaders(videoElement, videoUrl).catch(error => {
                console.error('❌ 使用 Fetch API 和 headers 加载 Bilibili 视频失败:', error);
                // 如果 Fetch API 失败，回退到方法 2
                // 方法 2: 直接设置 src，并设置 crossOrigin 为 'anonymous'
                // 这在某些浏览器和服务器配置下可能有效，但 Referer 头无法完全控制
                videoElement.crossOrigin = 'anonymous'; // 允许跨域加载，但可能仍受 Referer 限制
                videoElement.src = videoUrl;
                console.warn('回退到直接设置视频 src，并设置 crossOrigin。');
            });
        } else {
            // 对于非 Bilibili 视频，直接设置 src 即可
            videoElement.src = videoUrl;
        }
    }

    /**
     * 使用 Fetch API 加载视频流，并设置自定义的请求头（特别是 Referer）。
     * 成功获取视频流后，将其转换为 Blob URL 并设置给视频元素。
     * @param {HTMLVideoElement} videoElement - 视频 DOM 元素
     * @param {string} videoUrl - 视频的直接播放 URL
     * @returns {Promise<void>}
     * @throws {Error} 如果 Fetch 请求失败或响应状态码不为 2xx
     */
    async loadVideoWithHeaders(videoElement, videoUrl) {
        try {
            console.log('🔄 正在使用 Fetch API 加载视频并设置 Referer 头...');
            const response = await fetch(videoUrl, {
                headers: {
                    'Referer': 'https://www.bilibili.com/', // 关键：设置 Referer 头
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // 模拟浏览器 UA
                    'Origin': 'https://www.bilibili.com' // 设置 Origin 头
                }
            });

            if (!response.ok) {
                // 如果 HTTP 响应状态码不是 2xx，则抛出错误
                throw new Error(`HTTP 错误! 状态码: ${response.status}`);
            }

            // 将响应体读取为 Blob 对象
            const blob = await response.blob();
            // 从 Blob 创建一个临时的 URL
            const blobUrl = URL.createObjectURL(blob);
            // 将视频元素的 src 设置为 Blob URL
            videoElement.src = blobUrl;
            
            console.log('✅ 使用 Fetch API 和 headers 成功加载视频。');
            
            // 监听视频加载完成事件，在视频加载完成后释放 Blob URL 资源
            videoElement.addEventListener('loadeddata', () => {
                URL.revokeObjectURL(blobUrl);
                console.log('Blob URL 资源已释放。');
            }, { once: true }); // 确保事件监听器只触发一次
            
        } catch (error) {
            console.error('❌ 使用 Fetch API 加载视频失败:', error);
            throw error; // 重新抛出错误，以便上层调用者处理
        }
    }
}
