// ASS 播放器核心逻辑 - ES6 模块化版本
// 导入各个功能模块
import SubtitleRenderer from './subtitle-renderer.js';      // 字幕渲染器
import FullscreenControls from './fullscreen-controls.js';  // 全屏控制器
import VideoParser from './video-parser.js';                // 视频解析器（目前未使用，可能为旧代码）
import VideoController from './modules/video-controller.js';// 视频播放控制器
import UIController from './modules/ui-controller.js';      // UI 界面控制器
import FileHandler from './modules/file-handler.js';        // 文件处理模块
import ProgressController from './modules/progress-controller.js'; // 进度条控制器
import { DEFAULT_STYLES, PLAYER_CONFIG } from './modules/config.js'; // 默认样式和配置

// 导出的主播放器类
export default class EmbeddedASSPlayer {
    constructor() {
        console.log('开始初始化 EmbeddedASSPlayer...');
        
        // 初始化播放器内部属性
        this.initializeProperties();
        // 获取页面上的 DOM 元素
        this.getDOMElements();
        
        // 验证必要的 DOM 元素是否存在
        if (!this.verifyDOMElements()) {
            console.error('播放器初始化失败：缺少必要的 DOM 元素。');
            return;
        }
        
        // 初始化 Canvas 绘图上下文
        this.initializeContext();
        // 初始化各个功能控制器
        this.initializeControllers();
        // 设置事件监听器
        this.initializeEventListeners();
        
        console.log('播放器初始化完成。');
    }
    
    /**
     * 初始化播放器的内部状态和属性。
     */
    initializeProperties() {
        // 字幕数据
        this.subtitles = []; // 存储解析后的字幕事件
        this.styles = {};    // 存储字幕样式
        this.playResX = PLAYER_CONFIG.defaultPlayResX; // 字幕分辨率 X
        this.playResY = PLAYER_CONFIG.defaultPlayResY; // 字幕分辨率 Y
        this.currentSubtitleIndex = -1; // 当前显示的字幕索引
        
        // 渲染状态
        this.animationId = null; // requestAnimationFrame 的 ID
        this.currentSubtitleText = ''; // 当前字幕文本（用于预览）
        
        // 性能优化
        this.textMetricsCache = new Map(); // 缓存文本宽度计算结果
        
        // 默认字幕样式
        this.defaultStyle = DEFAULT_STYLES;
        // 播放器配置（供其他模块统一读取，例如全屏控件的隐藏延迟）
        this.PLAYER_CONFIG = PLAYER_CONFIG;

        // 实例化核心组件
        this.subtitleRenderer = new SubtitleRenderer(this);
        this.fullscreenControls = new FullscreenControls(this);
        this.videoParser = new VideoParser(); // 注意：VideoParser 在当前版本中可能未被积极使用
    }
    
    /**
     * 初始化播放器的各个功能控制器模块。
     */
    initializeControllers() {
        this.videoController = new VideoController(this);     // 视频控制
        this.uiController = new UIController(this);           // UI 更新
        this.fileHandler = new FileHandler(this);             // 文件加载与处理
        this.progressController = new ProgressController(this); // 进度条交互
    }
    
    /**
     * 从页面中获取所有需要的 DOM 元素的引用。
     */
    getDOMElements() {
        // 视频播放器和字幕渲染画布
        this.videoPlayer = document.getElementById('videoPlayer');
        this.videoCanvas = document.getElementById('videoCanvas');
        
        // 信息显示区域
        this.currentTimeDisplay = document.getElementById('currentTime'); // 当前时间显示（可能已废弃）
        this.subtitlePreview = document.getElementById('subtitlePreview'); // 字幕预览区域
        
        // 进度条相关元素
        this.progressBar = document.getElementById('progressBar');         // 整个进度条容器
        this.progress = document.getElementById('progress');               // 已播放进度条
        this.currentProgressTime = document.getElementById('currentProgressTime'); // 当前时间文本
        this.totalTime = document.getElementById('totalTime');             // 总时长文本
        
        // 控制按钮
        this.playPauseBtn = document.getElementById('playPauseBtn');       // 播放/暂停按钮
        this.restartBtn = document.getElementById('restartBtn');           // 重新播放按钮
        this.fullscreenBtn = document.getElementById('fullscreenBtn');     // 全屏按钮
        
        // 文件输入控件
        this.videoFileInput = document.getElementById('videoFile');        // 视频文件选择
        this.subtitleFileInput = document.getElementById('subtitleFile');  // 字幕文件选择
        
        // 在线视频加载
        this.loadOnlineVideoBtn = document.getElementById('loadOnlineVideoBtn'); // 加载在线视频按钮
        this.onlineVideoUrl = document.getElementById('onlineVideoUrl');     // 在线视频 URL 输入框
        
        // 控制栏容器
        this.controls = document.querySelector('.controls');
    }
    
