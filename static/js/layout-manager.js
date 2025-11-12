// 布局管理器模块
// 该模块旨在处理播放器界面的左右分栏布局，并更新视频、字幕和缓存相关的信息显示。
// 注意：在当前 `EmbeddedASSPlayer` 的架构中，部分 UI 更新逻辑已迁移到 `UIController`。

class LayoutManager {
    /**
     * 构造函数
     * @param {EmbeddedASSPlayer} player - 播放器主实例的引用
     */
    constructor(player) {
        this.player = player; // 保存对主播放器实例的引用
        this.initializeLayout(); // 初始化布局相关的设置
    }

    /**
     * 初始化布局管理器。
     * 设置文件信息显示和缓存信息。
     */
    initializeLayout() {
        console.log('初始化布局管理器...');
        this.setupFileInfoDisplay(); // 设置文件信息显示区域
        this.setupCacheInfo();       // 设置缓存信息显示和交互
    }

    /**
     * 设置文件信息显示区域的初始化逻辑。
     * (此方法目前主要用于日志输出，实际更新由 `updateVideoInfo` 等方法完成)
     */
    setupFileInfoDisplay() {
        console.log('布局管理器：设置文件信息显示区域。');
    }

    /**
     * 更新界面上显示的视频文件信息。
     * @param {File|null} file - 加载的视频文件对象，或 null 表示未加载
     */
    updateVideoInfo(file) {
        const videoInfoContainer = document.getElementById('videoInfo');
        if (!videoInfoContainer) {
            console.warn('布局管理器：未找到 #videoInfo 元素。');
            return;
        }

        const fileName = file ? file.name : '未加载';
        const fileSize = file ? this.formatFileSize(file.size) : '-';
        // 分辨率和时长在视频元数据加载后通过 `updateVideoResolution` 更新
        const resolution = '待检测'; 
        const duration = '待检测';

        videoInfoContainer.innerHTML = `
            <div class="file-info-item">
                <span class="file-info-label">视频文件:</span>
                <span class="file-info-value">${fileName}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">文件大小:</span>
                <span class="file-info-value">${fileSize}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">分辨率:</span>
                <span class="file-info-value" data-info-type="resolution">${resolution}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">时长:</span>
                <span class="file-info-value" data-info-type="duration">${duration}</span>
            </div>
        `;
    }

    /**
     * 更新界面上显示的字幕文件信息。
     * @param {File|null} file - 加载的字幕文件对象，或 null 表示未加载
     * @param {number} [subtitleCount=0] - 字幕条目数量
     * @param {number} [styleCount=0] - 字幕样式数量
     */
    updateSubtitleInfo(file, subtitleCount = 0, styleCount = 0) {
        const subtitleInfoContainer = document.getElementById('subtitleInfo');
        if (!subtitleInfoContainer) {
            console.warn('布局管理器：未找到 #subtitleInfo 元素。');
            return;
        }

        const fileName = file ? file.name : '未加载';
        const fileSize = file ? this.formatFileSize(file.size) : '-';
        const subtitleText = subtitleCount > 0 ? `${subtitleCount} 条对话` : '-';
        const styleText = styleCount > 0 ? `${styleCount} 种样式` : '-';

        subtitleInfoContainer.innerHTML = `
            <div class="file-info-item">
                <span class="file-info-label">字幕文件:</span>
                <span class="file-info-value">${fileName}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">文件大小:</span>
                <span class="file-info-value">${fileSize}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">对话数量:</span>
                <span class="file-info-value">${subtitleText}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">样式数量:</span>
                <span class="file-info-value">${styleText}</span>
            </div>
        `;
    }

    /**
     * 更新界面上显示的在线视频信息。
     * @param {string} url - 在线视频的 URL
     */
    updateOnlineVideoInfo(url) {
        const videoInfoContainer = document.getElementById('videoInfo');
        if (!videoInfoContainer) {
            console.warn('布局管理器：未找到 #videoInfo 元素。');
            return;
        }

        videoInfoContainer.innerHTML = `
            <div class="file-info-item">
                <span class="file-info-label">视频源:</span>
                <span class="file-info-value">在线视频</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">URL:</span>
                <span class="file-info-value" title="${url}">${this.truncateUrl(url)}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">解析方式:</span>
                <span class="file-info-value">内置代理</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">分辨率:</span>
                <span class="file-info-value" data-info-type="resolution">待检测</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">时长:</span>
                <span class="file-info-value" data-info-type="duration">待检测</span>
            </div>
        `;
    }

