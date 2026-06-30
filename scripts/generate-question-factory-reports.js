#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildQuestionFactoryPlan, DEFAULT_COVERAGE_RULES } from "../src/question-factory.js";

const [basePoints, grammarPoints, questions] = await Promise.all([
  readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/questions.json", import.meta.url), "utf8").then(JSON.parse)
]);
const result = buildQuestionFactoryPlan({ basePoints, grammarPoints, questions });
const { summary, coverage, generationPlan } = result;
const percent = (value) => `${value.toFixed(2)}%`;
const yesNo = (value) => value ? "YES" : "NO";
const recommendations = (entry) => entry.recommendations
  .map((item) => `${item.label} ${item.suggestedCount}题（难度 ${item.difficulties.join("/")}）`)
  .join("；");

const coverageReport = [
  "# Question Coverage Report",
  "",
  "由 Knowledge Point Driven Question Factory 确定性生成。本报告统计题目与知识点的关联数；一题绑定多个知识点时，每个关联分别计数。",
  "",
  "## Summary",
  "",
  `- Knowledge Point 总数：**${summary.knowledgePointCount}**`,
  `- 当前题目数：**${summary.questionCount}**`,
  `- 当前题目—知识点关联数：**${summary.currentAssociations}**`,
  `- 理论目标关联数：**${summary.totalTarget}**`,
  `- 总缺口：**${summary.totalGap}**`,
  `- 目标完成率：**${percent(summary.targetCoverageRate)}**`,
  `- 至少有 1 题的知识点：**${summary.coveredKnowledgePoints}/${summary.knowledgePointCount}（${percent(summary.pointCoverageRate)}）**`,
  "",
  "## Coverage Rules",
  "",
  "| 类型 | 目标题数 |",
  "| --- | ---: |",
  ...Object.entries(DEFAULT_COVERAGE_RULES).map(([kind, target]) => `| ${kind} | ${target} |`),
  "",
  "## Knowledge Point Coverage",
  "",
  "| Knowledge Point | 标题 | 类型 | 当前 | 目标 | 缺口 | 完成率 |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: |",
  ...coverage.map((entry) => `| ${entry.knowledgePointId} | ${entry.title} | ${entry.kind} | ${entry.current} | ${entry.target} | ${entry.gap} | ${percent(entry.coverageRate)} |`),
  ""
];

const planReport = [
  "# Question Generation Plan",
  "",
  "Factory 只生成待补计划，不直接生成或写入题目。任何新增题仍须依次通过 Question Validation、Question Review 和 Question Bank Validation。",
  "",
  "## Summary",
  "",
  `- 待补 Knowledge Points：**${generationPlan.length}**`,
  `- 建议新增关联数：**${summary.totalGap}**`,
  `- 当前目标完成率：**${percent(summary.targetCoverageRate)}**`,
  "",
  "## Required Metadata",
  "",
  "未来工厂生成的题目元数据必须包含：`difficulty`、`reviewWeight`、`knowledgePointId`、`generationType`、`sourceType`、`version`、`createdAt`。",
  "",
  "## Plan",
  "",
  "| Priority | Knowledge Point | 标题 | 建议新增 | 题型与难度建议 | 已有真题 | 已有 AI 题 |",
  "| --- | --- | --- | ---: | --- | --- | --- |",
  ...generationPlan.map((entry) => `| ${entry.priority} | ${entry.knowledgePointId} | ${entry.title} | ${entry.gap} | ${recommendations(entry)} | ${yesNo(entry.hasOfficialQuestion)} | ${yesNo(entry.hasAiQuestion)} |`),
  "",
  "## Quality Gate",
  "",
  "1. Question Factory 生成待补计划。",
  "2. 人工或后续生成流程依据计划制作候选题。",
  "3. 候选题通过 Question Validation。",
  "4. 候选题通过 Question Review。",
  "5. 合并后运行 Question Bank Validation，全部通过才可进入正式题库。",
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
