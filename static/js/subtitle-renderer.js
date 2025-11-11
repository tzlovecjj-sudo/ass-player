// 字幕渲染模块 - 非模块化版本
class SubtitleRenderer {
    constructor(player) {
        this.player = player;
    }

    // 完整的ASS文件解析
    parseASSFile(content) {
        this.player.subtitles = [];
        this.player.styles = {};
        const lines = content.split('\n');
        let inScriptInfo = false;
        let inStylesSection = false;
        let inEventsSection = false;
        let styleFormat = [];
        let eventFormat = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
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
            
            if (inScriptInfo) {
                if (trimmedLine.startsWith('PlayResX:')) {
                    this.player.playResX = parseInt(trimmedLine.substring(9).trim()) || 1920;
                } else if (trimmedLine.startsWith('PlayResY:')) {
                    this.player.playResY = parseInt(trimmedLine.substring(9).trim()) || 1080;
                }
                continue;
            }
            
            if (inStylesSection && trimmedLine.startsWith('Format:')) {
                styleFormat = trimmedLine.substring(7).split(',').map(s => s.trim());
                continue;
            }
            
            if (inStylesSection && trimmedLine.startsWith('Style:')) {
                const style = this.parseStyleLine(trimmedLine, styleFormat);
                if (style) {
                    this.player.styles[style.name] = style;
                }
                continue;
            }
            
            if (inEventsSection && trimmedLine.startsWith('Format:')) {
                eventFormat = trimmedLine.substring(7).split(',').map(s => s.trim());
                continue;
            }
            
            if (inEventsSection && (trimmedLine.startsWith('Dialogue:') || trimmedLine.startsWith('Comment:'))) {
                const subtitle = this.parseDialogueLine(trimmedLine, eventFormat);
                if (subtitle) {
                    this.player.subtitles.push(subtitle);
                }
            }
            
            if (trimmedLine.startsWith('[') && 
                trimmedLine !== '[Script Info]' && 
                trimmedLine !== '[V4+ Styles]' && 
                trimmedLine !== '[Events]') {
                inScriptInfo = false;
                inStylesSection = false;
                inEventsSection = false;
            }
        }
        
