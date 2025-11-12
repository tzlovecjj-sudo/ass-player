// 布局管理器 - 处理新的左右分栏布局

class LayoutManager {
    constructor(player) {
        this.player = player;
        this.initializeLayout();
    }

    initializeLayout() {
        console.log('初始化布局管理器...');
        this.setupFileInfoDisplay();
        this.setupCacheInfo();
    }

    // 设置文件信息显示
    setupFileInfoDisplay() {
        // 这些函数将被播放器调用
        console.log('设置文件信息显示');
    }

    // 更新视频文件信息（新布局版本）
    updateVideoInfo(file) {
        const videoInfo = document.getElementById('videoInfo');
        if (!videoInfo) return;

        const fileName = file ? file.name : '未加载';
        const fileSize = file ? this.formatFileSize(file.size) : '-';
        const resolution = file ? '待检测' : '-';
        const duration = file ? '待检测' : '-';

        videoInfo.innerHTML = `
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
                <span class="file-info-value">${resolution}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">时长:</span>
                <span class="file-info-value">${duration}</span>
            </div>
        `;
    }

    // 更新字幕文件信息（新布局版本）
    updateSubtitleInfo(file, subtitleCount = 0, styleCount = 0) {
        const subtitleInfo = document.getElementById('subtitleInfo');
        if (!subtitleInfo) return;

        const fileName = file ? file.name : '未加载';
        const fileSize = file ? this.formatFileSize(file.size) : '-';
        const subtitleText = subtitleCount > 0 ? `${subtitleCount} 条字幕` : '-';
        const styleText = styleCount > 0 ? `${styleCount} 种样式` : '-';

        subtitleInfo.innerHTML = `
            <div class="file-info-item">
                <span class="file-info-label">字幕文件:</span>
                <span class="file-info-value">${fileName}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">文件大小:</span>
                <span class="file-info-value">${fileSize}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">字幕数量:</span>
                <span class="file-info-value">${subtitleText}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">样式数量:</span>
                <span class="file-info-value">${styleText}</span>
            </div>
        `;
    }

    // 更新在线视频信息（新布局版本）
    updateOnlineVideoInfo(url) {
        const videoInfo = document.getElementById('videoInfo');
        if (!videoInfo) return;

        videoInfo.innerHTML = `
            <div class="file-info-item">
                <span class="file-info-label">视频源:</span>
                <span class="file-info-value">在线视频</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">URL:</span>
                <span class="file-info-value">${this.truncateUrl(url)}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">解析方式:</span>
                <span class="file-info-value">内置代理</span>
            </div>
        `;
    }

    // 设置缓存信息
    setupCacheInfo() {
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearCache();
            });
        }
        this.updateCacheStats();
    }

    // 更新缓存统计
    updateCacheStats() {
        fetch('/api/cache/stats')
            .then(response => response.json())
            .then(data => {
                const cacheStatus = document.getElementById('cacheStatus');
                if (cacheStatus) {
                    cacheStatus.textContent = data.enabled ? '启用' : '禁用';
                }
            })
            .catch(error => {
                console.error('获取缓存统计失败:', error);
            });
    }

    // 清空缓存
    clearCache() {
        fetch('/api/cache/clear', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showMessage('缓存已清空', 'success');
                    this.updateCacheStats();
                }
            })
            .catch(error => {
                console.error('清空缓存失败:', error);
                this.showMessage('清空缓存失败', 'error');
            });
    }

    // 工具函数
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    truncateUrl(url, maxLength = 40) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    showMessage(message, type) {
        // 使用播放器的状态显示功能
        if (this.player && this.player.showStatus) {
            this.player.showStatus(message, type);
        } else {
            alert(message);
        }
    }

    // 更新视频分辨率信息（当视频加载完成后调用）
    updateVideoResolution(width, height, duration) {
        const videoInfo = document.getElementById('videoInfo');
        if (!videoInfo) return;

        // 查找分辨率显示元素并更新
        const resolutionItems = videoInfo.querySelectorAll('.file-info-item');
        resolutionItems.forEach(item => {
            const label = item.querySelector('.file-info-label');
            if (label && label.textContent.includes('分辨率')) {
                const valueSpan = item.querySelector('.file-info-value');
                if (valueSpan) {
                    valueSpan.textContent = `${width} × ${height}`;
                }
            }
            if (label && label.textContent.includes('时长')) {
                const valueSpan = item.querySelector('.file-info-value');
                if (valueSpan && duration) {
                    valueSpan.textContent = this.formatTime(duration);
                }
            }
        });
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
}