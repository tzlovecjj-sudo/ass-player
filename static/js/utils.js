// 工具函数模块 - ES6 模块化版本
// 该模块包含一些通用的辅助函数，例如时间格式化、文件大小格式化、状态消息显示、HTML 转义以及文本测量缓存。
// 注意：部分功能可能在其他模块中存在更具体的实现。

/**
 * 将秒数格式化为 HH:MM:SS 的字符串格式。
 * @param {number} seconds - 总秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 将文件大小（字节）格式化为更易读的字符串（如 KB, MB, GB）。
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小字符串
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; // 1 KB = 1024 Bytes
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // 文件大小单位
    const i = Math.floor(Math.log(bytes) / Math.log(k)); // 计算对数，确定单位索引
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 在指定元素上显示一条状态消息，并在几秒后自动消失。
 * 注意：此函数在 `UIController` 中有更具体的实现，此为通用版本。
 * @param {string} message - 要显示的消息内容
 * @param {'success'|'error'|'info'} type - 消息类型，用于应用不同的 CSS 样式
 * @param {string} [elementId='uploadStatus'] - 用于显示消息的 DOM 元素的 ID
 */
export function showStatus(message, type, elementId = 'uploadStatus') {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) {
        // 如果找不到指定的元素，则在控制台输出日志作为备用方案
        console.log(`状态 [${type}]: ${message}`);
        return;
    }
    
    statusEl.textContent = message;
    statusEl.className = `status ${type}`; // 应用基础样式和特定类型的样式
    
    // 设置一个定时器，在 5 秒后清除消息
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'status';
    }, 5000);
}

/**
 * 对文本进行 HTML 转义，以防止 XSS 攻击，并确保文本在 HTML 中正确显示。
 * 注意：此函数在 `SubtitleRenderer` 中有更具体的实现，此为通用版本。
 * @param {string} text - 原始文本字符串
 * @returns {string} HTML 转义后的字符串
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text; // 将文本设置为 div 的 textContent，浏览器会自动转义特殊字符
    return div.innerHTML;   // 获取转义后的 HTML 字符串
}

/**
 * 创建一个文本测量函数，并内置缓存机制以提高性能。
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 绘图上下文
 * @returns {function(string): number} 一个接受文本字符串并返回其宽度的函数
 */
export function createTextMetricsCache(ctx) {
    const cache = new Map(); // 用于存储文本测量结果的缓存
    
    /**
     * 测量文本在 Canvas 上的渲染宽度，并使用缓存。
     * @param {string} text - 需要测量的文本
     * @returns {number} 文本的宽度（像素）
     */
    return function(text) {
        // 如果缓存中已有结果，直接返回
        if (cache.has(text)) {
            return cache.get(text);
        }
        
        // 否则，进行测量
        const width = ctx.measureText(text).width;
        // 将结果存入缓存
        cache.set(text, width);
        return width;
    };
}
