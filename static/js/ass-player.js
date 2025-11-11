// ASS播放器核心逻辑 - 完整ASS渲染版本（非模块化）

class EmbeddedASSPlayer {
    constructor() {
        console.log('初始化EmbeddedASSPlayer...');
        
        this.initializeProperties();
        this.getDOMElements();
        
        if (!this.verifyDOMElements()) {
            console.error('必要的DOM元素缺失');
            return;
        }
        
        this.initializeContext();
        this.initializeState();
        this.initializeEventListeners();
        
        console.log('播放器初始化完成');
    }
    
    initializeProperties() {
        this.subtitles = [];
        this.styles = {};
        this.playResX = 1920;
        this.playResY = 1080;
        this.currentSubtitleIndex = -1;
        this.animationId = null;
        this.currentSubtitleText = '';
        this.isSeeking = false;
        this.isWebFullscreen = false;
        this.isBrowserFullscreen = false;
        this.controlsHideTimeout = null;
        this.mouseMoveTimeout = null;
        this.textMetricsCache = new Map();
        
        // 默认字幕样式
        this.defaultStyle = {
            fontName: 'Microsoft YaHei',
            fontSize: 20,
            primaryColor: 'white',
            outlineColor: 'black',
            shadowColor: 'black',
            bold: false,
            italic: false,
            underline: false,
            strikeout: false,
            scaleX: 100,
            scaleY: 100,
            spacing: 0,
            angle: 0,
            borderStyle: 1,
            outline: 1,
            shadow: 0,
            alignment: 2,
            marginL: 20,
            marginR: 20,
            marginV: 40,
            encoding: 1
        };

        // 初始化字幕渲染器
        this.subtitleRenderer = new SubtitleRenderer(this);
        // 初始化全屏控制器
        this.fullscreenControls = new FullscreenControls(this);
        // 初始化视频解析器
        this.videoParser = new VideoParser();
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
        this.proxyUrl = document.getElementById('proxyUrl');
        this.testProxyBtn = document.getElementById('testProxyBtn');
        
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
    
    initializeState() {
        // 初始化状态变量
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
    }
    
    initializeEventListeners() {
        console.log('设置事件监听器...');
        
        // 视频文件选择
        this.videoFileInput.addEventListener('change', (e) => {
            console.log('视频文件已选择:', e.target.files[0]);
            this.loadVideo(e.target.files[0]);
        });
        
        // 字幕文件选择
        this.subtitleFileInput.addEventListener('change', (e) => {
            console.log('字幕文件已选择:', e.target.files[0]);
            this.loadSubtitles(e.target.files[0]);
        });
        
	// 在线视频加载按钮事件
	this.loadOnlineVideoBtn.addEventListener('click', () => {
	    this.loadOnlineVideo();
	});
            
        // 控制按钮
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        this.restartBtn.addEventListener('click', () => {
            this.restartVideo();
        });
        
        // 全屏按钮
        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // 进度条事件
        this.progressBar.addEventListener('mousedown', (e) => {
            this.startSeeking(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isSeeking) {
                this.handleSeeking(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.stopSeeking();
        });
        
        // 视频事件
        this.videoPlayer.addEventListener('loadedmetadata', () => {
            this.onVideoLoaded();
        });
        
        this.videoPlayer.addEventListener('timeupdate', () => {
            this.onTimeUpdate();
        });
        
        this.videoPlayer.addEventListener('ended', () => {
            this.onVideoEnded();
        });
        
        this.videoPlayer.addEventListener('play', () => {
            this.onVideoPlay();
        });
        
        this.videoPlayer.addEventListener('pause', () => {
            this.onVideoPause();
        });
        
        this.videoPlayer.addEventListener('error', (e) => {
            console.error('视频播放错误:', e);
            this.showStatus('视频播放错误: ' + this.videoPlayer.error?.message, 'error');
        });
        
        // 窗口大小改变
        window.addEventListener('resize', () => {
            this.onWindowResize();
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
    
    // 视频控制方法
    togglePlayPause() {
        if (this.videoPlayer.paused) {
            this.videoPlayer.play().then(() => {
                this.startRendering();
                this.updatePlayPauseButton(true);
            }).catch(error => {
                console.error('播放失败:', error);
                this.showStatus('播放失败: ' + error.message, 'error');
            });
        } else {
            this.videoPlayer.pause();
            this.stopRendering();
            this.updatePlayPauseButton(false);
        }
    }
    
    restartVideo() {
        this.videoPlayer.currentTime = 0;
        if (this.videoPlayer.paused) {
            this.startRendering();
            this.updatePlayPauseButton(true);
        }
    }
    
    // 视频加载方法
    loadVideo(file) {
        if (!file) {
            console.error('没有选择文件');
            return;
        }
        
        console.log('加载视频文件:', file.name, '类型:', file.type);
        
        // 验证文件类型
        if (!file.type.startsWith('video/')) {
            this.showStatus('请选择有效的视频文件', 'error');
            return;
        }
        
        // 创建对象URL
        const url = URL.createObjectURL(file);
        console.log('创建的对象URL:', url);
        
        // 重置视频元素
        this.videoPlayer.src = url;
        this.videoPlayer.load();
        
        // 更新文件信息
        this.updateVideoInfo(file);
        
        this.showStatus('视频文件加载成功', 'success');
    }
    
    updateVideoInfo(file) {
        const videoInfo = document.getElementById('videoInfo');
        if (videoInfo) {
            videoInfo.textContent = `视频文件: ${file.name} (${this.formatFileSize(file.size)})`;
        }
    }
    
    loadSubtitles(file) {
        if (!file) return;
        
        console.log('加载字幕文件:', file.name);
        
        // 验证文件类型
        if (!file.name.toLowerCase().endsWith('.ass')) {
            this.showStatus('请选择ASS字幕文件', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.subtitleRenderer.parseASSFile(e.target.result);
                this.updateSubtitleInfo(file);
                this.showStatus('字幕文件解析成功', 'success');
                console.log('解析到的字幕数量:', this.subtitles.length);
                console.log('解析到的样式数量:', Object.keys(this.styles).length);
            } catch (error) {
                this.showStatus('字幕文件解析失败: ' + error.message, 'error');
                console.error('ASS解析错误:', error);
            }
        };
        reader.onerror = () => {
            this.showStatus('读取字幕文件失败', 'error');
        };
        reader.readAsText(file, 'utf-8');
    }
    
    updateSubtitleInfo(file) {
        const subtitleInfo = document.getElementById('subtitleInfo');
        if (subtitleInfo) {
            subtitleInfo.textContent = 
                `字幕文件: ${file.name} (${this.formatFileSize(file.size)}) - ${this.subtitles.length} 条字幕, ${Object.keys(this.styles).length} 种样式`;
        }
    }
    
    // 渲染方法
    setupCanvas() {
        if (!this.videoPlayer.videoWidth || !this.videoPlayer.videoHeight) {
            console.log('视频尺寸未就绪，稍后重试');
            setTimeout(() => this.setupCanvas(), 100);
            return;
        }
        
        console.log('设置Canvas尺寸:', this.videoPlayer.videoWidth, 'x', this.videoPlayer.videoHeight);
        
        // 设置Canvas尺寸与视频相同
        this.videoCanvas.width = this.videoPlayer.videoWidth;
        this.videoCanvas.height = this.videoPlayer.videoHeight;
        
        // 设置Canvas显示尺寸（保持比例）
        const container = this.videoCanvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const videoRatio = this.videoPlayer.videoHeight / this.videoPlayer.videoWidth;
        const containerRatio = containerHeight / containerWidth;
        
        if (containerRatio > videoRatio) {
            // 容器高度相对较大，宽度占满
            this.videoCanvas.style.width = '100%';
            this.videoCanvas.style.height = (containerWidth * videoRatio) + 'px';
        } else {
            // 容器宽度相对较大，高度占满
            this.videoCanvas.style.height = '100%';
            this.videoCanvas.style.width = (containerHeight / videoRatio) + 'px';
        }
        
        console.log('Canvas设置完成');
    }
    
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
    
    // 事件处理方法
    onVideoLoaded() {
        console.log('视频元数据已加载');
        this.setupCanvas();
        this.updateTotalTime();
        this.showStatus('视频已加载，可以开始播放', 'success');
    }
    
    onTimeUpdate() {
        this.updateCurrentTime();
        this.updateProgress();
    }
    
    onVideoEnded() {
        this.stopRendering();
        this.updatePlayPauseButton(false);
        this.showStatus('视频播放结束', 'info');
    }
    
    onVideoPlay() {
        this.startRendering();
        this.updatePlayPauseButton(true);
    }
    
    onVideoPause() {
        this.stopRendering();
        this.updatePlayPauseButton(false);
    }
    
    onWindowResize() {
        if (this.videoPlayer.videoWidth && this.videoPlayer.videoHeight) {
            this.setupCanvas();
        }
    }
    
    onFullscreenChange() {
        this.isBrowserFullscreen = !!document.fullscreenElement;
        
        if (this.isBrowserFullscreen) {
            document.body.classList.add('browser-fullscreen-mode');
            if (this.fullscreenBtn) {
                this.fullscreenBtn.title = "退出全屏";
                this.fullscreenBtn.classList.add('active');
            }
        } else {
            document.body.classList.remove('browser-fullscreen-mode');
            if (this.fullscreenBtn) {
                this.fullscreenBtn.title = "网页全屏";
                this.fullscreenBtn.classList.remove('active');
            }
            this.showControlsPermanently();
        }
        
        this.setupCanvas();
        this.startRendering();
    }
    
    // 进度条控制
    startSeeking(e) {
        this.isSeeking = true;
        this.handleProgressClick(e);
    }
    
    handleSeeking(e) {
        this.handleProgressClick(e);
    }
    
    stopSeeking() {
        this.isSeeking = false;
    }
    
    handleProgressClick(e) {
        if (!this.videoPlayer.duration) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * this.videoPlayer.duration;
        
        this.videoPlayer.currentTime = time;
        if (this.progress) {
            this.progress.style.width = `${percent * 100}%`;
        }
        
        if (this.currentProgressTime) {
            this.currentProgressTime.textContent = this.formatTime(time);
        }
        
        this.startRendering();
    }
    
    // 时间显示更新
    updateCurrentTime() {
        const time = this.videoPlayer.currentTime || 0;
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        const cs = Math.floor((time % 1) * 100);
        
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
        }
    }
    
    updateProgress() {
        if (!this.videoPlayer.duration || this.isSeeking) return;
        
        const progress = (this.videoPlayer.currentTime / this.videoPlayer.duration) * 100;
        if (this.progress) {
            this.progress.style.width = `${progress}%`;
        }
        
        if (this.currentProgressTime) {
            this.currentProgressTime.textContent = this.formatTime(this.videoPlayer.currentTime);
        }
    }
    
    updateTotalTime() {
        if (!this.videoPlayer.duration) return;
        
        if (this.totalTime) {
            this.totalTime.textContent = this.formatTime(this.videoPlayer.duration);
        }
    }
    
    updatePlayPauseButton(isPlaying) {
        if (this.playPauseBtn) {
            this.playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
            this.playPauseBtn.title = isPlaying ? '暂停' : '播放';
        }
    }
    
    // 全屏控制
    toggleFullscreen() {
        if (!this.isWebFullscreen && !this.isBrowserFullscreen) {
            this.enterWebFullscreen();
        } else if (this.isWebFullscreen && !this.isBrowserFullscreen) {
            this.exitWebFullscreen();
        } else if (this.isBrowserFullscreen) {
            this.exitBrowserFullscreen();
        }
    }
    
    enterWebFullscreen() {
        document.body.classList.add('web-fullscreen-mode');
        this.isWebFullscreen = true;
        
        if (this.fullscreenBtn) {
            this.fullscreenBtn.title = "退出全屏";
            this.fullscreenBtn.classList.add('active');
        }
        
        this.setupCanvas();
        this.startRendering();
        
        this.showControls();
        this.hideControlsAfterDelay();
    }
    
    exitWebFullscreen() {
        document.body.classList.remove('web-fullscreen-mode');
        this.isWebFullscreen = false;
        
        if (this.fullscreenBtn) {
            this.fullscreenBtn.title = "网页全屏";
            this.fullscreenBtn.classList.remove('active');
        }
        
        this.showControlsPermanently();
        this.setupCanvas();
        this.startRendering();
    }
    
    enterBrowserFullscreen() {
        const container = document.documentElement;
        
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
            container.mozRequestFullScreen();
        }
        
        this.showControls();
        this.hideControlsAfterDelay();
    }
    
    exitBrowserFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        }
        
        this.showControlsPermanently();
    }
    
    // 控制栏显示/隐藏
    showControls() {
        if ((this.isWebFullscreen || this.isBrowserFullscreen) && this.controls) {
            this.controls.classList.add('visible');
        }
    }
    
    hideControls() {
        if ((this.isWebFullscreen || this.isBrowserFullscreen) && this.controls) {
            this.controls.classList.remove('visible');
        }
    }
    
    showControlsPermanently() {
        if (this.controlsHideTimeout) {
            clearTimeout(this.controlsHideTimeout);
            this.controlsHideTimeout = null;
        }
        if (this.mouseMoveTimeout) {
            clearTimeout(this.mouseMoveTimeout);
            this.mouseMoveTimeout = null;
        }
        
        if (this.controls) {
            this.controls.classList.add('visible');
        }
    }
    
    hideControlsAfterDelay() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            if (this.controlsHideTimeout) {
                clearTimeout(this.controlsHideTimeout);
            }
            
            this.controlsHideTimeout = setTimeout(() => {
                this.hideControls();
            }, 3000);
        }
    }
    