    /**
     * 验证关键的 DOM 元素是否都已成功获取。
     * @returns {boolean} 如果所有必需元素都存在，则返回 true，否则返回 false。
     */
    verifyDOMElements() {
        const requiredElements = {
            videoPlayer: this.videoPlayer,
            videoCanvas: this.videoCanvas,
            playPauseBtn: this.playPauseBtn,
            videoFileInput: this.videoFileInput,
            subtitleFileInput: this.subtitleFileInput
        };
        
        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                console.error(`关键 DOM 元素 '${name}' 未在页面中找到。`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 初始化 Canvas 的 2D 绘图上下文。
     */
    initializeContext() {
        this.ctx = this.videoCanvas.getContext('2d');
    }
    
    /**
     * 为播放器的各种交互元素和事件设置监听器。
     * 大部分事件处理逻辑都委托给相应的控制器模块。
     */
    initializeEventListeners() {
        console.log('开始设置事件监听器...');
        
        // --- 文件和URL加载 ---
        this.videoFileInput.addEventListener('change', (e) => this.fileHandler.loadVideo(e.target.files[0]));
        this.subtitleFileInput.addEventListener('change', (e) => this.fileHandler.loadSubtitles(e.target.files[0]));
        this.loadOnlineVideoBtn.addEventListener('click', () => this.fileHandler.loadOnlineVideo());
                
        // --- 播放控制 ---
        this.playPauseBtn.addEventListener('click', () => this.videoController.togglePlayPause());
        this.restartBtn.addEventListener('click', () => this.videoController.restartVideo());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        // --- 进度条拖动 ---
        this.progressBar.addEventListener('mousedown', (e) => this.progressController.startSeeking(e));
        document.addEventListener('mousemove', (e) => {
            if (this.progressController.isSeeking) {
                this.progressController.handleSeeking(e);
            }
        });
        document.addEventListener('mouseup', () => this.progressController.stopSeeking());
        
        // --- 视频原生事件 ---
        this.videoPlayer.addEventListener('loadedmetadata', () => this.videoController.onVideoLoaded());
        this.videoPlayer.addEventListener('timeupdate', () => this.videoController.onTimeUpdate());
        this.videoPlayer.addEventListener('ended', () => this.videoController.onVideoEnded());
        this.videoPlayer.addEventListener('play', () => this.videoController.onVideoPlay());
        this.videoPlayer.addEventListener('pause', () => this.videoController.onVideoPause());
        this.videoPlayer.addEventListener('error', (e) => {
            console.error('视频播放时发生错误:', e);
            this.showStatus('视频播放错误: ' + (this.videoPlayer.error?.message || '未知错误'), 'error');
        });
        
        // --- 浏览器窗口和全屏事件 ---
        window.addEventListener('resize', () => this.uiController.onWindowResize());
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
        
        // --- 控制栏自动隐藏/显示 ---
        if (this.videoCanvas) {
            this.videoCanvas.addEventListener('mousemove', () => this.showControlsTemporarily());
            // 添加点击视频控制播放/暂停功能
            this.videoCanvas.addEventListener('click', () => this.videoController.togglePlayPause());
        }
        if (this.controls) {
            this.controls.addEventListener('mousemove', (e) => {
                e.stopPropagation(); // 防止事件冒泡到 videoCanvas，导致控制栏立即隐藏
                this.showControlsTemporarily();
            });
        }
        
        // --- 键盘快捷键 ---
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        console.log('事件监听器设置完成。');
    }
    
    /**
     * 启动渲染循环。
     * 使用 requestAnimationFrame 来同步视频帧和字幕的绘制。
     */
    startRendering() {
        // 如果已有渲染循环，先停止
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // 定义单帧渲染函数
        const renderFrame = () => {
            // 调用字幕渲染器来绘制当前视频帧和对应的字幕
            this.subtitleRenderer.renderVideoWithSubtitles();
            // 请求下一帧的渲染
            this.animationId = requestAnimationFrame(renderFrame);
        };
        
        // 启动第一帧渲染
        this.animationId = requestAnimationFrame(renderFrame);
        console.log('渲染循环已启动。');
    }
    
    /**
     * 停止渲染循环。
     */
    stopRendering() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            console.log('渲染循环已停止。');
        }
    }
    
