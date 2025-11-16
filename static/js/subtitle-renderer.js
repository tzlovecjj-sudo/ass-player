// 字幕渲染模块 - ES6 模块化版本
export default class SubtitleRenderer {
    /**
     * 构造函数
     * @param {EmbeddedASSPlayer} player - 播放器主实例的引用
     */
    constructor(player) {
        this.player = player; // 保存对主播放器实例的引用
    }

    /**
     * 解析完整的 ASS (Advanced SubStation Alpha) 字幕文件内容。
     * 该方法会提取字幕信息、样式定义和脚本信息（如分辨率）。
     * @param {string} content - ASS 文件的全部文本内容
     */
    parseASSFile(content) {
        // 清空旧的字幕和样式数据
        this.player.subtitles = [];
        this.player.styles = {};
        // 清除文本测量缓存，因为字体或缩放可能已改变
        this.player.textMetricsCache.clear();
        
        const lines = content.split('\n'); // 按行分割文件内容
        
        // 标志变量，用于识别当前正在解析的 ASS 文件区域
        let inScriptInfo = false;  // 是否在 [Script Info] 部分
        let inStylesSection = false; // 是否在 [V4+ Styles] 部分
        let inEventsSection = false; // 是否在 [Events] 部分
        
        let styleFormat = []; // 存储样式部分的 Format 行定义
        let eventFormat = []; // 存储事件部分的 Format 行定义
        
        for (const line of lines) {
            const trimmedLine = line.trim(); // 移除行首尾空白
            
            // 根据方括号内的标题判断当前所在区域
            if (trimmedLine === '[Script Info]') {
                inScriptInfo = true;
                inStylesSection = false;
                inEventsSection = false;
                continue;
            }
            
            if (trimmedLine === '[V4+ Styles]') {
                inScriptInfo = false;
                inStylesSection = true;
                inEventsSection = false;
                continue;
            }
            
            if (trimmedLine === '[Events]') {
                inScriptInfo = false;
                inStylesSection = false;
                inEventsSection = true;
                continue;
            }
            
            // 解析 [Script Info] 部分
            if (inScriptInfo) {
                if (trimmedLine.startsWith('PlayResX:')) {
                    // 提取并设置字幕的渲染宽度
                    this.player.playResX = parseInt(trimmedLine.substring(9).trim()) || 1920;
                } else if (trimmedLine.startsWith('PlayResY:')) {
                    // 提取并设置字幕的渲染高度
                    this.player.playResY = parseInt(trimmedLine.substring(9).trim()) || 1080;
                }
                continue;
            }
            
            // 解析 [V4+ Styles] 部分
            if (inStylesSection) {
                if (trimmedLine.startsWith('Format:')) {
                    // 提取样式定义的格式（字段顺序）
                    styleFormat = trimmedLine.substring(7).split(',').map(s => s.trim());
                } else if (trimmedLine.startsWith('Style:')) {
                    // 解析具体的样式行
                    const style = this.parseStyleLine(trimmedLine, styleFormat);
                    if (style && style.name) {
                        this.player.styles[style.name] = style;
                    }
                }
                continue;
            }
            
            // 解析 [Events] 部分
            if (inEventsSection) {
                if (trimmedLine.startsWith('Format:')) {
                    // 提取事件（对话）定义的格式（字段顺序）
                    eventFormat = trimmedLine.substring(7).split(',').map(s => s.trim());
                } else if (trimmedLine.startsWith('Dialogue:') || trimmedLine.startsWith('Comment:')) {
                    // 解析具体的对话或注释行
                    const subtitle = this.parseDialogueLine(trimmedLine, eventFormat);
                    if (subtitle) {
                        this.player.subtitles.push(subtitle);
                    }
                }
                continue;
            }
            
            // 如果遇到新的方括号标题，且不是上述已知部分，则停止当前部分的解析
            if (trimmedLine.startsWith('[') && 
                trimmedLine !== '[Script Info]' && 
                trimmedLine !== '[V4+ Styles]' && 
                trimmedLine !== '[Events]') {
                inScriptInfo = false;
                inStylesSection = false;
                inEventsSection = false;
            }
        }
        
        // 解析完成后，按字幕的开始时间进行排序
        this.player.subtitles.sort((a, b) => a.start - b.start);
        console.log(`ASS 文件解析完成：共 ${this.player.subtitles.length} 条字幕，${Object.keys(this.player.styles).length} 种样式。字幕原始分辨率: ${this.player.playResX}x${this.player.playResY}。`);
    }

    /**
     * 解析 ASS 文件中的 Style 行，提取样式信息。
     * @param {string} line - Style 行的文本内容
     * @param {string[]} format - Style Format 行定义的字段顺序
     * @returns {Object|null} 解析后的样式对象，如果解析失败则返回 null
     */
    parseStyleLine(line, format) {
        // 移除 "Style: " 前缀，并按逗号分割字段值
        const parts = line.substring(6).split(',').map(s => s.trim());
        if (parts.length < format.length) {
            console.warn('样式行字段数量与 Format 不匹配:', line);
            return null;
        }
        
        const style = {};
        for (let i = 0; i < format.length; i++) {
            const key = format[i];
            const value = parts[i];
            
            // 根据 Format 定义的键名，将值解析并存储到样式对象中
                switch (key) {
                case 'Name': style.name = value; break; // 名称
                case 'Fontname': style.fontName = value; break; // 字体名称
                case 'Fontsize': style.fontSize = parseFloat(value); break; // 字号
                case 'PrimaryColour': style.primaryColor = this.parseASSColor(value); break; // 主色 (Primary)
                case 'SecondaryColour': style.secondaryColor = this.parseASSColor(value); break; // 副色 (Secondary)
                case 'OutlineColour': style.outlineColor = this.parseASSColor(value); break; // 描边/轮廓颜色
                case 'BackColour': style.backColor = this.parseASSColor(value); break; // 背景色/盒子色 (Back)
                case 'Bold': style.bold = parseInt(value) === -1; break; // 粗体（-1 表示开启）
                case 'Italic': style.italic = parseInt(value) === -1; break; // 斜体（-1 表示开启）
                case 'Underline': style.underline = parseInt(value) === -1; break; // 下划线（-1 开启）
                case 'StrikeOut': style.strikeout = parseInt(value) === -1; break; // 删除线（-1 开启）
                case 'ScaleX': style.scaleX = parseFloat(value); break; // X 轴缩放 (%)
                case 'ScaleY': style.scaleY = parseFloat(value); break; // Y 轴缩放 (%)
                case 'Spacing': style.spacing = parseFloat(value); break; // 字间距 (spacing)
                case 'Angle': style.angle = parseFloat(value); break; // 旋转角度 (角度)
                case 'BorderStyle': style.borderStyle = parseInt(value); break; // 边框样式 (1: 轮廓+阴影, 3: 实色框)
                case 'Outline': style.outline = parseFloat(value); break; // 轮廓宽度 / 描边宽度
                case 'Shadow': style.shadow = parseFloat(value); break; // 阴影偏移 (shadow)
                case 'Alignment': style.alignment = parseInt(value); break; // 对齐方式 (1-9)
                case 'MarginL': style.marginL = parseInt(value); break; // 左边距
                case 'MarginR': style.marginR = parseInt(value); break; // 右边距
                case 'MarginV': style.marginV = parseInt(value); break; // 垂直边距 (顶/底)
                case 'Encoding': style.encoding = parseInt(value); break; // 字符编码
                default:
                    // 对于未知的或不处理的字段，直接存储原始值
                    style[key.toLowerCase()] = value;
                    break;
            }
        }
        
        return style;
    }