    showControlsTemporarily() {
        if (this.isWebFullscreen || this.isBrowserFullscreen) {
            this.showControls();
            this.hideControlsAfterDelay();
        }
    }
    
    // 键盘控制
    handleKeyboard(e) {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'Escape':
                if (this.isWebFullscreen) {
                    this.exitWebFullscreen();
                } else if (this.isBrowserFullscreen) {
                    this.exitBrowserFullscreen();
                }
                this.showControlsPermanently();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - 5);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + 5);
                break;
        }
    }
    
    // 工具方法
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    showStatus(message, type) {
        const statusEl = document.getElementById('uploadStatus');
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
    
    // 文本测量（带缓存）
    measureTextWidth(text) {
        if (this.textMetricsCache.has(text)) {
            return this.textMetricsCache.get(text);
        }
        
        const width = this.ctx.measureText(text).width;
        this.textMetricsCache.set(text, width);
        return width;
    }
    
	// 在线视频加载方法
	loadOnlineVideo() {
	const url = this.onlineVideoUrl.value.trim();
	if (!url) {
	    this.showStatus('请输入视频URL', 'error');
	    return;
	}

	this.showStatus('正在解析视频...', 'info');

	// 使用内置代理解析视频
	this.videoParser.parseVideo(url, true)
	    .then(videoUrl => {
	        console.log('✅ 视频解析成功:', videoUrl);
	        this.showStatus('视频解析成功，正在加载...', 'success');
	        
	        // 设置视频源
	        this.videoPlayer.src = videoUrl;
	        this.videoPlayer.load();
	        
	        // 监听视频错误
	        this.videoPlayer.onerror = () => {
	            console.error('❌ 视频加载失败');
	            this.showStatus('视频加载失败，请尝试其他视频URL', 'error');
	        };
	        
	        // 监听视频可以播放
	        this.videoPlayer.oncanplay = () => {
	            console.log('✅ 视频可以播放');
	            this.showStatus('视频加载完成，可以播放', 'success');
	        };
	        
	        // 更新文件信息
	        this.updateOnlineVideoInfo(url);
	    })
	    .catch(error => {
	        console.error('❌ 视频解析失败:', error);
	        this.showStatus(`视频解析失败: ${error.message}`, 'error');
	    });
	}

	//更新在线视频信息
	updateOnlineVideoInfo(url) {
	const videoInfo = document.getElementById('videoInfo');
	if (videoInfo) {
	    videoInfo.textContent = `在线视频: ${url} (使用内置代理)`;
	}
	}
}