    // --- 全屏控制 (委托给 FullscreenControls 模块) ---
    
    /**
     * 切换播放器的全屏状态。
     */
    toggleFullscreen() {
        this.fullscreenControls.toggleFullscreen();
    }
    
    /**
     * 浏览器全屏状态变化时的回调函数。
     */
    onFullscreenChange() {
        this.fullscreenControls.handleBrowserFullscreenChange();
    }
    
    // --- 控制栏显示/隐藏 (委托给 FullscreenControls 模块) ---
    
    /** 显示控制栏 */
    showControls() {
        this.fullscreenControls.showControls();
    }
    
    /** 隐藏控制栏 */
    hideControls() {
        this.fullscreenControls.hideControls();
    }
    
    /** 永久显示控制栏（直到被其他方法覆盖） */
    showControlsPermanently() {
        this.fullscreenControls.showControlsPermanently();
    }
    
    /** 延迟后隐藏控制栏 */
    hideControlsAfterDelay() {
        this.fullscreenControls.hideControlsAfterDelay();
    }
    
    /** 临时显示控制栏（一段时间后自动隐藏） */
    showControlsTemporarily() {
        this.fullscreenControls.showControlsTemporarily();
    }
    
    /**
     * 处理键盘快捷键事件。
     * @param {KeyboardEvent} e - 键盘事件对象。
     */
    handleKeyboard(e) {
        // 如果焦点在输入框内，则不响应快捷键
        if (e.target.tagName === 'INPUT') return;

        switch (e.code) {
            case 'Space': // 空格键：播放/暂停
                e.preventDefault();
                this.videoController.togglePlayPause();
                break;
            case 'Escape': // Esc 键：退出全屏
                this.fullscreenControls.handleEscapeKey();
                break;
            case 'ArrowLeft': // 左箭头：后退 5 秒
                e.preventDefault();
                this.videoController.seekTo(Math.max(0, this.videoPlayer.currentTime - 5));
                break;
            case 'ArrowRight': // 右箭头：快进 5 秒
                e.preventDefault();
                this.videoController.seekTo(Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + 5));
                break;
        }
    }
    
    // --- 代理方法 (Proxy Methods) ---
    // 这些方法将调用委托给 UIController，以保持 API 的向后兼容性或简化调用。
    
    /** 设置 Canvas 尺寸 */
    setupCanvas() {
        this.uiController.setupCanvas();
    }
    
    /** 更新播放/暂停按钮的图标 */
    updatePlayPauseButton(isPlaying) {
        this.uiController.updatePlayPauseButton(isPlaying);
    }
    
    /** 更新视频文件信息显示 */
    updateVideoInfo(file) {
        this.uiController.updateVideoInfo(file);
    }
    
    /** 更新字幕文件信息显示 */
    updateSubtitleInfo(file) {
        this.uiController.updateSubtitleInfo(file);
    }
    
    /** 更新在线视频 URL 信息显示 */
    updateOnlineVideoInfo(url) {
        this.uiController.updateOnlineVideoInfo(url);
    }
    
    /** 显示状态消息 */
    showStatus(message, type) {
        this.uiController.showStatus(message, type);
    }
    
    /**
     * 测量文本在 Canvas 上的渲染宽度，并使用缓存以提高性能。
     * @param {string} text - 需要测量的文本。
     * @returns {number} 文本的宽度（像素）。
     */
    measureTextWidth(text) {
        // 获取当前的字体设置作为缓存键的一部分
        const currentFont = this.ctx.font;
        const cacheKey = `${currentFont}|${text}`;
        
        // 如果缓存中已有结果，直接返回
        if (this.textMetricsCache.has(cacheKey)) {
            return this.textMetricsCache.get(cacheKey);
        }
        
        // 否则，进行测量
        const width = this.ctx.measureText(text).width;
        // 将结果存入缓存
        this.textMetricsCache.set(cacheKey, width);
        return width;
    }
}
