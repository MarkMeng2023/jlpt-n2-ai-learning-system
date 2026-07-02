# JLPT N2 AI Learning System — Sprint 14

Sprint 6 暂停扩题，建立题库来源、知识点证据和质量门禁。现有 80 道题与 30 个知识点保持不变；只有来源验证、解析质量与人工审核达标后，才进入 300 题扩充阶段。Sprint 5 的标准化题库与 Sprint 4 的 Review Engine 继续保留。

## 本地启动与测试

项目无构建步骤，通过 HTTP 服务器运行：

```bash
python3 -m http.server 8000
```

访问 `http://localhost:8000`。运行测试：

```bash
npm run validate:bank
npm test
```

题库维护规范见 [`docs/question-bank-standard.md`](docs/question-bank-standard.md)。

来源验证与扩题门禁见 [`docs/question-bank-source-strategy.md`](docs/question-bank-source-strategy.md)。生成当前质量基线：

```bash
npm run report:quality
```

Sprint 6.1 已补全全部 80 题解析：解析过短与未说明干扰项均降为 0。当前扩题门禁仍为 `HOLD`，剩余原因仅为 30 个知识点尚未登记独立验证来源；在来源验证完成前继续暂停扩题。

Sprint 7.1 新增独立的 N2 Grammar Master Map，不修改题库或学习界面：

```bash
npm run validate:grammar
npm run report:grammar
```

主数据库位于 `knowledge/grammar/`，覆盖报告位于 `knowledge/reports/grammar-coverage-report.md`。条目只有在独立来源证据完整后才能从 `draft` 改为 `verified`。

Sprint 7.2 已按两个独立 N2 学习资料目录交叉验证首批30个文法点；其余50个继续保持 `draft`。验证详情见 `knowledge/reports/grammar-verification-report.md`。来源验证不等于JLPT官方认证，且在剩余条目完成前 Expansion gate 继续保持 `HOLD`。

Sprint 8 新增 Knowledge Point Driven Question Factory。它按可配置的知识点目标题数生成覆盖报告与待补计划，不直接生成题目：

```bash
npm run report:factory
```

输出位于 `knowledge/reports/question-coverage-report.md` 和 `reports/question-generation-plan.md`。候选题进入正式题库前仍须通过 Question Validation、Question Review 与 Question Bank Validation。

Sprint 9 使用 Factory 当前 Top 10 进行第一批自动补题。流水线使用稳定 ID，重复运行会更新同一批题而不会重复追加：

```bash
npm run generate:sprint9
npm run report:factory
npm run report:quality
```

也可以运行完整自动流水线：`npm run pipeline:sprint9`。

Sprint 10 为最新计划中未参与上一批的10个高优先级文法点各补充4题，并新增首页 Project Status。版本、Sprint 和题目目标来自 `data/version.json`；题目数、知识点数与 Coverage 由页面加载时自动计算。完整流水线：

```bash
npm run pipeline:sprint10
```

Sprint 11 新增100张统一 Knowledge Card，为 Question Bank、Review上下文、Question Factory和Project Status提供同一知识数据源：

```bash
npm run generate:cards
npm run validate:cards
npm run pipeline:sprint11
```

覆盖与验证结果见 `knowledge/reports/knowledge-card-coverage-report.md` 和 `knowledge/reports/knowledge-card-validation-report.md`。

Sprint 12 完成产品本地化 Phase 1：首页 Project Status、学习模式、复习队列、知识状态、按钮、状态提示与主要自动报告标题统一改为简体中文；代码、变量名、JSON 字段和文件名保持英文。同时按最新 Question Factory 缺口为第三批10个高优先级文法点各补充4题，题库扩展至205题，当前目标完成率为24.26%。版本信息来自 `data/version.json`：

```bash
npm run pipeline:sprint12
```

Sprint 13 新增 JLPT N2 Exam Coverage Engine，以题量覆盖、知识卡完整度、题型与难度多样性、来源验证四项权重计算每个知识点的 0~100 Coverage Score。首页显示可展开的考试覆盖 Dashboard，Question Factory 改为优先处理 Coverage Score 最低的知识点：

```bash
npm run report:coverage
npm run validate:coverage
npm run report:factory
```

考试覆盖报告位于 `knowledge/reports/exam-coverage-report.md`。当前页面应显示 `v1.13.0` 与 `Sprint 13`；Sprint 13 不新增题目，题库仍为205题。

Sprint 14 Content Sprint 1 根据 Exam Coverage Score、考试频率、当前题数和题型缺口，为29个低覆盖文法点各补充4题。新增116题涵盖单句、对话、辨析和短文四种形式，题库达到321题：

```bash
npm run generate:sprint14
npm run pipeline:sprint14
```

当前版本为 `v1.14.0` / `Sprint 14`，N2考试覆盖率为48.86%，题量目标完成率为37.99%。

## Review Engine 规则

Knowledge Status：

- `NEW`：从未作答。
- `LEARNING`：正确率低于 70%。
- `REVIEW`：正确率至少 70%，但尚未达到掌握标准。
- `MASTERED`：正确率至少 90%、最近连续正确至少 5 次、累计练习至少 10 次。

今日复习先按 `weaknessScore` 降序，再依次比较最近答错、最近不确定、最近蒙对、距上次练习时间和知识点 ID。知识点内的题目同样使用固定排序，只有随机练习会打乱。

默认选择最优先的 5 个非 NEW、非 MASTERED 知识点，每个知识点最多抽取 5 道关联题。题目必须在题库的 `knowledgePointIds` 中明确关联该知识点，且同一队列不重复题目。Sprint 5 扩充后，每个现有知识点均有至少 2 道关联题。

错题重做只收录存在 `isCorrect = false` 记录的题目。同一题只出现一次，按其最近一次错误时间倒序。

## Google Sheets 部署

Sprint 5 没有修改 Apps Script 或 Google Sheets 表结构，因此从 Sprint 4 升级到 Sprint 5 不需要重新部署 Apps Script，也不需要重新运行 `setupSheets()`。以下步骤仅用于全新部署：

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
