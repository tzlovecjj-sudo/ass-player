// 配置管理模块
// 定义播放器的各种常量配置，包括默认字幕样式、播放器行为配置和 DOM 元素选择器。

/**
 * @constant {Object} DEFAULT_STYLES
 * @description 默认的 ASS 字幕样式配置。
 * 这些值用于在 ASS 文件中未明确指定样式时作为回退。
 */
export const DEFAULT_STYLES = {
    fontName: 'Microsoft YaHei', // 字体名称
    fontSize: 20,                // 字体大小
    primaryColor: 'white',       // 主要颜色 (前景)
    outlineColor: 'black',       // 描边颜色
    shadowColor: 'black',        // 阴影颜色
    bold: false,                 // 是否粗体
    italic: false,               // 是否斜体
    underline: false,            // 是否下划线
    strikeout: false,            // 是否删除线
    scaleX: 100,                 // X 轴缩放百分比
    scaleY: 100,                 // Y 轴缩放百分比
    spacing: 0,                  // 字符间距
    angle: 0,                    // 旋转角度
    borderStyle: 1,              // 边框样式 (1=描边+阴影, 3=不透明方框)
    outline: 1,                  // 描边宽度
    shadow: 0,                   // 阴影深度
    alignment: 2,                // 对齐方式 (1-9，数字键盘布局)
    marginL: 20,                 // 左边距
    marginR: 20,                 // 右边距
    marginV: 40,                 // 垂直边距
    encoding: 1                  // 字符集编码 (1=ANSI, 0=UTF-8, etc.)
};

/**
 * @constant {Object} PLAYER_CONFIG
 * @description 播放器核心配置。
 */
export const PLAYER_CONFIG = {
    defaultPlayResX: 1920, // 默认的字幕渲染分辨率宽度
    defaultPlayResY: 1080, // 默认的字幕渲染分辨率高度
    controlsHideDelay: 3000 // 控制栏自动隐藏的延迟时间（毫秒）
};

/**
 * @constant {Object} DOM_SELECTORS
 * @description 页面中主要 DOM 元素的 CSS 选择器。
 * 用于在 JavaScript 中方便地获取这些元素的引用。
 */
export const DOM_SELECTORS = {
    videoPlayer: '#videoPlayer',             // 视频播放器元素
    videoCanvas: '#videoCanvas',             // 字幕渲染画布
    currentTime: '#currentTime',             // 当前时间显示（可能已废弃）
    subtitlePreview: '#subtitlePreview',     // 字幕预览区域
    progressBar: '#progressBar',             // 整个进度条容器
    progress: '#progress',                   // 已播放进度条
    currentProgressTime: '#currentProgressTime', // 当前时间文本
    totalTime: '#totalTime',                 // 总时长文本
    playPauseBtn: '#playPauseBtn',           // 播放/暂停按钮
    restartBtn: '#restartBtn',               // 重新播放按钮
    fullscreenBtn: '#fullscreenBtn',         // 全屏按钮
    videoFileInput: '#videoFile',            // 视频文件输入框
    subtitleFileInput: '#subtitleFile',      // 字幕文件输入框
    loadOnlineVideoBtn: '#loadOnlineVideoBtn', // 加载在线视频按钮
    onlineVideoUrl: '#onlineVideoUrl',       // 在线视频 URL 输入框
    controls: '.controls'                    // 控制栏容器
};
