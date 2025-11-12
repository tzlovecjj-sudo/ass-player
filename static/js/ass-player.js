// ASS播放器核心逻辑 - 重构后的ES6模块化版本
import SubtitleRenderer from './subtitle-renderer.js';
import FullscreenControls from './fullscreen-controls.js';
import VideoParser from './video-parser.js';
import VideoController from './modules/video-controller.js';
import UIController from './modules/ui-controller.js';
import FileHandler from './modules/file-handler.js';
import ProgressController from './modules/progress-controller.js';
import { DEFAULT_STYLES, PLAYER_CONFIG } from './modules/config.js';

export default class EmbeddedASSPlayer {
    constructor() {
        console.log('初始化EmbeddedASSPlayer...');
        
        this.initializeProperties();
        this.getDOMElements();
        
        if (!this.verifyDOMElements()) {
            console.error('必要的DOM元素缺失');
            return;
        }
        
        this.initializeContext();
        this.initializeControllers();
        this.initializeEventListeners();
        
        console.log('播放器初始化完成');
    }
    
    initializeProperties() {
        this.subtitles = [];
        this.styles = {};
        this.playResX = PLAYER_CONFIG.defaultPlayResX;
        this.playResY = PLAYER_CONFIG.defaultPlayResY;
        this.currentSubtitleIndex = -1;
        this.animationId = null;
        this.currentSubtitleText = '';
        this.textMetricsCache = new Map();
        
        // 默认字幕样式
        this.defaultStyle = DEFAULT_STYLES;

        // 初始化字幕渲染器
        this.subtitleRenderer = new SubtitleRenderer(this);
        // 初始化全屏控制器
        this.fullscreenControls = new FullscreenControls(this);
        // 初始化视频解析器
        this.videoParser = new VideoParser();
    }
    
    initializeControllers() {
        this.videoController = new VideoController(this);
        this.uiController = new UIController(this);
        this.fileHandler = new FileHandler(this);
        this.progressController = new ProgressController(this);
    }
    
    getDOMElements() {
        // 视频和Canvas元素
        this.videoPlayer = document.getElementById('videoPlayer');
        this.videoCanvas = document.getElementById('videoCanvas');
        
        // 显示元素
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.subtitlePreview = document.getElementById('subtitlePreview');
        
        // 进度条元素
        this.progressBar = document.getElementById('progressBar');
        this.progress = document.getElementById('progress');
        this.currentProgressTime = document.getElementById('currentProgressTime');
        this.totalTime = document.getElementById('totalTime');
        
        // 控制按钮
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // 文件输入
        this.videoFileInput = document.getElementById('videoFile');
        this.subtitleFileInput = document.getElementById('subtitleFile');
        
        // 在线视频相关
        this.loadOnlineVideoBtn = document.getElementById('loadOnlineVideoBtn');
        this.onlineVideoUrl = document.getElementById('onlineVideoUrl');
        
        // 控制栏元素
        this.controls = document.querySelector('.controls');
    }
    
    verifyDOMElements() {
        const requiredElements = [
            this.videoPlayer, this.videoCanvas, this.playPauseBtn,
            this.videoFileInput, this.subtitleFileInput
        ];
        
        for (const element of requiredElements) {
            if (!element) {
                console.error('缺少必要的DOM元素:', element);
                return false;
            }
        }
        
        return true;
    }
    
    initializeContext() {
        this.ctx = this.videoCanvas.getContext('2d');
    }
    
