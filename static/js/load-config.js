// 从后端拉取运行时配置并动态加载需要的脚本，避免在模板中使用内联脚本以触发 CSP 限制。
(function(){
    async function load() {
        try{
            const resp = await fetch('/config.json', {cache: 'no-store'});
            if(resp.ok){
                const data = await resp.json();
                window.ASS_PLAYER_CONFIG = data.ASS_PLAYER_CONFIG || {};
                window.CANVAS_RENDER_OPTIONS = data.CANVAS_RENDER_OPTIONS || {downscale:0.6,maxFps:20,useOffscreen:true};
            } else {
                window.ASS_PLAYER_CONFIG = window.ASS_PLAYER_CONFIG || {};
                window.CANVAS_RENDER_OPTIONS = window.CANVAS_RENDER_OPTIONS || {downscale:0.6,maxFps:20,useOffscreen:true};
            }
        }catch(e){
            // 在拉取失败时使用默认值，避免阻塞页面
            window.ASS_PLAYER_CONFIG = window.ASS_PLAYER_CONFIG || {};
            window.CANVAS_RENDER_OPTIONS = window.CANVAS_RENDER_OPTIONS || {downscale:0.6,maxFps:20,useOffscreen:true};
        }

        // 加载移动端初始化脚本（非 module）
        try{
            const s1 = document.createElement('script');
            s1.src = '/static/js/mobile-init.js';
            s1.defer = true;
            document.head.appendChild(s1);
        }catch(e){console.warn('加载 mobile-init.js 失败', e)}

        // 加载替代内联绑定的脚本（将内联 onclick 等替换为 addEventListener）
        try{
            const sbind = document.createElement('script');
            sbind.src = '/static/js/inline-bindings.js';
            sbind.defer = true;
            document.head.appendChild(sbind);
        }catch(e){console.warn('加载 inline-bindings.js 失败', e)}

        // 动态加载模块化主脚本（确保在配置就绪后执行）
        try{
            const s2 = document.createElement('script');
            s2.type = 'module';
            s2.src = '/static/js/modules/main.js';
            document.head.appendChild(s2);
        }catch(e){console.warn('加载 modules/main.js 失败', e)}

        // 将之前的 forceDesktop 行为合并到这里，避免内联脚本
        try{
            var force = localStorage.getItem('forceDesktop');
            if(force === '1'){
                localStorage.removeItem('forceDesktop');
                window.location.href = '/';
            }
        }catch(e){}
    }

    // 立即触发加载流程
    load();
})();
