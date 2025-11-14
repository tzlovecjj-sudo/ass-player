// 全屏控制模块 - ES6 模块化版本
export default class FullscreenControls {
    /**
     * 构造函数
     * @param {EmbeddedASSPlayer} player - 播放器主实例的引用
     */
    constructor(player) {
        this.player = player; // 保存对主播放器实例的引用
        this.isWebFullscreen = false; // 标志：是否处于网页全屏模式
        this.isBrowserFullscreen = false; // 标志：是否处于浏览器原生全屏模式
        this.controlsHideTimeout = null; // 用于控制栏自动隐藏的定时器 ID
        this.mouseMoveTimeout = null; // 用于鼠标移动检测的定时器 ID (当前未使用)

        // 文档级交互事件引用（便于添加/移除监听）
        // 使用绑定后的固定引用，确保 removeEventListener 可正常移除
        this._onDocMouseMove = this.handleDocumentMouseMove.bind(this);
        this._onDocTouch = this.handleDocumentTouch.bind(this);
        this._listenersAttached = false; // 是否已在全屏模式下附加文档级监听
        // 用于在网页全屏时强制设置容器高度（避免被 layout.css 限制）
        this._videoSectionEl = null;
        this._videoContainerEl = null;
        this._prevVideoSectionHeight = null;
        this._prevVideoContainerHeight = null;
        this._onFullscreenWindowResize = this._onFullscreenWindowResize.bind(this);
    }

    // --- 全屏功能切换 ---

    /**
     * 切换播放器的全屏模式。
     * 逻辑：普通模式 -> 网页全屏 -> 浏览器全屏 -> 普通模式 (循环)
     */
    toggleFullscreen() {
        if (!this.isWebFullscreen && !this.isBrowserFullscreen) {
            // 当前是普通模式，进入网页全屏
            this.enterWebFullscreen();
        } else if (this.isWebFullscreen && !this.isBrowserFullscreen) {
            // 当前是网页全屏，退出网页全屏并进入浏览器全屏
            this.exitWebFullscreen();
            this.enterBrowserFullscreen();
        } else if (this.isBrowserFullscreen) {
            // 当前是浏览器全屏，退出浏览器全屏回到普通模式
            this.exitBrowserFullscreen();
        }
    }

    // --- 网页全屏功能 ---

    /**
     * 进入网页全屏模式。
     * 网页全屏通常通过 CSS 样式实现，使播放器占据整个浏览器视口。
     */
    enterWebFullscreen() {
        document.body.classList.add('web-fullscreen-mode'); // 添加 CSS 类以应用全屏样式
        this.isWebFullscreen = true; // 更新状态标志
        
        if (this.player.fullscreenBtn) {
            this.player.fullscreenBtn.title = "浏览器全屏"; // 更新按钮提示
            this.player.fullscreenBtn.classList.add('active'); // 激活按钮样式
        }
        
        this.player.setupCanvas(); // 重新设置 Canvas 尺寸以适应新布局
        this.player.startRendering(); // 确保渲染循环正在运行
        
        // 进入全屏后，设置控制栏的自动隐藏逻辑
        this.setupFullscreenControls();

        // 强制设置视频容器高度为视口高度，防止被 layout.css 中的 aspect-ratio/max-height 限制
        this._applyFullscreenInlineHeights();
        // 在窗口调整大小时同步更新高度
        window.addEventListener('resize', this._onFullscreenWindowResize);
    }

    /**
     * 退出网页全屏模式。
     */
    exitWebFullscreen() {
        document.body.classList.remove('web-fullscreen-mode'); // 移除 CSS 类以恢复原始样式
        this.isWebFullscreen = false; // 更新状态标志
        
        if (this.player.fullscreenBtn) {
            this.player.fullscreenBtn.title = "网页全屏"; // 更新按钮提示
            this.player.fullscreenBtn.classList.remove('active'); // 移除激活按钮样式
        }
        
        // 退出全屏后，确保控制栏完全可见，并清除自动隐藏定时器
        this.showControlsPermanently();
        
        this.player.setupCanvas(); // 重新设置 Canvas 尺寸
        this.player.startRendering(); // 确保渲染循环正在运行

        // 退出网页全屏时还原之前的内联样式并移除 resize 监听
        this._removeFullscreenInlineHeights();
        window.removeEventListener('resize', this._onFullscreenWindowResize);
    }

    // --- 浏览器原生全屏功能 ---

    /**
     * 进入浏览器原生全屏模式。
     * 浏览器原生全屏会使整个页面或指定元素占据显示器屏幕。
     */
    enterBrowserFullscreen() {
        const container = document.documentElement; // 通常使整个文档元素进入全屏
        
        // 尝试使用不同的浏览器前缀进入全屏
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) { // Safari
            container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) { // Firefox
            container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) { // IE/Edge
            container.msRequestFullscreen();
        }
        