    initializeEventListeners() {
        console.log('设置事件监听器...');
        
        // 事件监听器设置 - 委托给相应的控制器
        this.videoFileInput.addEventListener('change', (e) => {
            this.fileHandler.loadVideo(e.target.files[0]);
        });
        
        this.subtitleFileInput.addEventListener('change', (e) => {
            this.fileHandler.loadSubtitles(e.target.files[0]);
        });
        
        this.loadOnlineVideoBtn.addEventListener('click', () => {
            this.fileHandler.loadOnlineVideo();
        });
                
        this.playPauseBtn.addEventListener('click', () => {
            this.videoController.togglePlayPause();
        });
        
        this.restartBtn.addEventListener('click', () => {
            this.videoController.restartVideo();
        });
        
        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        this.progressBar.addEventListener('mousedown', (e) => {
            this.progressController.startSeeking(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.progressController.isSeeking) {
                this.progressController.handleSeeking(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.progressController.stopSeeking();
        });
        
        // 视频事件
        this.videoPlayer.addEventListener('loadedmetadata', () => {
            this.videoController.onVideoLoaded();
        });
        
        this.videoPlayer.addEventListener('timeupdate', () => {
            this.videoController.onTimeUpdate();
        });
        
        this.videoPlayer.addEventListener('ended', () => {
            this.videoController.onVideoEnded();
        });
        
        this.videoPlayer.addEventListener('play', () => {
            this.videoController.onVideoPlay();
        });
        
        this.videoPlayer.addEventListener('pause', () => {
            this.videoController.onVideoPause();
        });
        
        this.videoPlayer.addEventListener('error', (e) => {
            console.error('视频播放错误:', e);
            this.showStatus('视频播放错误: ' + this.videoPlayer.error?.message, 'error');
        });
        
        // 窗口大小改变
        window.addEventListener('resize', () => {
            this.uiController.onWindowResize();
        });
        
        // 全屏状态变化
        document.addEventListener('fullscreenchange', () => {
            this.onFullscreenChange();
        });
        
        document.addEventListener('webkitfullscreenchange', () => {
            this.onFullscreenChange();
        });
        
        document.addEventListener('mozfullscreenchange', () => {
            this.onFullscreenChange();
        });
        
        // 控制栏自动隐藏
        if (this.videoCanvas) {
            this.videoCanvas.addEventListener('mousemove', () => {
                this.showControlsTemporarily();
            });
        }
        
        if (this.controls) {
            this.controls.addEventListener('mousemove', (e) => {
                e.stopPropagation();
                this.showControlsTemporarily();
            });
        }
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
        
        console.log('事件监听器设置完成');
    }
    
    // 渲染方法
    startRendering() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        const renderFrame = () => {
            this.subtitleRenderer.renderVideoWithSubtitles();
            this.animationId = requestAnimationFrame(renderFrame);
        };
        
        this.animationId = requestAnimationFrame(renderFrame);
        console.log('开始渲染');
    }
    
    stopRendering() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        console.log('停止渲染');
    }
    
    // 全屏控制
    toggleFullscreen() {
        this.fullscreenControls.toggleFullscreen();
    }
    
    onFullscreenChange() {
        this.fullscreenControls.handleBrowserFullscreenChange();
    }
    
    // 控制栏显示/隐藏
    showControls() {
        this.fullscreenControls.showControls();
    }
    
    hideControls() {
        this.fullscreenControls.hideControls();
    }
    
    showControlsPermanently() {
        this.fullscreenControls.showControlsPermanently();
    }
    
    hideControlsAfterDelay() {
        this.fullscreenControls.hideControlsAfterDelay();
    }
    
    showControlsTemporarily() {
        this.fullscreenControls.showControlsTemporarily();
    }
    
    // 键盘控制
    handleKeyboard(e) {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.videoController.togglePlayPause();
                break;
            case 'Escape':
                this.fullscreenControls.handleEscapeKey();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.videoController.seekTo(Math.max(0, this.videoPlayer.currentTime - 5));
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.videoController.seekTo(Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + 5));
                break;
        }
    }
    
    // 代理方法 - 保持向后兼容
    setupCanvas() {
        this.uiController.setupCanvas();
    }
    
    updatePlayPauseButton(isPlaying) {
        this.uiController.updatePlayPauseButton(isPlaying);
    }
    
    updateVideoInfo(file) {
        this.uiController.updateVideoInfo(file);
    }
    
    updateSubtitleInfo(file) {
        this.uiController.updateSubtitleInfo(file);
    }
    
    updateOnlineVideoInfo(url) {
        this.uiController.updateOnlineVideoInfo(url);
    }
    
    showStatus(message, type) {
        this.uiController.showStatus(message, type);
    }
    
    // 文本测量（带缓存）
    measureTextWidth(text) {
        if (this.textMetricsCache.has(text)) {
            return this.textMetricsCache.get(text);
        }
        
        const width = this.ctx.measureText(text).width;
        this.textMetricsCache.set(text, width);
        return width;
    }
}
