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
                case 'Name': style.name = value; break;
                case 'Fontname': style.fontName = value; break;
                case 'Fontsize': style.fontSize = parseFloat(value); break;
                case 'PrimaryColour': style.primaryColor = this.parseASSColor(value); break;
                case 'SecondaryColour': style.secondaryColor = this.parseASSColor(value); break;
                case 'OutlineColour': style.outlineColor = this.parseASSColor(value); break;
                case 'BackColour': style.backColor = this.parseASSColor(value); break;
                case 'Bold': style.bold = parseInt(value) === -1; break;
                case 'Italic': style.italic = parseInt(value) === -1; break;
                case 'Underline': style.underline = parseInt(value) === -1; break;
                case 'StrikeOut': style.strikeout = parseInt(value) === -1; break;
                case 'ScaleX': style.scaleX = parseFloat(value); break;
                case 'ScaleY': style.scaleY = parseFloat(value); break;
                case 'Spacing': style.spacing = parseFloat(value); break;
                case 'Angle': style.angle = parseFloat(value); break;
                case 'BorderStyle': style.borderStyle = parseInt(value); break;
                case 'Outline': style.outline = parseFloat(value); break;
                case 'Shadow': style.shadow = parseFloat(value); break;
                case 'Alignment': style.alignment = parseInt(value); break;
                case 'MarginL': style.marginL = parseInt(value); break;
                case 'MarginR': style.marginR = parseInt(value); break;
                case 'MarginV': style.marginV = parseInt(value); break;
                case 'Encoding': style.encoding = parseInt(value); break;
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
        this.player.ctx.clearRect(0, 0, this.player.videoCanvas.width, this.player.videoCanvas.height);
        
        // 2. 绘制当前视频帧到 Canvas 上
        // readyState >= 2 表示视频数据已足够播放
        if (this.player.videoPlayer.readyState >= 2) {
            this.player.ctx.drawImage(this.player.videoPlayer, 0, 0, this.player.videoCanvas.width, this.player.videoCanvas.height);
        }
        
        // 3. 获取当前时间点应该显示的字幕
        const currentTime = this.player.videoPlayer.currentTime || 0;
        const currentSubtitles = [];
        
        // 遍历所有字幕，找出在当前时间范围内（start <= currentTime <= end）的字幕
        for (let i = 0; i < this.player.subtitles.length; i++) {
            const subtitle = this.player.subtitles[i];
            if (currentTime >= subtitle.start && currentTime <= subtitle.end) {
                currentSubtitles.push(subtitle);
            }
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
        
        // 2. 计算 Canvas 到 ASS 原始分辨率的缩放比例
        const scaleFactorX = this.player.videoCanvas.width / this.player.playResX;
        const scaleFactorY = this.player.videoCanvas.height / this.player.playResY;
        const scaleFactor = Math.min(scaleFactorX, scaleFactorY); // 使用较小的缩放因子以保持内容可见
        
        // 3. 设置 Canvas 绘图上下文的字体样式
        const fontSize = Math.max((style.fontSize || this.player.defaultStyle.fontSize) * scaleFactor, 12); // 最小字体大小为 12px
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
        // 垂直边距也需要根据缩放因子调整
        const marginV = (style.marginV || this.player.defaultStyle.marginV) * scaleFactor;
        
        const alignment = style.alignment || this.player.defaultStyle.alignment;
        
        switch (alignment) {
            case 1: case 4: case 7: // 底部对齐 (左下、中下、右下)
            case 2: case 3: // 底部对齐 (中下、右下，与 1,4,7 类似，但通常 2,3 是指中下和右下)
                baseY = this.player.videoCanvas.height - marginV;
                break;
            case 5: case 6: // 垂直居中 (左中、右中)
                baseY = this.player.videoCanvas.height / 2;
                break;
            case 8: case 9: // 顶部对齐 (左上、中上、右上)
                baseY = marginV + fontSize; // 顶部边距 + 字体大小
                break;
            default: // 默认底部对齐
                baseY = this.player.videoCanvas.height - marginV;
                break;
        }
        
        // 5. 绘制处理了颜色标签和自动换行的文本
        this.drawTextWithColorTagsAndWrap(text, baseY, fontSize, style, defaultColor, scaleFactor);
    }

    /**
     * 绘制带有颜色标签和自动换行功能的文本。
     * @param {string} text - 包含 ASS 颜色标签的原始文本
     * @param {number} baseY - 字幕的垂直基线 Y 坐标
     * @param {number} fontSize - 字体大小
     * @param {Object} style - 当前字幕的样式对象
     * @param {string} defaultColor - 默认的文本颜色 (CSS 格式)
     * @param {number} scaleFactor - 缩放因子
     */
    drawTextWithColorTagsAndWrap(text, baseY, fontSize, style, defaultColor, scaleFactor) {
        // 1. 解析文本中的颜色标签，将文本分割成不同颜色的片段
        const segments = this.parseColorSegments(text, defaultColor);
        
        // 2. 计算可用的文本绘制宽度
        const marginL = (style.marginL || this.player.defaultStyle.marginL) * scaleFactor;
        const marginR = (style.marginR || this.player.defaultStyle.marginR) * scaleFactor;
        const maxWidth = this.player.videoCanvas.width - marginL - marginR;
        
        // 3. 对文本片段进行自动换行处理
        const lines = this.wrapText(segments, maxWidth, fontSize);
        
        // 4. 计算总高度和每行行高
        const lineHeight = fontSize * 1.2; // 行高通常是字体大小的 1.2 倍
        const totalHeight = lines.length * lineHeight;
        
        // 5. 根据对齐方式 (alignment) 调整文本的起始 Y 坐标
        const alignment = style.alignment || this.player.defaultStyle.alignment;
        let startY;
        
        switch (alignment) {
            case 1: case 4: case 7: // 底部对齐
            case 2: case 3:
                startY = baseY - totalHeight + lineHeight;
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
            
            // 计算该行的总宽度
            let lineWidth = 0;
            lineSegments.forEach(segment => {
                lineWidth += this.player.measureTextWidth(segment.text);
            });
            
            // 计算起始 X 坐标（水平居中）
            const startX = (this.player.videoCanvas.width - lineWidth) / 2;
            
            // 如果边框样式是 3 (不透明方框)，则绘制背景矩形
            if (style.borderStyle === 3 && style.backColor) {
                this.player.ctx.fillStyle = style.backColor;
                // 绘制背景矩形，考虑描边宽度
                const padding = (style.outline || this.player.defaultStyle.outline) * scaleFactor;
                this.player.ctx.fillRect(
                    startX - padding, 
                    y - fontSize + padding, // 调整 Y 坐标以适应文本基线和字体大小
                    lineWidth + padding * 2, 
                    lineHeight + padding * 2
                );
            }

            // 绘制该行的每个文本片段
            let currentX = startX;
            
            lineSegments.forEach(segment => {
                const width = this.player.measureTextWidth(segment.text);
                
                // 绘制文字描边 (Outline)
                const outlineWidth = (style.outline || this.player.defaultStyle.outline) * scaleFactor;
                if (outlineWidth > 0) {
                    this.player.ctx.strokeStyle = style.outlineColor || this.player.defaultStyle.outlineColor;
                    this.player.ctx.lineWidth = outlineWidth;
                    this.player.ctx.strokeText(segment.text, currentX + width / 2, y);
                }
                
                // 绘制文字主体
                this.player.ctx.fillStyle = segment.color;
                this.player.ctx.fillText(segment.text, currentX + width / 2, y);
                
                currentX += width; // 更新当前 X 坐标，用于下一个片段
            });
        });
    }

    /**
     * 对文本片段进行自动换行处理。
     * @param {Array<Object>} segments - 包含 {text, color} 的文本片段数组
     * @param {number} maxWidth - 可用的最大行宽
     * @param {number} fontSize - 字体大小 (用于测量文本)
     * @returns {Array<Array<Object>>} 包含多行文本片段的数组
     */
    wrapText(segments, maxWidth, fontSize) {
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
                
                const wordWidth = this.player.measureTextWidth(wordToAdd);
                
                // 如果当前行加上这个词会超出最大宽度，并且当前行不为空，则进行换行
                if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
                    lines.push([...currentLine]); // 将当前行添加到总行数中
                    currentLine = []; // 开始新行
                    currentLineWidth = 0;
                    
                    // 新行的第一个单词不加空格
                    const firstWordWidth = this.player.measureTextWidth(word);
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
