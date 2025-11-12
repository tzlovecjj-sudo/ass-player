// 配置管理模块
export const DEFAULT_STYLES = {
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

export const PLAYER_CONFIG = {
    defaultPlayResX: 1920,
    defaultPlayResY: 1080,
    controlsHideDelay: 3000
};

export const DOM_SELECTORS = {
    videoPlayer: '#videoPlayer',
    videoCanvas: '#videoCanvas',
    currentTime: '#currentTime',
    subtitlePreview: '#subtitlePreview',
    progressBar: '#progressBar',
    progress: '#progress',
    currentProgressTime: '#currentProgressTime',
    totalTime: '#totalTime',
    playPauseBtn: '#playPauseBtn',
    restartBtn: '#restartBtn',
    fullscreenBtn: '#fullscreenBtn',
    videoFileInput: '#videoFile',
    subtitleFileInput: '#subtitleFile',
    loadOnlineVideoBtn: '#loadOnlineVideoBtn',
    onlineVideoUrl: '#onlineVideoUrl',
    controls: '.controls'
};