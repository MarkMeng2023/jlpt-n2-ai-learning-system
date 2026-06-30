# JLPT N2 AI Learning System — Sprint 4

Sprint 4 新增 Review Engine。首页根据 `answer_records` 自动生成今日计划，提供继续学习、今日复习、错题重做和随机练习四种模式；不包含 Dashboard、图表、AI 自动总结、知识图谱、登录。

## 本地启动与测试

项目无构建步骤，通过 HTTP 服务器运行：

```bash
python3 -m http.server 8000
```

访问 `http://localhost:8000`。运行测试：

```bash
npm test
```

## Review Engine 规则

Knowledge Status：

- `NEW`：从未作答。
- `LEARNING`：正确率低于 70%。
- `REVIEW`：正确率至少 70%，但尚未达到掌握标准。
- `MASTERED`：正确率至少 90%、最近连续正确至少 5 次、累计练习至少 10 次。

今日复习先按 `weaknessScore` 降序，再依次比较最近答错、最近不确定、最近蒙对、距上次练习时间和知识点 ID。知识点内的题目同样使用固定排序，只有随机练习会打乱。

默认选择最优先的 5 个非 NEW、非 MASTERED 知识点，每个知识点最多抽取 5 道关联题。题目必须在题库的 `knowledgePointIds` 中明确关联该知识点，且同一队列不重复题目。当前题库每个知识点只有 1 道关联题，因此会使用全部可用关联题；如需达到每点 2–5 题，需要继续补充同知识点题目。

错题重做只收录存在 `isCorrect = false` 记录的题目。同一题只出现一次，按其最近一次错误时间倒序。

## Google Sheets 部署

1. 打开目标 Google Spreadsheet 的 Apps Script。
2. 用 `apps-script/Code.gs` 替换脚本内容。
3. 手动运行一次 `setupSheets()` 并授权。
4. 创建新的 Web App 部署版本。
5. 将 `/exec` URL 配置到 `src/config.js`。

Sprint 4 仅新增 `learning_profile`，不会修改 `answer_records` 或 `weak_points` 的表头。`learning_profile` 是一行当前快照，字段为：

```text
lastStudyDate, totalAnswered, totalCorrect, accuracy, masteredCount,
learningCount, reviewCount, newCount, todayReviewCount, lastUpdated
```

新增接口：

- `getReviewData`：返回 `answer_records` 历史，供浏览器生成复习队列。
- `saveLearningProfile`：写入当前学习档案快照。

原有 `submitAnswer`、`getProgress`、`getLearningStats` 保持可用。

## 验证要点

- 首页显示新题、今日复习、错题、已掌握、学习中、待巩固数量。
- 继续学习进入下一道未完成题。
- 今日复习顺序重复刷新后保持一致，且每题属于显示的知识点。
- 错题重做按最近错误时间倒序。
- 随机练习可包含已完成或未完成题。
- 每次作答仍先进入本地待同步队列；Google Sheets 不可用时不会丢记录。
- Apps Script 更新后运行 `setupSheets()` 可创建 `learning_profile`，已有两张表不变。
