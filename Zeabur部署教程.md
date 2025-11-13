# Zeabur 部署 ass-player 项目详细教程

本教程将指导你如何将本项目部署到 Zeabur 云平台，并实现自动化部署（CI/CD），支持私有仓库。

---

## 一、准备工作

1. **注册 Zeabur 账号**
   - 访问 [https://zeabur.com/zh-cn](https://zeabur.com/zh-cn) 注册并登录。

2. **准备 GitHub 仓库**
   - 确保你的项目已推送到 GitHub（支持私有仓库）。

---

## 二、在 Zeabur 创建新服务

1. 登录 Zeabur 后，点击“新建项目”。
2. 选择“从 Git 仓库导入”。
3. 关联你的 GitHub 账号，授权 Zeabur 访问你的仓库（包括私有仓库）。
4. 选择你的 `ass-player` 仓库，点击“导入”。

---

## 三、配置 Python Web 服务

1. **检测到 Python 项目后，Zeabur 会自动识别。**
2. 如未自动识别，请手动选择“Python”作为运行环境。
3. **启动命令**：
   - 推荐使用 `python start.py` 或 `python app.py`（根据你的入口文件）。
   - 端口号：Zeabur 会自动设置 `PORT` 环境变量，需在代码中读取。

   示例（`app.py`）：
   ```python
   import os
   ...
   if __name__ == '__main__':
       port = int(os.environ.get('PORT', 5000))
       app.run(host='0.0.0.0', port=port)
   ```

4. **依赖安装**：
   - Zeabur 会自动执行 `pip install -r requirements.txt`。

---

## 四、自动化部署（CI/CD）配置

1. **每次推送/合并到 main 分支，自动触发部署**。
2. Zeabur 默认集成 CI/CD，无需额外配置。
3. 如需自定义构建/测试流程，可在根目录添加 `.zeabur/scripts/build.sh`、`.zeabur/scripts/prestart.sh` 等脚本。

   示例：
   - `.zeabur/scripts/prestart.sh`（自动化测试）
     ```bash
     #!/bin/bash
     python run_tests.py
     ```
   - `.zeabur/scripts/build.sh`（自定义构建）
     ```bash
     #!/bin/bash
     # npm install && npm run build
     ```
   - **注意**：脚本需赋予可执行权限（Zeabur 会自动处理）。

---

## 五、环境变量配置

1. 在 Zeabur 控制台“环境变量”页面，添加自定义变量（如有）。
2. Zeabur 会自动注入 `PORT` 变量。

---

## 六、访问与调试

1. 部署完成后，Zeabur 会分配一个公网域名。
2. 访问该域名即可体验在线 Demo。
3. 如需绑定自定义域名，可在 Zeabur 控制台操作。

---

## 七、常见问题

- **静态文件缓存问题**：如遇到前端静态资源未及时更新，可在 Zeabur 控制台重启服务，或清理浏览器缓存。
- **依赖安装失败**：请确保 `requirements.txt` 完整，且无私有依赖。
- **端口占用/未监听**：务必监听 `0.0.0.0`，端口用 `os.environ['PORT']`。

---

## 八、参考自动化脚本/CI 配置

### 1. `.zeabur/scripts/prestart.sh`
```bash
#!/bin/bash
python run_tests.py
```

### 2. `.zeabur/scripts/build.sh`（如需前端构建）
```bash
#!/bin/bash
# npm install && npm run build
```

---

## 九、项目结构说明

详见 `README.md` 和 `项目结构.txt`。

---

## 十、FAQ & 支持

- Zeabur 官方文档：[https://docs.zeabur.com/zh/](https://docs.zeabur.com/zh/)
- 有问题可在 GitHub Issues 或 Zeabur 社区提问。

---

> 本教程适用于 2025 年 11 月 Zeabur 最新版本，若界面有变化请以官方文档为准。