        // 按开始时间排序
        this.player.subtitles.sort((a, b) => a.start - b.start);
        console.log(`解析到 ${this.player.subtitles.length} 条字幕，${Object.keys(this.player.styles).length} 种样式，分辨率: ${this.player.playResX}x${this.player.playResY}`);
    }

    parseStyleLine(line, format) {
        const parts = line.substring(6).split(',').map(s => s.trim());
        if (parts.length < format.length) return null;
        
        const style = {};
        for (let i = 0; i < format.length; i++) {
            const key = format[i];
            const value = parts[i];
            
            switch (key) {
                case 'Name':
                    style.name = value;
                    break;
                case 'Fontname':
                    style.fontName = value;
                    break;
                case 'Fontsize':
                    style.fontSize = parseFloat(value);
                    break;
                case 'PrimaryColour':
                    style.primaryColor = this.parseASSColor(value);
                    break;
                case 'SecondaryColour':
                    style.secondaryColor = this.parseASSColor(value);
                    break;
                case 'OutlineColour':
                    style.outlineColor = this.parseASSColor(value);
                    break;
                case 'BackColour':
                    style.backColor = this.parseASSColor(value);
                    break;
                case 'Bold':
                    style.bold = parseInt(value) === -1;
                    break;
                case 'Italic':
                    style.italic = parseInt(value) === -1;
                    break;
                case 'Underline':
                    style.underline = parseInt(value) === -1;
                    break;
                case 'StrikeOut':
                    style.strikeout = parseInt(value) === -1;
                    break;
                case 'ScaleX':
                    style.scaleX = parseFloat(value);
                    break;
                case 'ScaleY':
                    style.scaleY = parseFloat(value);
                    break;
                case 'Spacing':
                    style.spacing = parseFloat(value);
                    break;
                case 'Angle':
                    style.angle = parseFloat(value);
                    break;
                case 'BorderStyle':
                    style.borderStyle = parseInt(value);
                    break;
                case 'Outline':
                    style.outline = parseFloat(value);
                    break;
                case 'Shadow':
                    style.shadow = parseFloat(value);
                    break;
                case 'Alignment':
                    style.alignment = parseInt(value);
                    break;
                case 'MarginL':
                    style.marginL = parseInt(value);
                    break;
                case 'MarginR':
                    style.marginR = parseInt(value);
                    break;
                case 'MarginV':
                    style.marginV = parseInt(value);
                    break;
                case 'Encoding':
                    style.encoding = parseInt(value);
                    break;
            }
        }
        
        return style;
    }

    parseASSColor(colorStr) {
        // ASS颜色格式: &HAABBGGRR (AA=alpha, BB=blue, GG=green, RR=red)
        if (!colorStr.startsWith('&H')) return colorStr;
        
        const hex = colorStr.substring(2);
        let r, g, b, a;
        
        if (hex.length === 8) {
            // 有alpha通道
            a = parseInt(hex.substring(0, 2), 16);
            b = parseInt(hex.substring(2, 4), 16);
            g = parseInt(hex.substring(4, 6), 16);
            r = parseInt(hex.substring(6, 8), 16);
            
            // 反转alpha值
            a = 255 - a;
        } else {
            // 没有alpha通道，默认不透明
            a = 255;
            b = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            r = parseInt(hex.substring(4, 6), 16);
        }
        
        return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    }

    parseDialogueLine(line, format) {
        // 处理 Dialogue 或 Comment 行
        const prefix = line.startsWith('Dialogue:') ? 'Dialogue:' : 'Comment:';
        const content = line.substring(prefix.length);
        
        // 修复：正确处理包含逗号的文本
        let parts = [];
        let inQuotes = false;
        let currentPart = '';
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        
        // 添加最后一个部分
        if (currentPart) {
            parts.push(currentPart.trim());
        }
        
        // 如果部分数量少于格式数量，说明文本中没有逗号，使用简单分割
        if (parts.length < format.length) {
            parts = content.split(',').map(s => s.trim());
        }
        
        if (parts.length < format.length) return null;
        
        const subtitle = {};
        let textIndex = -1;
        
        for (let i = 0; i < format.length; i++) {
            const key = format[i];
            const value = parts[i];
            
            switch (key) {
                case 'Start':
                    subtitle.start = this.parseTime(value);
                    break;
                case 'End':
                    subtitle.end = this.parseTime(value);
                    break;
                case 'Style':
                    subtitle.style = value;
                    break;
                case 'Text':
                    textIndex = i;
                    break;
            }
        }
        
        // 获取文本部分（可能包含逗号）
        if (textIndex !== -1) {
            subtitle.text = parts.slice(textIndex).join(',').trim();
            // 移除可能存在的引号
            if (subtitle.text.startsWith('"') && subtitle.text.endsWith('"')) {
                subtitle.text = subtitle.text.substring(1, subtitle.text.length - 1);
            }
        }
        
        return subtitle.text ? subtitle : null;
    }

    parseTime(timeStr) {
        // 处理时间格式: 0:00:00.00 或 0:00:00.000
        const parts = timeStr.split(':');
        if (parts.length !== 3) return 0;
        
        const [h, m, s_part] = parts;
        const s_parts = s_part.split('.');
        
        const seconds = parseInt(s_parts[0]);
        const centiseconds = s_parts.length > 1 ? parseInt(s_parts[1]) : 0;
        
        return parseInt(h) * 3600 + 
               parseInt(m) * 60 + 
               seconds + 
               centiseconds / (s_parts[1].length === 3 ? 1000 : 100);
    }

    // 渲染视频和字幕
    renderVideoWithSubtitles() {
        // 清除Canvas
        this.player.ctx.clearRect(0, 0, this.player.videoCanvas.width, this.player.videoCanvas.height);
        
        // 绘制视频帧
        if (this.player.videoPlayer.readyState >= 2) {
            this.player.ctx.drawImage(this.player.videoPlayer, 0, 0, this.player.videoCanvas.width, this.player.videoCanvas.height);
        }
        
        // 获取当前时间对应的所有字幕
        const currentTime = this.player.videoPlayer.currentTime || 0;
        const currentSubtitles = [];
        
        for (let i = 0; i < this.player.subtitles.length; i++) {
            const subtitle = this.player.subtitles[i];
            if (currentTime >= subtitle.start && currentTime <= subtitle.end) {
                currentSubtitles.push(subtitle);
            }
        }
        
        // 绘制所有当前字幕
        if (currentSubtitles.length > 0) {
            // 更新预览
            this.player.currentSubtitleText = currentSubtitles.map(s => this.processSubtitleText(s.text, s.style)).join('<br>');
            if (this.player.subtitlePreview) {
                this.player.subtitlePreview.innerHTML = this.player.currentSubtitleText;
            }
            
            // 绘制每个字幕
            currentSubtitles.forEach(subtitle => {
                this.drawSubtitle(subtitle.text, subtitle.style);
            });
        } else {
            this.player.currentSubtitleText = '';
            if (this.player.subtitlePreview) {
                this.player.subtitlePreview.textContent = '无字幕';
            }
        }
    }

    // 绘制单个字幕
    drawSubtitle(text, styleName = 'Default') {
        if (!text) return;
        
        // 获取样式配置
        const style = this.player.styles[styleName] || this.player.defaultStyle;
        
        // 计算缩放比例
        const scaleFactorX = this.player.videoCanvas.width / this.player.playResX;
        const scaleFactorY = this.player.videoCanvas.height / this.player.playResY;
        const scaleFactor = Math.min(scaleFactorX, scaleFactorY);
        
        // 设置字幕样式
        const fontSize = Math.max((style.fontSize || this.player.defaultStyle.fontSize) * scaleFactor, 12);
        const fontName = style.fontName || this.player.defaultStyle.fontName;
        const bold = style.bold !== undefined ? style.bold : this.player.defaultStyle.bold;
        const italic = style.italic !== undefined ? style.italic : this.player.defaultStyle.italic;
        
        let fontStyle = '';
        if (bold) fontStyle += 'bold ';
        if (italic) fontStyle += 'italic ';
        
        // 使用更通用的字体栈
        const fontFamily = `"${fontName}", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "WenQuanYi Micro Hei", sans-serif`;
        this.player.ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
        this.player.ctx.textAlign = 'center';
        this.player.ctx.textBaseline = 'alphabetic';
        
        // 默认颜色使用样式中的primaryColor
        const defaultColor = style.primaryColor || this.player.defaultStyle.primaryColor;
        
        // 计算字幕位置
        let baseY;
        const marginV = (style.marginV || this.player.defaultStyle.marginV) * scaleFactor;
        
        const alignment = style.alignment || this.player.defaultStyle.alignment;
        
        switch (alignment) {
            case 1: case 4: case 7: case 2: case 3:
                baseY = this.player.videoCanvas.height - marginV;
                break;
            case 5: case 6:
                baseY = this.player.videoCanvas.height / 2;
                break;
            case 8: case 9:
                baseY = marginV + fontSize;
                break;
            default:
                baseY = this.player.videoCanvas.height - marginV;
                break;
        }
        
        // 绘制文本
        this.drawTextWithColorTagsAndWrap(text, baseY, fontSize, style, defaultColor, scaleFactor);
    }

    // 绘制带颜色标签和自动换行的文本
    drawTextWithColorTagsAndWrap(text, baseY, fontSize, style, defaultColor, scaleFactor) {
        // 解析文本中的颜色标签
        const segments = this.parseColorSegments(text, defaultColor);
        
        // 计算可用宽度
        const marginL = (style.marginL || this.player.defaultStyle.marginL) * scaleFactor;
        const marginR = (style.marginR || this.player.defaultStyle.marginR) * scaleFactor;
        const maxWidth = this.player.videoCanvas.width - marginL - marginR;
        
        // 自动换行
        const lines = this.wrapText(segments, maxWidth, fontSize);
        
        // 计算总高度
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        
        // 根据alignment调整起始Y坐标
        const alignment = style.alignment || this.player.defaultStyle.alignment;
        let startY;
        
        switch (alignment) {
            case 1: case 4: case 7: case 2: case 3:
                startY = baseY - totalHeight + lineHeight;
                break;
            case 5: case 6:
                startY = baseY - (totalHeight / 2) + (lineHeight / 2);
                break;
            case 8: case 9:
                startY = baseY;
                break;
            default:
                startY = baseY - totalHeight + lineHeight;
                break;
        }
        
        // 绘制每一行
        lines.forEach((lineSegments, lineIndex) => {
            const y = startY + (lineIndex * lineHeight);
            
            // 计算该行的总宽度
            let lineWidth = 0;
            lineSegments.forEach(segment => {
                lineWidth += this.player.measureTextWidth(segment.text);
            });
            
            // 计算起始X坐标（居中）
            const startX = (this.player.videoCanvas.width - lineWidth) / 2;
            
            // 绘制该行的每个片段
            let currentX = startX;
            
            lineSegments.forEach(segment => {
                const width = this.player.measureTextWidth(segment.text);
                
                // 绘制文字阴影
                const outlineWidth = (style.outline || this.player.defaultStyle.outline) * scaleFactor;
                if (outlineWidth > 0) {
                    this.player.ctx.strokeStyle = style.outlineColor || this.player.defaultStyle.outlineColor;
                    this.player.ctx.lineWidth = outlineWidth;
                    this.player.ctx.strokeText(segment.text, currentX + width / 2, y);
                }
                
                // 绘制文字主体
                this.player.ctx.fillStyle = segment.color;
                this.player.ctx.fillText(segment.text, currentX + width / 2, y);
                
                currentX += width;
            });
        });
    }

    // 文本自动换行
    wrapText(segments, maxWidth, fontSize) {
        const lines = [];
        let currentLine = [];
        let currentLineWidth = 0;
        
        for (const segment of segments) {
            // 将文本按空格和标点符号拆分，保留标点符号
            const words = this.splitTextWithPunctuation(segment.text);
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (!word.trim()) continue;
                
                // 检查是否需要添加空格
                let wordToAdd = word;
                if (currentLine.length > 0 && !this.isPunctuation(word.charAt(0))) {
                    wordToAdd = ' ' + word;
                }
                
                const wordWidth = this.player.measureTextWidth(wordToAdd);
                
                // 如果当前行加上这个词会超出最大宽度，则换行
                if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
                    lines.push([...currentLine]);
                    currentLine = [];
                    currentLineWidth = 0;
                    // 新行的第一个单词不加空格
                    const firstWordWidth = this.player.measureTextWidth(word);
                    currentLine.push({
                        text: word,
                        color: segment.color
                    });
                    currentLineWidth += firstWordWidth;
                } else {
                    // 添加词到当前行
                    currentLine.push({
                        text: wordToAdd,
                        color: segment.color
                    });
                    currentLineWidth += wordWidth;
                }
            }
        }
        
        // 添加最后一行
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    // 按标点符号分割文本
    splitTextWithPunctuation(text) {
        // 使用正则表达式按空格和标点符号拆分文本，保留标点符号
        const regex = /([\w\u4e00-\u9fff]+|[[\]{}()]|[,.;:!?]|\s+)/g;
        const matches = text.match(regex) || [];
        return matches.filter(match => match.trim());
    }

    // 判断是否为标点符号
    isPunctuation(char) {
        return /[,.;:!?[\]{}()]/.test(char);
    }

    // 解析颜色标签
    parseColorSegments(text, defaultColor) {
        const segments = [];
        let currentText = '';
        let currentColor = defaultColor;
        let i = 0;
        
        while (i < text.length) {
            // 查找颜色标签开始 - 只处理 {\ 开头的标签
            if (text[i] === '{' && i + 1 < text.length && text[i + 1] === '\\') {
                // 如果当前有文本，先保存
                if (currentText) {
                    segments.push({ text: currentText, color: currentColor });
                    currentText = '';
                }
                
                // 查找标签结束
                const endIndex = text.indexOf('}', i);
                if (endIndex === -1) {
                    // 没有找到结束标签，将剩余文本作为普通文本处理
                    currentText += text.substring(i);
                    break;
                }
                
                const tag = text.substring(i, endIndex + 1);
                
                // 解析颜色标签
                if (tag.startsWith('{\\c&H')) {
                    // 颜色标签
                    const colorHex = tag.substring(5, tag.length - 1);
                    currentColor = this.parseASSColor(`&H${colorHex}`);
                } else if (tag === '{\\c}') {
                    // 重置颜色标签
                    currentColor = defaultColor;
                }
                
                // 跳过标签
                i = endIndex + 1;
            } else {
                // 普通文本字符（包括中文字符和方括号）
                currentText += text[i];
                i++;
            }
        }
        
        // 添加最后的文本段
        if (currentText) {
            segments.push({ text: currentText, color: currentColor });
        }
        
        return segments;
    }

    // 处理字幕预览文本
    processSubtitleText(text, styleName = 'Default') {
        // 获取样式配置
        const style = this.player.styles[styleName] || this.player.defaultStyle;
        const defaultColor = style.primaryColor || this.player.defaultStyle.primaryColor;
        
        // 解析颜色标签并生成HTML
        const segments = this.parseColorSegments(text, defaultColor);
        let result = '';
        
        for (const segment of segments) {
            const cssColor = this.colorToCSS(segment.color);
            result += `<span style="color: ${cssColor}">${this.escapeHtml(segment.text)}</span>`;
        }
        
        return result || '无文本内容';
    }

    // 颜色转换为CSS格式
    colorToCSS(color) {
        const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            const a = parseFloat(match[4]);
            
            if (a === 1) {
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            } else {
                return color;
            }
        }
        
        return color;
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}