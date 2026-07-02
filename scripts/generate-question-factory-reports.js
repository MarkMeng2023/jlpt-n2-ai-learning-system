#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildQuestionFactoryPlan, DEFAULT_COVERAGE_RULES } from "../src/question-factory.js";
import { buildExamCoverage } from "../src/exam-coverage.js";

const [knowledgeCards, questions, grammarPoints] = await Promise.all([
  readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/questions.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse)
]);
const examCoverage = buildExamCoverage({ knowledgeCards, questions, grammarPoints });
const result = buildQuestionFactoryPlan({ knowledgeCards, questions, examCoverage });
const { summary, coverage, generationPlan } = result;
const percent = (value) => `${value.toFixed(2)}%`;
const yesNo = (value) => value ? "YES" : "NO";
const recommendations = (entry) => entry.recommendations
  .map((item) => `${item.label} ${item.suggestedCount}题（难度 ${item.difficulties.join("/")}）`)
  .join("；");

const coverageReport = [
  "# 题库覆盖率报告",
  "",
  "由知识点驱动题库工厂确定性生成。本报告统计题目与知识点的关联数；一题绑定多个知识点时，每个关联分别计数。",
  "",
  "## 摘要",
  "",
  `- 知识点总数：**${summary.knowledgePointCount}**`,
  `- 当前题目数：**${summary.questionCount}**`,
  `- 当前题目—知识点关联数：**${summary.currentAssociations}**`,
  `- 理论目标关联数：**${summary.totalTarget}**`,
  `- 总缺口：**${summary.totalGap}**`,
  `- 目标完成率：**${percent(summary.targetCoverageRate)}**`,
  `- 至少有 1 题的知识点：**${summary.coveredKnowledgePoints}/${summary.knowledgePointCount}（${percent(summary.pointCoverageRate)}）**`,
  "",
  "## 覆盖规则",
  "",
  "| 类型 | 目标题数 |",
  "| --- | ---: |",
  ...Object.entries(DEFAULT_COVERAGE_RULES).map(([kind, target]) => `| ${kind} | ${target} |`),
  "",
  "## 知识点覆盖明细",
  "",
  "| Knowledge Point | 标题 | 类型 | 当前 | 目标 | 缺口 | 完成率 |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: |",
  ...coverage.map((entry) => `| ${entry.knowledgePointId} | ${entry.title} | ${entry.kind} | ${entry.current} | ${entry.target} | ${entry.gap} | ${percent(entry.coverageRate)} |`),
  ""
];

const planReport = [
  "# 出题计划",
  "",
  "题库工厂只生成待补计划，不直接生成或写入题目。任何新增题仍须依次通过题目校验、人工题目复核和题库校验。",
  "",
  "## 摘要",
  "",
  `- 待补知识点：**${generationPlan.length}**`,
  `- 建议新增关联数：**${summary.totalGap}**`,
  `- 当前目标完成率：**${percent(summary.targetCoverageRate)}**`,
  "",
  "## 必需元数据",
  "",
  "未来工厂生成的题目元数据必须包含：`difficulty`、`reviewWeight`、`knowledgePointId`、`generationType`、`sourceType`、`version`、`createdAt`。",
  "",
  "## 计划",
  "",
  "Factory 已改为优先处理考试 Coverage Score 最低的 Knowledge Point；题量缺口用于确定建议新增数量。",
  "",
  "| 优先级 | 知识点 | 标题 | 考试覆盖率 | 建议新增 | 题型与难度建议 | 已有真题 | 已有 AI 题 |",
  "| --- | --- | --- | ---: | ---: | --- | --- | --- |",
  ...generationPlan.map((entry) => `| ${entry.priority} | ${entry.knowledgePointId} | ${entry.title} | ${percent(entry.examCoverageScore || 0)} | ${entry.gap} | ${recommendations(entry)} | ${yesNo(entry.hasOfficialQuestion)} | ${yesNo(entry.hasAiQuestion)} |`),
  "",
  "## 质量门禁",
  "",
  "1. 题库工厂生成待补计划。",
  "2. 人工或后续生成流程依据计划制作候选题。",
  "3. 候选题通过题目校验。",
  "4. 候选题通过人工题目复核。",
  "5. 合并后运行题库校验，全部通过才可进入正式题库。",
  ""
];

await Promise.all([
  mkdir(new URL("../knowledge/reports/", import.meta.url), { recursive: true }),
  mkdir(new URL("../reports/", import.meta.url), { recursive: true })
]);
await Promise.all([
  writeFile(new URL("../knowledge/reports/question-coverage-report.md", import.meta.url), `${coverageReport.join("\n")}\n`),
  writeFile(new URL("../reports/question-generation-plan.md", import.meta.url), `${planReport.join("\n")}\n`)
]);
console.log(`Question Factory reports generated: ${summary.knowledgePointCount} knowledge points, ${summary.currentAssociations}/${summary.totalTarget} associations, gap ${summary.totalGap}.`);