    /**
     * 解析 ASS 颜色字符串（&HAABBGGRR 或 &HBBGGRR）为 RGBA 格式。
     * ASS 颜色格式中，Alpha 值是反向的 (00=不透明, FF=完全透明)。
     * @param {string} colorStr - ASS 颜色字符串，例如 "&H00FFFFFF" (白色不透明)
     * @returns {string} CSS rgba() 格式的颜色字符串
     */
    parseASSColor(colorStr) {
        // 如果不是 ASS 颜色格式，直接返回原始字符串
        if (!colorStr || !colorStr.startsWith('&H')) return colorStr;
        
        let hex = colorStr.substring(2); // 移除 "&H" 前缀
        // 移除末尾可能存在的 '&' 符号，以兼容某些 ASS 导出格式
        if (hex.endsWith('&')) {
            hex = hex.slice(0, -1);
        }

        let r, g, b, a;
        
        if (hex.length === 8) {
            // 格式为 &HAABBGGRR (包含 Alpha 通道)
            a = parseInt(hex.substring(0, 2), 16); // Alpha
            b = parseInt(hex.substring(2, 4), 16); // Blue
            g = parseInt(hex.substring(4, 6), 16); // Green
            r = parseInt(hex.substring(6, 8), 16); // Red
            
            // ASS 的 Alpha 值是反向的，需要转换 (00=不透明 -> 255, FF=完全透明 -> 0)
            a = 255 - a;
        } else if (hex.length === 6) {
            // 格式为 &HBBGGRR (不包含 Alpha 通道，默认为不透明)
            a = 255; // 默认不透明
            b = parseInt(hex.substring(0, 2), 16); // Blue
            g = parseInt(hex.substring(2, 4), 16); // Green
            r = parseInt(hex.substring(4, 6), 16); // Red
        } else {
            // 无效的十六进制颜色长度
            console.warn('无效的 ASS 颜色十六进制字符串或长度:', colorStr, '处理后的hex:', hex);
            return colorStr;
        }
        
        // 返回 CSS rgba() 格式
        return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    }

    /**
     * 解析 ASS 文件中的 Dialogue (对话) 或 Comment (注释) 行，提取字幕事件信息。
     * @param {string} line - Dialogue 或 Comment 行的文本内容
     * @param {string[]} format - Events Format 行定义的字段顺序
     * @returns {Object|null} 解析后的字幕事件对象，如果解析失败则返回 null
     */
    parseDialogueLine(line, format) {
        // 确定行前缀是 'Dialogue:' 还是 'Comment:'
        const prefix = line.startsWith('Dialogue:') ? 'Dialogue:' : 'Comment:';
        const content = line.substring(prefix.length); // 获取实际内容部分
        
        // 复杂分割逻辑：处理文本内容中可能包含的逗号，同时避免分割
        let parts = [];
        let inQuotes = false; // 标志，指示当前是否在双引号内部
        let currentPart = ''; // 当前正在构建的字段部分
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (char === '"') {
                inQuotes = !inQuotes; // 切换引号状态
            } else if (char === ',' && !inQuotes) {
                // 如果遇到逗号且不在引号内，则当前部分结束
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char; // 否则，将字符添加到当前部分
            }
        }
        
        // 添加最后一个部分
        if (currentPart) {
            parts.push(currentPart.trim());
        }
        
        // 如果上述复杂分割后，字段数量仍然少于 Format 定义的数量，
        // 可能是因为文本中没有引号包裹的逗号，或者 Format 字段较少，
        // 此时回退到简单的逗号分割（这可能导致文本被错误分割，但作为备用）
        if (parts.length < format.length) {
            parts = content.split(',').map(s => s.trim());
        }
        
        if (parts.length < format.length) {
            console.warn('对话行字段数量与 Format 不匹配:', line);
            return null;
        }
        
        const subtitle = {};
        let textIndex = -1; // 记录 'Text' 字段的索引，因为其后的所有内容都属于文本
        
        for (let i = 0; i < format.length; i++) {
            const key = format[i];
            const value = parts[i];
            
            switch (key) {
                case 'Start': subtitle.start = this.parseTime(value); break;
                case 'End': subtitle.end = this.parseTime(value); break;
                case 'Style': subtitle.style = value; break;
                case 'Text': textIndex = i; break; // 找到 Text 字段的起始索引
                default:
                    // 对于其他字段，直接存储原始值
                    subtitle[key.toLowerCase()] = value;
                    break;
            }
        }
        
        // 获取完整的文本部分：从 'Text' 字段开始，将其后的所有部分用逗号连接起来
        if (textIndex !== -1) {
            subtitle.text = parts.slice(textIndex).join(',').trim();
            // 移除文本开头和结尾可能存在的双引号
            if (subtitle.text.startsWith('"') && subtitle.text.endsWith('"')) {
                subtitle.text = subtitle.text.substring(1, subtitle.text.length - 1);
            }
        }
        
