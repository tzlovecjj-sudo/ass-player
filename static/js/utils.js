// 工具函数模块 - ES6模块化版本

export function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function showStatus(message, type, elementId = 'uploadStatus') {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) {
        console.log(`状态: ${message} (${type})`);
        return;
    }
    
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'status';
    }, 5000);
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 文本测量缓存创建函数
export function createTextMetricsCache(ctx) {
    const cache = new Map();
    
    return function(text) {
        if (cache.has(text)) {
            return cache.get(text);
        }
        
        const width = ctx.measureText(text).width;
        cache.set(text, width);
        return width;
    };
}