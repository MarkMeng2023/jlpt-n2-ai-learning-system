# JLPT N2 AI Learning System — Sprint 1

Sprint 1 只实现单题完整闭环：本地题目 → 作答与确定度 → 判题 → 本地待同步队列 → Google Apps Script → Google Sheets → ChatGPT 讲解请求。

## 本地启动

本项目没有构建步骤。由于浏览器直接打开 `index.html` 时不能稳定读取本地 JSON，请通过 HTTP 服务器运行：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

如果本机已安装 Node.js，也可以运行核心业务测试：

```bash
npm test
```

未配置 Apps Script URL 时仍可完成作答、判题、WeakPoint 判断和 Prompt 生成；记录会保留在 localStorage 待同步队列中。

## 部署 Google Apps Script

1. 新建一个 Google Spreadsheet。
2. 在 Spreadsheet 中选择“扩展程序”→“Apps Script”。
3. 用本项目 `apps-script/Code.gs` 的内容替换编辑器中的 `Code.gs`。
4. 保存，在函数列表选择 `setupSheets`，点击“运行”并完成授权。
5. 确认 Spreadsheet 已生成 `answer_records` 和 `weak_points` 两个工作表。
6. 点击“部署”→“新建部署”→ 类型选择“Web 应用”。
7. “执行身份”选择“我”。个人原型可将访问权限设为“任何人”；该 URL 应视为可写端点，不要公开传播。
8. 完成部署并复制以 `/exec` 结尾的 Web App URL。
9. 打开 `src/config.js`，将 URL 填入 `appsScriptUrl`。
10. 重新加载本地页面并提交一题。

每次修改 Apps Script 后，需要在“管理部署”中创建新版本，现有 `/exec` URL 才会使用新代码。

## 成功验证

提交后应同时满足：

- 页面显示 `✅ 已更新完成`。
- localStorage 中对应操作已移除，待同步数量减少。
- `answer_records` 出现一条以 `recordId` 标识的记录。
- 错题、不确定题或蒙题会在 `weak_points` 出现快照。
- 重发同一个 operation 时，服务端返回 `duplicate`，不新增重复行。

## 当前范围限制

- 仅包含 3 道本地 JSON 题目。
- 没有完整 Dashboard、设置页、弱点库或学习报告。
- 暂无手动重试按钮；失败记录保留在 localStorage，待 Sprint 2 提供重试界面。
- 没有 `daily_summary`。
