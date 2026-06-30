# JLPT N2 AI Learning System — Sprint 3

Sprint 3 在“作答 → 判题 → Google Sheets”闭环上增加了学习统计和弱点分析。页面仍保持单题学习的简单结构，不包含图表、知识图谱、登录、复习模式或 AI 自动总结。

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

`doPost` 支持三个 action：

- `submitAnswer`：保持 Sprint 1 的完整快照写入与幂等逻辑。
- `getProgress`：只读取 `answer_records` 的 `questionId` 数据列，返回下方结构。
- `getLearningStats`：读取 `answer_records`，返回总做题数、正确/错误数、总正确率、题型聚合、知识点聚合和最后作答时间。

```json
{
  "success": true,
  "answeredQuestionIds": ["Q-N2-VOC-0001"],
  "totalAnswered": 1,
  "serverTime": "2026-06-30T00:00:00.000Z"
}
```

## Sprint 3 学习统计

页面加载时会独立请求 `getLearningStats`。统计读取失败只会显示“暂时无法读取学习统计，但不影响继续做题。”，不会中断题库加载、作答或同步。一次答案同步成功后，页面也会刷新统计。

正确率使用 0–100 的百分数，保留最多两位小数。知识点弱点分按以下规则计算：

```text
wrong * 3 + uncertainCount * 2 + guessedCount * 2 + (accuracy < 70 ? 5 : 0)
```

知识点先按弱点分从高到低显示；题型按正确率从低到高显示。空表会返回全零统计和空列表。`answer_records` 已有全部所需列，因此无需修改 Google Sheets 表结构。

## 验证清单

- 页面顶部显示题库总数、已完成数和剩余数。
- 刷新页面后自动进入第一道未完成题。
- Google Progress 请求失败时仍能按本地进度继续。
- 提交后的题不会再次出现；全部 30 题完成后显示完成状态。
- `answer_records` 仍保存完整题目快照，错题、不确定题或蒙题仍写入 `weak_points`。
- 同一个 operation 重发时仍返回 `duplicate`，不会新增重复行。

## Sprint 3 测试与手动验证

运行自动测试：

```bash
npm test
```

自动测试覆盖空 `answer_records`、多条记录正确率、同一知识点跨记录聚合，以及 `guessed` / `uncertain` 对弱点分的影响。部署后可按以下步骤验证完整链路：

1. 备份后暂时清空 `answer_records` 的数据行（保留表头），刷新页面，确认统计显示 0 且做题区域正常。
2. 连续提交至少三题，包含正确和错误答案，并选择一次“不确定”和一次“蒙的”。
3. 刷新页面，核对总数、正确率、最弱知识点及题型与 Sheet 数据一致。
4. 检查 `answer_records` 和 `weak_points` 新增记录，确认“下一题”、本地进度和远端同步仍正常。
5. 临时填写无效的 Apps Script URL，刷新后确认统计显示降级提示，同时本地题目仍能加载和作答；验证后恢复 URL。

Apps Script 代码有改动：需要重新复制 `apps-script/Code.gs`，并在“管理部署”中创建新版本。现有部署已经运行过 `setupSheets` 时无需再次运行，也无需新增或调整列。
