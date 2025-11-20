// 移动端初始化脚本：处理音量按钮弹出、音量滑块同步与点击外部关闭
(function(){
    function onReady(fn){
        if(document.readyState === 'complete' || document.readyState === 'interactive'){
            setTimeout(fn, 0);
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }

    onReady(function(){
        try{
            var muteBtn = document.getElementById('muteBtn');
            var volumePopup = document.createElement('div');
            volumePopup.id = 'mobileVolumePopup';
            // 使用独立 id 避免与桌面端的静态滑块冲突
            volumePopup.innerHTML = '<input id="mobileVolumeSlider" type="range" min="0" max="1" step="0.01" value="1" />';
            // 将弹出层附到 controls-right 容器，若不存在则附到 body
            var container = document.querySelector('.controls-right') || document.body;
            container.style.position = container.style.position || 'relative';
            container.appendChild(volumePopup);

            var slider = document.getElementById('mobileVolumeSlider');
            var video = document.getElementById('videoPlayer');

            // 隐藏页面上原有的桌面音量滑块，避免与移动弹出滑块重复显示
            try {
                var originalSlider = document.getElementById('volumeSlider');
                if (originalSlider) {
                    originalSlider.classList.add('hidden-mobile-volume');
                }
            } catch (e) { /* 忽略 */ }

            function updateMuteIcon(){
                if(!muteBtn || !video) return;
                try{
                    if(video.muted || Math.abs(video.volume - 0) < 1e-6){
                        muteBtn.textContent = '🔇';
                    } else {
                        muteBtn.textContent = '🔊';
                    }
                }catch(e){}
            }

            // 点击音量图标显示/隐藏弹出层
            if(muteBtn){
                muteBtn.addEventListener('click', function(e){
                    e.stopPropagation();
                    volumePopup.classList.toggle('visible');
                    // 同步 slider 到当前音量
                    try{
                        var v = (video && typeof video.volume === 'number') ? video.volume : 1;
                        slider.value = v;
                    }catch(err){}
                });
            }

            // 滑动音量条时同步到 video 元素
            slider.addEventListener('input', function(e){
                try{
                    var val = parseFloat(e.target.value);
                    if(video){
                        video.volume = val;
                        video.muted = (val === 0);
                    }
                    updateMuteIcon();
                }catch(err){}
            });

            // 点击外部区域时隐藏弹出层
            document.addEventListener('click', function(e){
                if(!volumePopup.contains(e.target) && e.target !== muteBtn){
                    volumePopup.classList.remove('visible');
                }
            });

            // 如果页面已有全局播放器实例，监听其音量变化以更新图标
            try{
                if(window._ASS_PLAYER_INSTANCE && window._ASS_PLAYER_INSTANCE.videoPlayer){
                    var vp = window._ASS_PLAYER_INSTANCE.videoPlayer;
                    vp.addEventListener('volumechange', updateMuteIcon);
                    updateMuteIcon();
                }
            }catch(e){}
        }catch(e){
            console.warn('mobile-init error', e);
        }
    });

    // 移动端全屏与横屏监听：当切换到横屏时尝试进入全屏，回到竖屏时退出全屏
    onReady(function(){
        try{
            var fsBtn = document.getElementById('fullscreenBtn');
            var videoWrap = document.querySelector('.video-wrap') || document.getElementById('videoPlayer') || document.documentElement;

            function isFullscreen(){
                return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            }

            function requestFullscreen(el){
                el = el || document.documentElement;
                if(el.requestFullscreen){ return el.requestFullscreen(); }
                if(el.webkitRequestFullscreen){ return el.webkitRequestFullscreen(); }
                if(el.msRequestFullscreen){ return el.msRequestFullscreen(); }
                return Promise.resolve();
            }

            function exitFullscreen(){
                if(document.exitFullscreen){ return document.exitFullscreen(); }
                if(document.webkitExitFullscreen){ return document.webkitExitFullscreen(); }
                if(document.msExitFullscreen){ return document.msExitFullscreen(); }
                return Promise.resolve();
            }

            if(fsBtn){
                fsBtn.addEventListener('click', function(e){
                    try{
                        if(isFullscreen()){
                            exitFullscreen();
                        } else {
                            requestFullscreen(videoWrap);
                        }
                    }catch(err){/* 忽略 */}
                });
            }

            // 方向变化处理：优先使用 Screen Orientation API
            function onOrientationChange(){
                try{
                    var isLandscape = false;
                    if(window.screen && screen.orientation && screen.orientation.type){
                        isLandscape = String(screen.orientation.type).indexOf('landscape') === 0;
                    } else if(window.matchMedia){
                        isLandscape = window.matchMedia('(orientation: landscape)').matches;
                    }

                    if(isLandscape){
                        // 尝试进入全屏（可能因浏览器策略被拒绝）
                        requestFullscreen(videoWrap).catch(function(){});
                    } else {
                        if(isFullscreen()){
                            exitFullscreen().catch(function(){});
                        }
                    }
                }catch(e){/* 忽略 */}
            }

            if(window.screen && screen.orientation && screen.orientation.addEventListener){
                screen.orientation.addEventListener('change', onOrientationChange);
            } else {
                window.addEventListener('orientationchange', onOrientationChange);
                if(window.matchMedia){
                    var mq = window.matchMedia('(orientation: landscape)');
                    if(mq.addEventListener){ mq.addEventListener('change', onOrientationChange); }
                    else if(mq.addListener){ mq.addListener(onOrientationChange); }
                }
            }

            // 初始检查
            onOrientationChange();
        }catch(e){
            console.warn('mobile-fullscreen-init error', e);
        }
    });
})();
