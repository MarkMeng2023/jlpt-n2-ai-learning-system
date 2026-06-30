# JLPT N2 AI Learning System — Sprint 2

Sprint 2 在原有“作答 → 判题 → Google Sheets”闭环上增加了 30 道本地题库和学习进度记忆。当前只实现顺序学习，不包含 Dashboard、知识图谱、登录或复习模式。

## 本地启动与测试

本项目没有构建步骤。请通过 HTTP 服务器运行，以便浏览器读取 JSON：

```bash
python3 -m http.server 8000
```

访问 `http://localhost:8000`。运行测试：

```bash
npm test
```

题库位于 `data/questions.json`，包含 30 道 N2 风格题，覆盖固定搭配、副词、近义替换、文法选择、文法句意和短篇阅读六种题型。

## Sprint 2 进度记忆逻辑

页面加载时按以下顺序恢复学习位置：

1. 读取 localStorage 中的 `jlpt-n2.answered-question-ids.v1`，并合并待同步队列中的 questionId。
2. 向 Apps Script 发送 `{ "action": "getProgress" }`，读取 `answer_records` 的 `questionId` 列。
3. 将远端与本地的 questionId 取并集，避免尚未同步的本地答案被远端旧进度覆盖。
4. 从题库开头寻找第一道未完成题；之后点击“下一题”也会跳过所有已完成题。
5. 全部完成后显示“本轮题库已完成”，不会自动重新显示旧题。

提交答案时，记录会先写入本地待同步队列，再立即加入本地完成列表。因此即使 Google 请求失败，本机刷新页面也不会重复显示该题。如果 `getProgress` 失败，页面显示“使用本地进度继续学习”；远端可用时显示“学习进度已同步”。

> 当前没有用户登录。Apps Script 返回的是该 Spreadsheet 内所有 `answer_records` 的唯一 questionId，适用于单人学习原型。

## 部署 Google Apps Script

1. 新建或打开目标 Google Spreadsheet。
2. 选择“扩展程序”→“Apps Script”，用 `apps-script/Code.gs` 替换编辑器内容。
3. 在函数列表运行一次 `setupSheets` 并授权；确认生成 `answer_records` 和 `weak_points`。
4. 部署为 Web 应用，执行身份选择“我”，按个人使用场景设置访问权限。
5. 把 `/exec` URL 填入 `src/config.js` 的 `appsScriptUrl`。
6. Apps Script 每次修改后，都要在“管理部署”中创建新版本。

`doPost` 支持两个 action：

- `submitAnswer`：保持 Sprint 1 的完整快照写入与幂等逻辑。
- `getProgress`：只读取 `answer_records` 的 `questionId` 数据列，返回：

```json
{
  "success": true,
  "answeredQuestionIds": ["Q-N2-VOC-0001"],
  "totalAnswered": 1,
  "serverTime": "2026-06-30T00:00:00.000Z"
}
```

## 验证清单

- 页面顶部显示题库总数、已完成数和剩余数。
- 刷新页面后自动进入第一道未完成题。
- Google Progress 请求失败时仍能按本地进度继续。
- 提交后的题不会再次出现；全部 30 题完成后显示完成状态。
- `answer_records` 仍保存完整题目快照，错题、不确定题或蒙题仍写入 `weak_points`。
- 同一个 operation 重发时仍返回 `duplicate`，不会新增重复行。
