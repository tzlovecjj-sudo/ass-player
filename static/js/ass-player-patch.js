// ASS播放器补丁文件 - 用于支持新布局

// 在播放器初始化后注入布局管理器
function injectLayoutManager() {
    if (window.player && !window.player.layoutManager) {
        console.log('注入布局管理器...');
        window.player.layoutManager = new LayoutManager(window.player);
        
        // 重写关键方法以使用新布局
        overridePlayerMethods();
    }
}

function overridePlayerMethods() {
    const player = window.player;
    
    // 保存原始方法
    const originalUpdateVideoInfo = player.updateVideoInfo;
    const originalUpdateSubtitleInfo = player.updateSubtitleInfo;
    const originalUpdateOnlineVideoInfo = player.updateOnlineVideoInfo;
    const originalOnVideoLoaded = player.onVideoLoaded;
    
    // 重写视频信息更新方法
    player.updateVideoInfo = function(file) {
        if (this.layoutManager) {
            this.layoutManager.updateVideoInfo(file);
        } else {
            originalUpdateVideoInfo.call(this, file);
        }
    };
    
    // 重写字幕信息更新方法
    player.updateSubtitleInfo = function(file) {
        if (this.layoutManager) {
            this.layoutManager.updateSubtitleInfo(file, this.subtitles.length, Object.keys(this.styles).length);
        } else {
            originalUpdateSubtitleInfo.call(this, file);
        }
    };
    
    // 重写在线视频信息更新方法
    player.updateOnlineVideoInfo = function(url) {
        if (this.layoutManager) {
            this.layoutManager.updateOnlineVideoInfo(url);
        } else {
            originalUpdateOnlineVideoInfo.call(this, url);
        }
    };
    
    // 重写视频加载完成方法
    player.onVideoLoaded = function() {
        // 调用原始方法
        originalOnVideoLoaded.call(this);
        
        // 更新分辨率信息
        if (this.layoutManager && this.videoPlayer.videoWidth && this.videoPlayer.videoHeight) {
            this.layoutManager.updateVideoResolution(
                this.videoPlayer.videoWidth,
                this.videoPlayer.videoHeight,
                this.videoPlayer.duration
            );
        }
    };
    
    console.log('播放器方法重写完成');
}

// 页面加载完成后注入布局管理器
document.addEventListener('DOMContentLoaded', function() {
    // 等待播放器初始化
    setTimeout(injectLayoutManager, 1000);
});

// 监听播放器初始化完成
let initCheckInterval = setInterval(() => {
    if (window.player) {
        clearInterval(initCheckInterval);
        injectLayoutManager();
    }
}, 500);