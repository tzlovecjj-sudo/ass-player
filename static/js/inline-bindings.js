// 绑定以前由内联事件处理器实现的行为，使用 addEventListener 替代 inline onclick
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
            // 绑定移动/桌面切换链接（原先使用 inline onclick 设置 localStorage）
            var forceLink = document.getElementById('forceDesktopLink');
            if(forceLink){
                forceLink.addEventListener('click', function(e){
                    try{ localStorage.setItem('forceDesktop','1'); }catch(err){}
                    // 让链接的默认行为继续（跳转到 ?desktop=1）
                });
            }

            // 在此处可以继续注册其它需要替换的内联事件绑定
        }catch(e){
            console.warn('inline-bindings error', e);
        }
    });
})();