        // 进入全屏后，设置控制栏的自动隐藏逻辑
        this.setupFullscreenControls();
    }

    /**
     * 退出浏览器原生全屏模式。
     */
    exitBrowserFullscreen() {
        // 尝试使用不同的浏览器前缀退出全屏
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { // Safari
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            document.msExitFullscreen();
        }
        
        // 退出全屏后，确保控制栏完全可见，并清除自动隐藏定时器
        this.showControlsPermanently();
    }

    /**
     * 处理浏览器原生全屏状态变化的事件。
     * 当用户通过浏览器 UI (例如按 F11) 切换全屏时触发。
     */
    handleBrowserFullscreenChange() {
        const wasBrowserFullscreen = this.isBrowserFullscreen; // 记录之前的浏览器全屏状态
        
        // 更新当前的浏览器全屏状态
        this.isBrowserFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        
        if (this.isBrowserFullscreen) {
            // 如果当前处于浏览器全屏模式
            document.body.classList.add('browser-fullscreen-mode'); // 添加 CSS 类
            
            if (this.player.fullscreenBtn) {
                this.player.fullscreenBtn.title = "退出全屏"; // 更新按钮提示
                this.player.fullscreenBtn.classList.add('active'); // 激活按钮样式
            }
            
            // 设置控制栏的自动隐藏逻辑
            this.setupFullscreenControls();
            // 在浏览器全屏时也尝试应用同样的内联高度策略
            this._applyFullscreenInlineHeights();
        } else {
            // 如果当前不在浏览器全屏模式 (已退出)
            document.body.classList.remove('browser-fullscreen-mode'); // 移除 CSS 类
            
            if (this.player.fullscreenBtn) {
                // 根据是否处于网页全屏来更新按钮提示
                this.player.fullscreenBtn.title = this.isWebFullscreen ? "浏览器全屏" : "网页全屏";
                // 如果不是网页全屏，则移除激活样式
                if (!this.isWebFullscreen) {
                    this.player.fullscreenBtn.classList.remove('active');
                }
            }
            
            // 退出浏览器全屏后，确保控制栏完全可见
            this.showControlsPermanently();

            // 退出浏览器全屏，移除内联高度
            this._removeFullscreenInlineHeights();
            
            // 如果之前是浏览器全屏，并且当前处于网页全屏，需要重新设置控制栏逻辑
            if (wasBrowserFullscreen && this.isWebFullscreen) {
                this.setupFullscreenControls();
            }
        }
        
        // 重新设置 Canvas 尺寸以适应新的显示模式
        this.player.setupCanvas();
        this.player.startRendering(); // 确保渲染循环正在运行
    }

    // --- 内联高度应用/恢复辅助方法 ---
    _applyFullscreenInlineHeights() {
        try {
            this._videoSectionEl = document.querySelector('.video-section');
            this._videoContainerEl = document.querySelector('.video-container');
            if (!this._videoSectionEl || !this._videoContainerEl) return;

            // 保存当前 inline height 以便恢复
            this._prevVideoSectionHeight = this._videoSectionEl.style.height || '';
            this._prevVideoContainerHeight = this._videoContainerEl.style.height || '';

            const h = window.innerHeight + 'px';
            this._videoSectionEl.style.height = h;
            this._videoSectionEl.style.minHeight = h;
            this._videoContainerEl.style.height = h;
            this._videoContainerEl.style.minHeight = h;
        } catch (e) {
            // 安全降级：不要阻塞主流程
            console.warn('应用全屏内联高度失败', e);
        }
    }

    _removeFullscreenInlineHeights() {
        try {
            if (!this._videoSectionEl || !this._videoContainerEl) return;
            // 恢复之前保存的 inline height（可能为空字符串）
            this._videoSectionEl.style.height = this._prevVideoSectionHeight || '';
            this._videoSectionEl.style.minHeight = '';
            this._videoContainerEl.style.height = this._prevVideoContainerHeight || '';
            this._videoContainerEl.style.minHeight = '';

            this._prevVideoSectionHeight = null;
            this._prevVideoContainerHeight = null;
            this._videoSectionEl = null;
            this._videoContainerEl = null;
        } catch (e) {
            console.warn('移除全屏内联高度失败', e);
        }
    }

    _onFullscreenWindowResize() {
        // 如果当前处于网页或浏览器全屏，重新设置 inline 高度为最新视口高度
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            try {
                const h = window.innerHeight + 'px';
                if (this._videoSectionEl) {
                    this._videoSectionEl.style.height = h;
                    this._videoSectionEl.style.minHeight = h;
                }
                if (this._videoContainerEl) {
                    this._videoContainerEl.style.height = h;
                    this._videoContainerEl.style.minHeight = h;
                }
                // 触发 canvas 重计算
                if (this.player && typeof this.player.setupCanvas === 'function') {
                    this.player.setupCanvas();
                }
            } catch (e) {
                // 忽略错误
            }
        }
    }

    // --- 键盘事件处理 ---

    /**
     * 处理 Escape 键按下事件。
     * 如果处于任何全屏模式，则退出全屏。
     */
    handleEscapeKey() {
        if (this.isWebFullscreen) {
            this.exitWebFullscreen();
        } else if (this.isBrowserFullscreen) {
            this.exitBrowserFullscreen();
        }
        // 确保退出全屏后，控制栏保持可见状态
        this.showControlsPermanently();
    }

    // --- 控制栏自动隐藏/显示逻辑 ---

    /**
     * 统一设置全屏模式下的控制栏行为：立即显示，并在延迟后自动隐藏。
     */
    setupFullscreenControls() {
        // 清除所有现有的控制栏定时器，避免冲突
        this.clearAllControlTimeouts();
        
        // 立即显示控制栏
        this.showControls();

        // 在全屏模式下附加文档级交互监听，确保任何位置的移动/触摸都能唤醒控制栏
        this.addFullscreenInteractionListeners();
        
        // 设置一个定时器，在 PLAYER_CONFIG.controlsHideDelay 毫秒后隐藏控制栏
        this.controlsHideTimeout = setTimeout(() => {
            this.hideControls();
        }, this.player.PLAYER_CONFIG.controlsHideDelay);
    }

    /**
     * 清除所有与控制栏显示/隐藏相关的定时器。
     */
    clearAllControlTimeouts() {
        if (this.controlsHideTimeout) {
            clearTimeout(this.controlsHideTimeout);
            this.controlsHideTimeout = null;
        }
        if (this.mouseMoveTimeout) { // 尽管当前 mouseMoveTimeout 未被使用，但保留清除逻辑
            clearTimeout(this.mouseMoveTimeout);
            this.mouseMoveTimeout = null;
        }
    }

    /**
     * 显示控制栏。
     * 只有在全屏模式下才生效。
     */
    showControls() {
        if ((this.isWebFullscreen || this.isBrowserFullscreen) && this.player.controls) {
            this.player.controls.classList.add('visible'); // 添加 CSS 类使其可见
        }
    }

    /**
     * 隐藏控制栏。
     * 只有在全屏模式下才生效。
     */
    hideControls() {
        if ((this.isWebFullscreen || this.isBrowserFullscreen) && this.player.controls) {
            this.player.controls.classList.remove('visible'); // 移除 CSS 类使其隐藏
        }
    }

    /**
     * 永久显示控制栏，并清除所有自动隐藏定时器。
     * 通常在退出全屏模式时调用。
     */
    showControlsPermanently() {
        this.clearAllControlTimeouts(); // 清除所有定时器
        // 退出或暂停全屏行为时，移除文档级监听，避免泄漏
        this.removeFullscreenInteractionListeners();
        
        if (this.player.controls) {
            this.player.controls.classList.add('visible'); // 确保控制栏可见
        }
    }

    /**
     * 在延迟后隐藏控制栏。
     * 只有在全屏模式下才生效。
     */
    hideControlsAfterDelay() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            // 清除之前可能存在的隐藏定时器
            if (this.controlsHideTimeout) {
                clearTimeout(this.controlsHideTimeout);
            }
            
            // 设置新的定时器，在配置的延迟时间后隐藏控制栏
            this.controlsHideTimeout = setTimeout(() => {
                this.hideControls();
            }, this.player.PLAYER_CONFIG.controlsHideDelay);
        }
    }

    /**
     * 处理鼠标移动事件，用于在全屏模式下临时显示控制栏。
     * 注意：此方法在 `EmbeddedASSPlayer` 中直接调用 `showControlsTemporarily`，
     * 因此此 `handleMouseMove` 方法可能未被直接使用。
     */
    handleMouseMove() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            this.showControlsTemporarily(); // 调用临时显示控制栏的方法
        }
    }

    /**
     * 临时显示控制栏，并在延迟后自动隐藏。
     * 适用于鼠标移动到播放器区域时。
     */
    showControlsTemporarily() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            this.showControls(); // 确保控制栏可见
            this.clearAllControlTimeouts(); // 清除所有定时器
            
            // 设置新的定时器，在配置的延迟时间后隐藏控制栏
            this.controlsHideTimeout = setTimeout(() => {
                this.hideControls();
            }, this.player.PLAYER_CONFIG.controlsHideDelay);
        }
    }

    // --- 文档级交互监听（增强） ---
    /**
     * 在全屏模式下附加文档级鼠标/触摸监听，确保任意位置的交互都能临时显示控制栏。
     */
    addFullscreenInteractionListeners() {
        if (this._listenersAttached) return;
        document.addEventListener('mousemove', this._onDocMouseMove, { passive: true });
        document.addEventListener('touchstart', this._onDocTouch, { passive: true });
        document.addEventListener('touchmove', this._onDocTouch, { passive: true });
        this._listenersAttached = true;
    }

    /**
     * 移除文档级交互监听。
     */
    removeFullscreenInteractionListeners() {
        if (!this._listenersAttached) return;
        document.removeEventListener('mousemove', this._onDocMouseMove);
        document.removeEventListener('touchstart', this._onDocTouch);
        document.removeEventListener('touchmove', this._onDocTouch);
        this._listenersAttached = false;
    }

    /** 文档级鼠标移动处理器 */
    handleDocumentMouseMove() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            this.showControlsTemporarily();
        }
    }

    /** 文档级触摸处理器（移动端/触摸屏） */
    handleDocumentTouch() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            this.showControlsTemporarily();
        }
    }
}