        // 只有当成功提取到文本内容时，才返回字幕对象
        return subtitle.text ? subtitle : null;
    }

    /**
     * 解析 ASS 时间字符串（例如 "0:00:00.00" 或 "0:00:00.000"）为秒数。
     * @param {string} timeStr - ASS 时间字符串
     * @returns {number} 解析后的时间（秒）
     */
    parseTime(timeStr) {
        // 期望格式为 H:MM:SS.CS 或 H:MM:SS.MS
        const parts = timeStr.split(':');
        if (parts.length !== 3) {
            console.warn('无效的 ASS 时间格式:', timeStr);
            return 0;
        }
        
        const [hoursStr, minutesStr, secondsAndCentisecondsStr] = parts;
        const secondsParts = secondsAndCentisecondsStr.split('.');
        
        const hours = parseInt(hoursStr) || 0;
        const minutes = parseInt(minutesStr) || 0;
        const seconds = parseInt(secondsParts[0]) || 0;
        
        let fractionalSeconds = 0;
        if (secondsParts.length > 1) {
            // 处理小数部分，可能是百分秒 (0.00) 或毫秒 (0.000)
            const fractionalStr = secondsParts[1];
            if (fractionalStr.length === 2) { // 百分秒
                fractionalSeconds = parseInt(fractionalStr) / 100;
            } else if (fractionalStr.length === 3) { // 毫秒
                fractionalSeconds = parseInt(fractionalStr) / 1000;
            } else {
                console.warn('无效的 ASS 时间小数部分:', fractionalStr);
            }
        }
        
        return (hours * 3600) + (minutes * 60) + seconds + fractionalSeconds;
    }

    /**
     * 渲染视频帧并在其上绘制当前时间点对应的所有字幕。
     */
    renderVideoWithSubtitles() {
        // 1. 清除 Canvas 上的所有内容，为新帧做准备
        // 注意：如果在 setupCanvas 中使用了 DPR 缩放（ctx 已被 setTransform），
        // 这里需要使用逻辑 (CSS) 像素宽度/高度 来清除与绘制。
        const dpr = this.player.dpr || 1;
        const logicalW = this.player.logicalCanvasWidth || (this.player.videoCanvas.width / dpr);
        const logicalH = this.player.logicalCanvasHeight || (this.player.videoCanvas.height / dpr);
        this.player.ctx.clearRect(0, 0, logicalW, logicalH);
        
        // 2. 绘制当前视频帧到 Canvas 上
        // readyState >= 2 表示视频数据已足够播放
        if (this.player.videoPlayer.readyState >= 2) {
            // 使用逻辑像素尺寸绘制视频帧（ctx 已缩放到逻辑坐标系）
            this.player.ctx.drawImage(this.player.videoPlayer, 0, 0, logicalW, logicalH);
        }
        
        // 3. 获取当前时间点应该显示的字幕
        const currentTime = this.player.videoPlayer.currentTime || 0;
        let currentSubtitles = [];

        // 遍历所有字幕，找出在当前时间范围内（start <= currentTime <= end）的字幕
        for (let i = 0; i < this.player.subtitles.length; i++) {
            const subtitle = this.player.subtitles[i];
            if (!(currentTime >= subtitle.start && currentTime <= subtitle.end)) continue;
            currentSubtitles.push(subtitle);
        }

        // 读取前端注入的偏好设置（优先 player.subtitleLanguagePreference，其次是 window.ASS_PLAYER_CONFIG.PREFERRED_SUBTITLE）
        const cfgPref = (typeof window !== 'undefined' && window.ASS_PLAYER_CONFIG && window.ASS_PLAYER_CONFIG.PREFERRED_SUBTITLE) ? window.ASS_PLAYER_CONFIG.PREFERRED_SUBTITLE : null;
        const pref = this.player.subtitleLanguagePreference || cfgPref || 'both';

        // 简单去重策略：对当前时间的字幕按时间重叠分组，并在每组中依据语言偏好选择一条，减少中英重叠的情况
        const overlapRatio = (a, b) => {
            const istart = Math.max(a.start, b.start);
            const iend = Math.min(a.end, b.end);
            if (iend <= istart) return 0;
            const inter = iend - istart;
            const len = Math.min(a.end - a.start, b.end - b.start);
            return inter / Math.max(len, 1e-6);
        };

        const isMostlyCJK = (text) => {
            if (!text) return false;
            const total = text.length;
            let cjk = 0;
            for (let ch of text) {
                if (/[\u4e00-\u9fff]/.test(ch)) cjk++;
            }
            return (cjk / Math.max(total, 1)) >= 0.25; // 若 >=25% 为 CJK 则认为以中文为主
        };

        const dedupeByOverlap = (subs, pref) => {
            if (!subs || subs.length <= 1) return subs;
            const used = new Array(subs.length).fill(false);
            const out = [];
            for (let i = 0; i < subs.length; i++) {
                if (used[i]) continue;
                const group = [subs[i]];
                used[i] = true;
                for (let j = i + 1; j < subs.length; j++) {
                    if (used[j]) continue;
                    if (overlapRatio(subs[i], subs[j]) > 0.5 || overlapRatio(subs[j], subs[i]) > 0.5) {
                        group.push(subs[j]);
                        used[j] = true;
                    }
                }

                if (group.length === 1) {
                    out.push(group[0]);
                    continue;
                }

                // 多条重叠：根据偏好选择一个
                if (pref === 'both') {
                    // 保留所有（默认行为）
                    out.push(...group);
                } else if (pref === 'zh') {
                    // 选择 CJK 比例最高的字幕
                    group.sort((a, b) => (isMostlyCJK(b.text) ? 1 : 0) - (isMostlyCJK(a.text) ? 1 : 0));
                    // 找到首个以中文为主的，否则选择最长的一条
                    const picked = group.find(s => isMostlyCJK(s.text)) || group.reduce((p, c) => (c.text.length > p.text.length ? c : p), group[0]);
                    out.push(picked);
                } else if (pref === 'en') {
                    // 选择非 CJK（英文/ASCII）为主的行；若都为 CJK 则保留最长
                    const picked = group.find(s => !isMostlyCJK(s.text)) || group.reduce((p, c) => (c.text.length > p.text.length ? c : p), group[0]);
                    out.push(picked);
                } else {
                    out.push(...group);
                }
            }
            return out;
        };

        // 执行去重并替换 currentSubtitles
        try {
            currentSubtitles = dedupeByOverlap(currentSubtitles, pref);
        } catch (e) {
            console.debug('字幕去重过程出现异常，回退到不去重的列表。', e);
        }
        
        // 4. 绘制所有当前字幕并更新预览
        if (currentSubtitles.length > 0) {
            // 更新字幕预览区域的文本
            this.player.currentSubtitleText = currentSubtitles.map(s => this.processSubtitleText(s.text, s.style)).join('<br>');
            if (this.player.subtitlePreview) {
                this.player.subtitlePreview.innerHTML = this.player.currentSubtitleText;
            }
            
            // 遍历并绘制每个当前字幕到 Canvas 上
            currentSubtitles.forEach(subtitle => {
                this.drawSubtitle(subtitle.text, subtitle.style);
            });
        } else {
            // 如果没有字幕显示，清空预览区域
            this.player.currentSubtitleText = '';
            if (this.player.subtitlePreview) {
                this.player.subtitlePreview.textContent = '无字幕';
            }
        }
    }

    /**
     * 在 Canvas 上绘制单个字幕文本。
     * @param {string} text - 要绘制的字幕文本
     * @param {string} [styleName='Default'] - 字幕样式名称
     */
    drawSubtitle(text, styleName = 'Default') {
        if (!text) return;
        
        // 1. 获取并合并字幕样式：优先使用指定样式，否则使用默认样式
        const style = { ...this.player.defaultStyle, ...this.player.styles[styleName] };
        
    // 2. 计算 Canvas 到 ASS 原始分辨率的水平/垂直缩放比例
    // 注意：字体按垂直比例缩放（更接近视觉感受），而换行宽度/水平间距按水平比例缩放
        // 计算水平/垂直缩放因子：基于逻辑（CSS）像素尺寸与 ASS 的 PlayRes
        const canvasLogicalWidth = this.player.logicalCanvasWidth || (this.player.videoCanvas.width / (this.player.dpr || 1));
        const canvasLogicalHeight = this.player.logicalCanvasHeight || (this.player.videoCanvas.height / (this.player.dpr || 1));
        const scaleX = canvasLogicalWidth / this.player.playResX;
        const scaleY = canvasLogicalHeight / this.player.playResY;

    // 3. 设置 Canvas 绘图上下文的字体样式
    // 字体大小使用垂直缩放（PlayResY -> 视频高度），避免单一 min 导致字体过大
    const baseFontSize = (style.fontSize || this.player.defaultStyle.fontSize);
    // 考虑用户手动缩放系数（player.fontScale），使得用户可以在运行时放大/缩小字幕
    const fontScale = (this.player.fontScale !== undefined && this.player.fontScale !== null) ? this.player.fontScale : 1.0;
    const fontSize = Math.max(baseFontSize * scaleY * fontScale, 8); // 最小字体大小 8px（保证在小画面上仍可读）
    // 调试输出：打印用于计算的基准字号与缩放因子，便于在浏览器控制台查看
    try {
        if (typeof console !== 'undefined' && console.debug) {
            console.debug(`[SubtitleRenderer] style='${styleName}', baseFontSize=${baseFontSize}, scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)}, computedFontSize=${fontSize.toFixed(2)}`);
        }
    } catch (e) {
        // 忽略任何调试打印错误
    }
        const fontName = style.fontName || this.player.defaultStyle.fontName;
        const bold = style.bold !== undefined ? style.bold : this.player.defaultStyle.bold;
        const italic = style.italic !== undefined ? style.italic : this.player.defaultStyle.italic;
        
        let fontStyle = '';
        if (bold) fontStyle += 'bold ';
        if (italic) fontStyle += 'italic ';
        
        // 使用更通用的字体栈，以确保在不同系统上都能找到合适的字体
        const fontFamily = `"${fontName}", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "WenQuanYi Micro Hei", sans-serif`;
        
        // 重置 Canvas 字体上下文，确保每次绘制都使用正确的字体设置
        this.player.ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
        this.player.ctx.textAlign = 'center'; // 文本水平居中
        this.player.ctx.textBaseline = 'alphabetic'; // 文本基线
        
        // 默认颜色使用样式中的 primaryColor
        const defaultColor = style.primaryColor || this.player.defaultStyle.primaryColor;
        
    // 4. 计算字幕的垂直起始位置 (baseY)
    let baseY;
    // 垂直边距按垂直缩放调整（fontSize 使用了 scaleY，因此垂直相关也应使用 scaleY）
    const marginV = (style.marginV || this.player.defaultStyle.marginV) * scaleY;
    
    // 使用逻辑（CSS）像素高度来计算垂直位置，保持与其它计算一致
    // （canvasLogicalHeight 已在函数顶部计算并存在）
    const alignment = style.alignment || this.player.defaultStyle.alignment;
    switch (alignment) {
        case 1: case 4: case 7: // 底部对齐 (左下、中下、右下)
        case 2: case 3: // 底部对齐 (中下、右下，与 1,4,7 类似，但通常 2,3 是指中下和右下)
            baseY = canvasLogicalHeight - marginV;
            break;
        case 5: case 6: // 垂直居中 (左中、右中)
            baseY = canvasLogicalHeight / 2;
            break;
        case 8: case 9: // 顶部对齐 (左上、中上、右上)
            baseY = marginV + fontSize; // 顶部边距 + 字体大小
            break;
        default: // 默认底部对齐
            baseY = canvasLogicalHeight - marginV;
            break;
    }
        
    // 5. 绘制处理了颜色标签和自动换行的文本
    // 将 styleName 及水平/垂直缩放传递给换行绘制函数，以便根据缩放分别处理横向宽度和纵向字体
    this.drawTextWithColorTagsAndWrap(text, baseY, fontSize, style, defaultColor, scaleX, scaleY, styleName);
    }

    /**
     * 绘制带有颜色标签和自动换行功能的文本。
     * @param {string} text - 包含 ASS 颜色标签的原始文本
     * @param {number} baseY - 字幕的垂直基线 Y 坐标
     * @param {number} fontSize - 字体大小（已按垂直缩放 scaleY 处理）
     * @param {Object} style - 当前字幕的样式对象
     * @param {string} defaultColor - 默认的文本颜色 (CSS 格式)
     * @param {number} scaleX - 水平缩放因子（用于宽度、边距、字间距）
     * @param {number} scaleY - 垂直缩放因子（用于字体大小、描边、阴影、垂直边距）
     */
    drawTextWithColorTagsAndWrap(text, baseY, fontSize, style, defaultColor, scaleX, scaleY, styleName = 'Default') {
        // 1. 解析文本中的颜色标签，将文本分割成不同颜色的片段
        const segments = this.parseColorSegments(text, defaultColor);
        
        // 2. 计算可用的文本绘制宽度
        // 使用逻辑（CSS）像素尺寸来计算宽度，以保持与 setupCanvas 中的变换一致
        const canvasLogicalWidth = this.player.logicalCanvasWidth || (this.player.videoCanvas.width / (this.player.dpr || 1));
        const canvasLogicalHeight = this.player.logicalCanvasHeight || (this.player.videoCanvas.height / (this.player.dpr || 1));
        // 左右边距按水平缩放，垂直边距在外层已按垂直缩放处理
        const marginL = (style.marginL || this.player.defaultStyle.marginL) * scaleX;
        const marginR = (style.marginR || this.player.defaultStyle.marginR) * scaleX;
        const maxWidth = canvasLogicalWidth - marginL - marginR;

        // 在换行和测量之前，确保 ctx.font 已设置为最终用于测量/绘制的字体，
        // 并清空文本度量缓存以避免使用旧的 font 缓存结果。
        try {
            const fontName = style.fontName || this.player.defaultStyle.fontName;
            const bold = style.bold !== undefined ? style.bold : this.player.defaultStyle.bold;
            const italic = style.italic !== undefined ? style.italic : this.player.defaultStyle.italic;
            let fontStyle = '';
            if (bold) fontStyle += 'bold ';
            if (italic) fontStyle += 'italic ';
            const fontFamily = `"${fontName}", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "WenQuanYi Micro Hei", sans-serif`;
            // 将 ctx.font 设置为传入的 fontSize（这是 drawSubtitle 计算得到的最终字体大小）
            this.player.ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
            // 清空测量缓存，确保 measureText 使用新的 ctx.font
            if (this.player.textMetricsCache && typeof this.player.textMetricsCache.clear === 'function') {
                this.player.textMetricsCache.clear();
            }
        } catch (e) {
            // 忽略任何调试/清缓存错误
        }
        
        // 构建用于显式测量的 font 字符串，并传递给 wrapText 以确保 measureText 使用相同的字体设置
        const fontNameForMeasure = style.fontName || this.player.defaultStyle.fontName;
        const fontFamilyForMeasure = `"${fontNameForMeasure}", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "WenQuanYi Micro Hei", sans-serif`;
        const boldForMeasure = style.bold !== undefined ? style.bold : this.player.defaultStyle.bold;
        const italicForMeasure = style.italic !== undefined ? style.italic : this.player.defaultStyle.italic;
        let fontStyleForMeasure = '';
        if (boldForMeasure) fontStyleForMeasure += 'bold ';
        if (italicForMeasure) fontStyleForMeasure += 'italic ';
        const fontStringForMeasure = `${fontStyleForMeasure} ${fontSize}px ${fontFamilyForMeasure}`;

        // 3. 对文本片段进行自动换行处理（显式传入 fontString 以保证测量一致）
        const lines = this.wrapText(segments, maxWidth, fontSize, fontStringForMeasure);
        
        // 4. 计算总高度和每行行高
    // 行高基于字体大小（fontSize 已按垂直缩放），这里使用 1.2 的倍数作为默认行高
    const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        
        // 5. 根据对齐方式 (alignment) 调整文本的起始 Y 坐标
        const alignment = style.alignment || this.player.defaultStyle.alignment;
        let startY;
        // 针对中文样式，我们希望换行方向向下（首行放在基线，后续行向下堆叠），
        // 以避免与位于基线之上的英文字幕重叠。通过样式名判断是否为中文样式。
        const isChineseStyleName = /[\u4e00-\u9fff]|中文|中文字幕|中文大字幕|中文小字幕/.test(styleName);

        switch (alignment) {
            case 1: case 4: case 7: // 底部对齐
            case 2: case 3:
                if (isChineseStyleName) {
                    // 中文样式：向下换行，第一行在 baseY，后续行向下
                    startY = baseY;
                } else {
                    // 默认 ASS 行为：最后一行贴基线，前置行向上
                    startY = baseY - totalHeight + lineHeight;
                }
                break;
            case 5: case 6: // 垂直居中
                startY = baseY - (totalHeight / 2) + (lineHeight / 2);
                break;
            case 8: case 9: // 顶部对齐
                startY = baseY;
                break;
            default: // 默认底部对齐
                startY = baseY - totalHeight + lineHeight;
                break;
        }
        
        // 6. 遍历每一行并绘制
        lines.forEach((lineSegments, lineIndex) => {
            const y = startY + (lineIndex * lineHeight); // 当前行的 Y 坐标

            // 计算样式的横/纵缩放比例 (ASS 中为百分比，例如 100 表示 100%)
            const styleScaleX = (style.scaleX !== undefined ? style.scaleX : this.player.defaultStyle.scaleX || 100) / 100;
            const styleScaleY = (style.scaleY !== undefined ? style.scaleY : this.player.defaultStyle.scaleY || 100) / 100;

            // 计算该行的总宽度（考虑横向缩放和字间距）
            let lineWidth = 0;
            const segWidths = [];
            // 字间距按水平缩放（横向单位），因为它影响文本宽度计算
            const spacingPx = (style.spacing || this.player.defaultStyle.spacing || 0) * scaleX; // 字间距像素值
            lineSegments.forEach(segment => {
                // 使用与换行时相同的 fontString 进行测量，确保绘制宽度与换行计算一致
                const baseW = this.player.measureTextWidth(segment.text, fontStringForMeasure); // 基于换行时使用的 font 测量
                const adjW = baseW * styleScaleX + Math.max(0, (segment.text.length - 1)) * spacingPx;
                segWidths.push({ baseW, adjW });
                lineWidth += adjW;
            });

            // 计算起始 X 坐标（水平居中）
            const startX = (canvasLogicalWidth - lineWidth) / 2;

            // 如果边框样式是 3 (不透明方框)，则绘制背景矩形（注意缩放）
            if (style.borderStyle === 3 && style.backColor) {
                this.player.ctx.fillStyle = style.backColor;
                // 背景填充的 padding 与描边宽度相关，应使用垂直缩放 scaleY
                const padding = (style.outline || this.player.defaultStyle.outline) * scaleY;
                this.player.ctx.fillRect(
                    startX - padding,
                    y - fontSize + padding,
                    lineWidth + padding * 2,
                    lineHeight + padding * 2
                );
            }

            // 处理整行旋转角度（angle）: 仅在 angle 非 0 时进行计算与变换
            const angleDeg = style.angle || 0;
            const drawAtRotated = Math.abs(angleDeg) > 1e-6;
            let angleRad = 0;
            let canvasCenterX = 0;
                if (drawAtRotated) {
                    angleRad = (angleDeg * Math.PI) / 180;
                    canvasCenterX = canvasLogicalWidth / 2;
                }

            // 绘制该行的每个文本片段
            let currentX = startX;

            for (let i = 0; i < lineSegments.length; i++) {
                const segment = lineSegments[i];
                const { baseW, adjW } = segWidths[i];

                // 绘制文字相关样式
                // 描边与阴影等视觉效果更贴近字体高度，使用垂直缩放 scaleY
                const outlineWidth = (style.outline || this.player.defaultStyle.outline) * scaleY;
                const shadowOffset = (style.shadow || this.player.defaultStyle.shadow || 0) * scaleY;
                const outlineColor = style.outlineColor || this.player.defaultStyle.outlineColor;
                const backColor = style.backColor || this.player.defaultStyle.backColor;

                // 是否需要应用横向/纵向缩放（ASS 默认 100 -> 无缩放）
                const needScaleX = Math.abs(styleScaleX - 1) > 1e-6;
                const needScaleY = Math.abs(styleScaleY - 1) > 1e-6;

                // 计算用于绘制的字体高度（考虑纵向缩放，仅在需要时调整）
                const effectiveFontSize = needScaleY ? fontSize * styleScaleY : fontSize;
                // 更新 ctx.font 使用纵向缩放后的大小（保持字体族和样式）
                const fontName = style.fontName || this.player.defaultStyle.fontName;
                const bold = style.bold !== undefined ? style.bold : this.player.defaultStyle.bold;
                const italic = style.italic !== undefined ? style.italic : this.player.defaultStyle.italic;
                let fontStyle = '';
                if (bold) fontStyle += 'bold ';
                if (italic) fontStyle += 'italic ';
                const fontFamily = `"${fontName}", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "WenQuanYi Micro Hei", sans-serif`;
                this.player.ctx.font = `${fontStyle} ${effectiveFontSize}px ${fontFamily}`;

                // 可选的调试：在全局配置中开启后，打印绘制时的字体信息并绘制一个用于可视化的边框
                try {
                    const cfg = (typeof window !== 'undefined' && window.ASS_PLAYER_CONFIG) ? window.ASS_PLAYER_CONFIG : {};
                    if (cfg.DEBUG_DRAW_FONT) {
                        // 打印当前段的字体信息和测量宽度
                        const debugMeasure = this.player.measureTextWidth(segment.text, `${fontStyle} ${effectiveFontSize}px ${fontFamily}`);
                        console.log('[DEBUG_DRAW_FONT] text="' + segment.text + '", font="' + this.player.ctx.font + '", effectiveFontSize=' + effectiveFontSize + ', measured=' + debugMeasure);
                        // 绘制半透明矩形以可视化文本占用的矩形（仅用于调试）
                        this.player.ctx.save();
                        this.player.ctx.strokeStyle = 'rgba(255,0,0,0.8)';
                        this.player.ctx.lineWidth = Math.max(1, Math.round(effectiveFontSize * 0.08));
                        this.player.ctx.globalAlpha = 0.6;
                        // 由于当前变换可能已应用 translate/scale 等，使用 fillRect 在当前位置绘制
                        // 我们将 rectangle 以文本中心为准绘制，宽度为 adjW，高度为 lineHeight
                        const rectX = currentX;
                        const rectY = y - fontSize; // 基于行基线向上一个字体高度作为矩形顶部
                        this.player.ctx.strokeRect(rectX, rectY, adjW, lineHeight);
                        this.player.ctx.restore();
                    }
                } catch (e) {
                    // 忽略调试阶段的任何错误
                }

                // 绘制时使用 transform 来实现横向缩放 (scaleX)。我们以片段中心为变换原点，先 translate -> scale -> draw
                const pieceCenterX = currentX + adjW / 2;

                // 处理旋转：我们会先把坐标系移动到 canvas 中心并旋转（以行中心旋转），再在该坐标系下绘制
                // drawAtRotated 在外层已定义，复用

                // 如果既不需要横向缩放也不旋转，则直接在画布坐标上绘制（更高效）
                if (!needScaleX && !drawAtRotated) {
                    // 直接绘制描边（如果有）
                    if (outlineWidth > 0) {
                        this.player.ctx.save();
                        this.player.ctx.shadowColor = 'rgba(0,0,0,0)';
                        this.player.ctx.lineWidth = outlineWidth;
                        this.player.ctx.lineJoin = 'round';
                        this.player.ctx.strokeStyle = outlineColor;
                        this.player.ctx.textAlign = 'center';
                        this.player.ctx.textBaseline = 'alphabetic';
                        this.player.ctx.strokeText(segment.text, currentX + adjW / 2, y);
                        this.player.ctx.restore();
                    }

                    // 填充与阴影
                    this.player.ctx.save();
                    if (shadowOffset > 0) {
                        const shadowColor = backColor || 'rgba(0,0,0,0.6)';
                        this.player.ctx.shadowColor = shadowColor;
                        this.player.ctx.shadowOffsetX = shadowOffset;
                        this.player.ctx.shadowOffsetY = shadowOffset;
                        this.player.ctx.shadowBlur = Math.max(1, shadowOffset / 2);
                    } else {
                        this.player.ctx.shadowColor = 'rgba(0,0,0,0)';
                    }
                    this.player.ctx.fillStyle = segment.color;
                    this.player.ctx.textAlign = 'center';
                    this.player.ctx.textBaseline = 'alphabetic';
                    this.player.ctx.fillText(segment.text, currentX + adjW / 2, y);
                    this.player.ctx.restore();
                } else {
                    // 否则使用变换路径：支持横向缩放或旋转
                    this.player.ctx.save();
                    if (drawAtRotated) {
                        this.player.ctx.translate(canvasCenterX, y);
                        this.player.ctx.rotate(angleRad);
                        this.player.ctx.translate(-canvasCenterX, -y);
                    }
                    // 移动到片段中心并横向缩放（仅在需要时缩放）
                    this.player.ctx.translate(pieceCenterX, y);
                    if (needScaleX) this.player.ctx.scale(styleScaleX, 1);

                    if (shadowOffset > 0) {
                        const shadowColor = backColor || 'rgba(0,0,0,0.6)';
                        this.player.ctx.shadowColor = shadowColor;
                        // shadowOffset 在横向可能需要根据横向缩放调整
                        this.player.ctx.shadowOffsetX = shadowOffset / Math.max(styleScaleX, 0.0001);
                        this.player.ctx.shadowOffsetY = shadowOffset;
                        this.player.ctx.shadowBlur = Math.max(1, shadowOffset / 2);
                    } else {
                        this.player.ctx.shadowColor = 'rgba(0,0,0,0)';
                    }

                    this.player.ctx.fillStyle = segment.color;
                    this.player.ctx.textAlign = 'center';
                    this.player.ctx.textBaseline = 'alphabetic';
                    this.player.ctx.fillText(segment.text, 0, 0);

                    // 如果描边存在并未提前绘制（在变换路径下需要按此顺序绘制描边时），
                    // 但为了保持与之前行为一致，我们仍然绘制描边为先（当前实现已在上方处理描边分支），
                    // 因此此处不重复描边绘制。

                    // 下划线 / 删除线处理同样在变换路径下绘制
                    const hasUnderline = !!style.underline;
                    const hasStrike = !!style.strikeout;
                    if (hasUnderline || hasStrike) {
                        const underlineY = Math.round(effectiveFontSize * 0.12);
                        const strikeY = Math.round(-effectiveFontSize * 0.35);
                        this.player.ctx.save();
                        this.player.ctx.beginPath();
                        const lineW = (adjW) / Math.max(styleScaleX, 0.0001);
                        this.player.ctx.lineWidth = Math.max(1, Math.round(effectiveFontSize * 0.06));
                        this.player.ctx.strokeStyle = segment.color;
                        if (hasUnderline) {
                            this.player.ctx.moveTo(-lineW / 2, underlineY);
                            this.player.ctx.lineTo(lineW / 2, underlineY);
                        }
                        if (hasStrike) {
                            this.player.ctx.moveTo(-lineW / 2, strikeY);
                            this.player.ctx.lineTo(lineW / 2, strikeY);
                        }
                        this.player.ctx.stroke();
                        this.player.ctx.restore();
                    }

                    this.player.ctx.restore();
                }

                // 下划线 / 删除线 (Underline / StrikeOut)
                const hasUnderline = !!style.underline;
                const hasStrike = !!style.strikeout;
                if (hasUnderline || hasStrike) {
                    // 计算线条位置：基于字体高度做经验偏移
                    const underlineY = Math.round(effectiveFontSize * 0.12);
                    const strikeY = Math.round(-effectiveFontSize * 0.35);
                    this.player.ctx.save();
                    // 在当前变换下绘制横线，宽度为 adjW / scaleX (因为被 scale 缩放了)
                    this.player.ctx.beginPath();
                    const lineW = (adjW) / Math.max(styleScaleX, 0.0001);
                    this.player.ctx.lineWidth = Math.max(1, Math.round(effectiveFontSize * 0.06));
                    this.player.ctx.strokeStyle = segment.color;
                    if (hasUnderline) {
                        this.player.ctx.moveTo(-lineW / 2, underlineY);
                        this.player.ctx.lineTo(lineW / 2, underlineY);
                    }
                    if (hasStrike) {
                        this.player.ctx.moveTo(-lineW / 2, strikeY);
                        this.player.ctx.lineTo(lineW / 2, strikeY);
                    }
                    this.player.ctx.stroke();
                    this.player.ctx.restore();
                }

                this.player.ctx.restore();

                // 更新 currentX（注意 currentX 是未缩放空间下的增量）
                currentX += adjW;
            }
        });
    }

    /**
     * 对文本片段进行自动换行处理。
     * @param {Array<Object>} segments - 包含 {text, color} 的文本片段数组
     * @param {number} maxWidth - 可用的最大行宽
     * @param {number} fontSize - 字体大小 (用于测量文本)
     * @returns {Array<Array<Object>>} 包含多行文本片段的数组
     */
    wrapText(segments, maxWidth, fontSize, fontStringForMeasure) {
        const lines = []; // 存储所有行
        let currentLine = []; // 当前正在构建的行
        let currentLineWidth = 0; // 当前行的宽度
        
        for (const segment of segments) {
            // 将文本按单词和标点符号拆分，以便进行更精细的换行控制
            const words = this.splitTextWithPunctuation(segment.text);
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (!word.trim()) continue; // 跳过空字符串
                
                // 检查是否需要在单词前添加空格（如果不是行首且不是标点符号）
                let wordToAdd = word;
                // 只有当单词不是空格本身，且当前行不为空且不是标点符号时，才添加空格
                if (word !== ' ' && currentLine.length > 0 && !this.isPunctuation(word.charAt(0))) {
                    wordToAdd = ' ' + word; // 在单词前添加一个空格
                }
                
                // 使用显式传入的 font 字符串进行测量，保证测量与绘制时字体一致
                const wordWidth = this.player.measureTextWidth(wordToAdd, fontStringForMeasure);
                
                // 如果当前行加上这个词会超出最大宽度，并且当前行不为空，则进行换行
                if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
                    lines.push([...currentLine]); // 将当前行添加到总行数中
                    currentLine = []; // 开始新行
                    currentLineWidth = 0;
                    
                    // 新行的第一个单词不加空格
                    const firstWordWidth = this.player.measureTextWidth(word, fontStringForMeasure);
                    currentLine.push({
                        text: word,
                        color: segment.color
                    });
                    currentLineWidth += firstWordWidth;
                } else {
                    // 将词添加到当前行
                    currentLine.push({
                        text: wordToAdd,
                        color: segment.color
                    });
                    currentLineWidth += wordWidth;
                }
            }
        }
        
        // 添加最后一行（如果存在未添加到 lines 中的内容）
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    /**
     * 将文本按单词和标点符号进行分割，同时保留标点符号作为独立的片段。
     * 这有助于在换行时避免将标点符号与前一个单词分开。
     * @param {string} text - 原始文本字符串
     * @returns {string[]} 分割后的文本片段数组
     */
    splitTextWithPunctuation(text) {
        // 正则表达式解释:
        // ([\w\u4e00-\u9fff]+) : 匹配一个或多个字母、数字、下划线或中文字符 (作为单词)
        // |[[\]{}()] : 匹配方括号、花括号、圆括号 (作为独立标点)
        // |[,.;:!?] : 匹配逗号、分号、冒号、感叹号、问号 (作为独立标点)
        // |\s+ : 匹配一个或多个空白字符 (作为独立片段)
        const regex = /([\w\u4e00-\u9fff]+|[[\]{}()]|[,.;:!?]|\s+)/g;
        const matches = text.match(regex) || [];
        // 过滤掉可能产生的空字符串匹配，并将多个连续空格压缩为单个空格
        return matches.filter(match => match.trim()).map(match => 
            /\s+/.test(match) ? ' ' : match
        );
    }

    /**
     * 判断一个字符是否为标点符号。
     * @param {string} char - 要检查的字符
     * @returns {boolean} 如果是标点符号则返回 true，否则返回 false
     */
    isPunctuation(char) {
        return /[,.;:!?[\]{}()]/.test(char);
    }

    /**
     * 解析字幕文本中的 ASS 颜色标签，将文本分割成不同颜色的片段。
     * 例如，"{\c&H0000FF}红色文本{\c}普通文本" 会被解析为两个片段。
     * @param {string} text - 原始字幕文本，可能包含 ASS 颜色标签
     * @param {string} defaultColor - 默认的文本颜色 (CSS 格式)
     * @returns {Array<Object>} 包含 {text, color} 的文本片段数组
     */
    parseColorSegments(text, defaultColor) {
        const segments = [];
        let currentText = ''; // 当前正在构建的文本片段
        let currentColor = defaultColor; // 当前文本片段的颜色
        let i = 0; // 遍历文本的索引
        
        while (i < text.length) {
            // 查找颜色标签的开始：以 "{\\" 开头
            if (text[i] === '{' && i + 1 < text.length && text[i + 1] === '\\') {
                // 如果当前有累积的文本，先将其作为一个片段保存
                if (currentText) {
                    segments.push({ text: currentText, color: currentColor });
                    currentText = ''; // 重置当前文本
                }
                
                // 查找标签的结束：'}'
                const endIndex = text.indexOf('}', i);
                if (endIndex === -1) {
                    // 如果没有找到结束标签，将剩余文本作为普通文本处理
                    currentText += text.substring(i);
                    break;
                }
                
                const tag = text.substring(i, endIndex + 1); // 提取完整的标签，例如 "{\c&H0000FF}"
                
                // 解析颜色标签
                if (tag.startsWith('{\\c&H')) {
                    // 这是一个设置颜色的标签，例如 "{\c&H0000FF}"
                    const colorHex = tag.substring(5, tag.length - 1); // 提取十六进制颜色部分
                    currentColor = this.parseASSColor(`&H${colorHex}`); // 解析为 CSS 颜色
                } else if (tag === '{\\c}') {
                    // 这是一个重置颜色的标签
                    currentColor = defaultColor; // 恢复为默认颜色
                }
                // 其他 ASS 标签（如 \b, \i, \pos 等）在此处被忽略，只处理颜色
                
                // 跳过已处理的标签，继续处理标签后的文本
                i = endIndex + 1;
            } else {
                // 如果不是标签，则将字符添加到当前文本片段
                currentText += text[i];
                i++;
            }
        }
        
        // 添加最后一个文本片段（如果存在）
        if (currentText) {
            segments.push({ text: currentText, color: currentColor });
        }
        
        return segments;
    }

    /**
     * 处理用于字幕预览区域的文本，将其中的 ASS 颜色标签转换为 HTML span 标签。
     * @param {string} text - 原始字幕文本
     * @param {string} [styleName='Default'] - 字幕样式名称
     * @returns {string} 包含 HTML 格式的文本
     */
    processSubtitleText(text, styleName = 'Default') {
        // 获取样式配置，用于确定默认颜色
        const style = { ...this.player.defaultStyle, ...this.player.styles[styleName] };
        const defaultColor = style.primaryColor || this.player.defaultStyle.primaryColor;
        
        // 解析颜色标签，将文本分割成片段
        const segments = this.parseColorSegments(text, defaultColor);
        let resultHtml = '';
        
        // 遍历每个片段，生成带有 CSS 颜色的 span 标签
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const cssColor = this.colorToCSS(segment.color);
            let displayText = segment.text;
            
            // 修复空格显示问题：将普通空格替换为不换行空格，确保空格在所有情况下都正确显示
            displayText = displayText.replace(/ /g, '&nbsp;');
            
            // 特殊处理：确保逗号后有空格，但不要破坏数字中的逗号（如 1,000）
            displayText = displayText.replace(/,(\S)/g, (match, char) => {
                // 如果逗号后的字符是数字，则保持原样（如 1,000）
                if (/^\d$/.test(char)) {
                    return match;
                }
                // 否则在逗号后添加空格
                return ',&nbsp;' + char;
            });
            
            // 简单解决方案：如果当前片段是高亮文本（不是默认颜色），且前一个片段以逗号结尾，则添加空格
            if (i > 0 && segment.color !== defaultColor) {
                const previousSegment = segments[i - 1];
                if (previousSegment.text.endsWith(',')) {
                    displayText = '&nbsp;' + displayText;
                }
            }
            
            resultHtml += `<span style="color: ${cssColor}">${displayText}</span>`;
        }
        
        return resultHtml || '无文本内容';
    }

    /**
     * 将 RGBA 颜色字符串转换为 CSS 兼容的颜色格式（如果 Alpha 为 1，则转换为十六进制）。
     * @param {string} color - RGBA 颜色字符串，例如 "rgba(255, 255, 255, 1)"
     * @returns {string} CSS 颜色字符串（#RRGGBB 或 rgba(...)）
     */
    colorToCSS(color) {
        // 尝试匹配 rgba 格式的颜色字符串
        const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            const a = parseFloat(match[4]);
            
            // 如果 Alpha 值为 1 (完全不透明)，则转换为十六进制格式
            if (a === 1) {
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            } else {
                // 否则，保持 rgba 格式
                return color;
            }
        }
        
        // 如果不是 rgba 格式，直接返回原始颜色字符串
        return color;
    }

    /**
     * 对文本进行 HTML 转义，以防止 XSS 攻击，并确保文本在 HTML 中正确显示。
     * @param {string} text - 原始文本字符串
     * @returns {string} HTML 转义后的字符串
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text; // 将文本设置为 div 的 textContent，浏览器会自动转义特殊字符
        return div.innerHTML;   // 获取转义后的 HTML 字符串
    }
}