    /**
     * 设置缓存信息显示区域和清空缓存按钮的事件监听器。
     */
    setupCacheInfo() {
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearCache(); // 绑定清空缓存按钮的点击事件
            });
        }
        this.updateCacheStats(); // 初始化时更新缓存统计信息
    }

    /**
     * 从后端 API 获取并更新缓存的统计信息。
     */
    updateCacheStats() {
        fetch('/api/cache/stats')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP 错误! 状态码: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const cacheStatusEl = document.getElementById('cacheStatus');
                if (cacheStatusEl) {
                    cacheStatusEl.textContent = data.enabled ? '启用' : '禁用'; // 显示缓存是否启用
                }
            })
            .catch(error => {
                console.error('获取缓存统计信息失败:', error);
                // 可以在这里显示一个错误状态给用户
            });
    }

    /**
     * 清空后端服务器的视频缓存。
     */
    clearCache() {
        fetch('/api/cache/clear', { method: 'POST' }) // 发送 POST 请求到清空缓存 API
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP 错误! 状态码: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    this.showMessage('视频缓存已成功清空。', 'success');
                    this.updateCacheStats(); // 清空后更新缓存统计
                } else {
                    this.showMessage(`清空缓存失败: ${data.error || '未知错误'}`, 'error');
                }
            })
            .catch(error => {
                console.error('清空缓存时发生错误:', error);
                this.showMessage('清空缓存失败，请检查网络或服务器状态。', 'error');
            });
    }

    // --- 工具函数 ---

    /**
     * 将文件大小（字节）格式化为更易读的字符串（如 KB, MB, GB）。
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} 格式化后的文件大小字符串
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024; // 1 KB = 1024 Bytes
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // 文件大小单位
        const i = Math.floor(Math.log(bytes) / Math.log(k)); // 计算对数，确定单位索引
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 截断长 URL 字符串，使其不超过指定长度，并在末尾添加省略号。
     * @param {string} url - 原始 URL 字符串
     * @param {number} [maxLength=40] - 最大长度
     * @returns {string} 截断后的 URL 字符串
     */
    truncateUrl(url, maxLength = 40) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...'; // 截断并添加 "..."
    }

    /**
     * 显示一条消息给用户。优先使用播放器内置的状态显示功能。
     * @param {string} message - 要显示的消息内容
     * @param {'success'|'error'|'info'} type - 消息类型
     */
    showMessage(message, type) {
        // 如果播放器实例存在且有 showStatus 方法，则使用它
        if (this.player && this.player.showStatus) {
            this.player.showStatus(message, type);
        } else {
            // 否则，使用浏览器原生的 alert 弹窗
            alert(message);
        }
    }

    /**
     * 更新界面上显示的视频分辨率和时长信息。
     * 通常在视频元数据加载完成后调用。
     * @param {number} width - 视频宽度
     * @param {number} height - 视频高度
     * @param {number} duration - 视频时长（秒）
     */
    updateVideoResolution(width, height, duration) {
        const videoInfoContainer = document.getElementById('videoInfo');
        if (!videoInfoContainer) {
            console.warn('布局管理器：未找到 #videoInfo 元素来更新分辨率。');
            return;
        }

        // 查找分辨率和时长显示元素并更新其文本内容
        const resolutionSpan = videoInfoContainer.querySelector('[data-info-type="resolution"]');
        if (resolutionSpan) {
            resolutionSpan.textContent = `${width} × ${height}`;
        }
        
        const durationSpan = videoInfoContainer.querySelector('[data-info-type="duration"]');
        if (durationSpan && duration) {
            durationSpan.textContent = this.formatTime(duration);
        }
    }

    /**
     * 将秒数格式化为 HH:MM:SS 或 MM:SS 的字符串格式。
     * @param {number} seconds - 总秒数
     * @returns {string} 格式化后的时间字符串
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            // 如果有小时，显示 HH:MM:SS
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
            // 否则，显示 MM:SS
            return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    }
}
