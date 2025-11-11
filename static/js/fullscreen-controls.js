// 全屏控制模块 - 非模块化版本
class FullscreenControls {
    constructor(player) {
        this.player = player;
        this.isWebFullscreen = false;
        this.isBrowserFullscreen = false;
        this.controlsHideTimeout = null;
        this.mouseMoveTimeout = null;
    }

    // 全屏功能 - 循环切换
    toggleFullscreen() {
        if (!this.isWebFullscreen && !this.isBrowserFullscreen) {
            // 当前是普通模式，进入网页全屏
            this.enterWebFullscreen();
        } else if (this.isWebFullscreen && !this.isBrowserFullscreen) {
            // 当前是网页全屏，进入浏览器全屏
            this.exitWebFullscreen();
            this.enterBrowserFullscreen();
        } else if (this.isBrowserFullscreen) {
            // 当前是浏览器全屏，退出到普通模式
            this.exitBrowserFullscreen();
        }
    }

    // 网页全屏功能
    enterWebFullscreen() {
        document.body.classList.add('web-fullscreen-mode');
        this.isWebFullscreen = true;
        
        if (this.player.fullscreenBtn) {
            this.player.fullscreenBtn.title = "浏览器全屏";
            this.player.fullscreenBtn.classList.add('active');
        }
        
        this.player.setupCanvas();
        this.player.startRendering();
        
        // 进入全屏时设置控制栏逻辑
        this.setupFullscreenControls();
    }

    exitWebFullscreen() {
        document.body.classList.remove('web-fullscreen-mode');
        this.isWebFullscreen = false;
        
        if (this.player.fullscreenBtn) {
            this.player.fullscreenBtn.title = "网页全屏";
            this.player.fullscreenBtn.classList.remove('active');
        }
        
        // 退出全屏后，确保控制栏完全可见
        this.showControlsPermanently();
        
        this.player.setupCanvas();
        this.player.startRendering();
    }

    // 浏览器全屏功能
    enterBrowserFullscreen() {
        const container = document.documentElement;
        
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
            container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
        
        // 进入全屏后设置控制栏逻辑
        this.setupFullscreenControls();
    }

    exitBrowserFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        // 退出全屏后，确保控制栏完全可见
        this.showControlsPermanently();
    }

    handleBrowserFullscreenChange() {
        const wasBrowserFullscreen = this.isBrowserFullscreen;
        this.isBrowserFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        
        if (this.isBrowserFullscreen) {
            document.body.classList.add('browser-fullscreen-mode');
            
            if (this.player.fullscreenBtn) {
                this.player.fullscreenBtn.title = "退出全屏";
                this.player.fullscreenBtn.classList.add('active');
            }
            
            // 进入浏览器全屏时重置控制栏逻辑
            this.setupFullscreenControls();
        } else {
            document.body.classList.remove('browser-fullscreen-mode');
            
            if (this.player.fullscreenBtn) {
                this.player.fullscreenBtn.title = "网页全屏";
                this.player.fullscreenBtn.classList.remove('active');
            }
            
            // 退出浏览器全屏时确保控制栏可见
            this.showControlsPermanently();
            
            // 如果之前是网页全屏，需要重新设置
            if (wasBrowserFullscreen && this.isWebFullscreen) {
                this.setupFullscreenControls();
            }
        }
        
        // 重新设置Canvas尺寸以适应新的显示模式
        this.player.setupCanvas();
        this.player.startRendering();
    }

    // Escape键处理
    handleEscapeKey() {
        if (this.isWebFullscreen) {
            this.exitWebFullscreen();
        } else if (this.isBrowserFullscreen) {
            this.exitBrowserFullscreen();
        }
        // 确保退出全屏后重置控制栏状态
        this.showControlsPermanently();
    }

    // 统一设置全屏控制栏逻辑
    setupFullscreenControls() {
        // 清除所有现有的定时器
        this.clearAllControlTimeouts();
        
        // 立即显示控制栏
        this.showControls();
        
        // 3秒后开始隐藏控制栏
        this.controlsHideTimeout = setTimeout(() => {
            this.hideControls();
        }, 3000);
    }

    // 清除所有定时器
    clearAllControlTimeouts() {
        if (this.controlsHideTimeout) {
            clearTimeout(this.controlsHideTimeout);
            this.controlsHideTimeout = null;
        }
        if (this.mouseMoveTimeout) {
            clearTimeout(this.mouseMoveTimeout);
            this.mouseMoveTimeout = null;
        }
    }

    // 控制栏显示/隐藏逻辑
    showControls() {
        if ((this.isWebFullscreen || this.isBrowserFullscreen) && this.player.controls) {
            this.player.controls.classList.add('visible');
        }
    }

    hideControls() {
        if ((this.isWebFullscreen || this.isBrowserFullscreen) && this.player.controls) {
            this.player.controls.classList.remove('visible');
        }
    }

    showControlsPermanently() {
        // 清除所有定时器
        this.clearAllControlTimeouts();
        
        // 确保控制栏完全可见
        if (this.player.controls) {
            this.player.controls.classList.add('visible');
        }
    }

    hideControlsAfterDelay() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            // 清除之前的定时器
            if (this.controlsHideTimeout) {
                clearTimeout(this.controlsHideTimeout);
            }
            
            // 设置新的定时器隐藏控制栏
            this.controlsHideTimeout = setTimeout(() => {
                this.hideControls();
            }, 3000);
        }
    }

    // 鼠标移动处理
    handleMouseMove() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            // 显示控制栏
            this.showControls();
            
            // 清除之前的定时器
            this.clearAllControlTimeouts();
            
            // 设置新的定时器隐藏控制栏
            this.controlsHideTimeout = setTimeout(() => {
                this.hideControls();
            }, 3000);
        }
    }

    // 控制栏自动显示/隐藏
    showControlsTemporarily() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            this.showControls();
            this.clearAllControlTimeouts();
            this.controlsHideTimeout = setTimeout(() => {
                this.hideControls();
            }, 3000);
        }
    }
}