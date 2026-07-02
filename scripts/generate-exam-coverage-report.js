#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildExamCoverage, EXAM_CATEGORY_LABELS } from "../src/exam-coverage.js";

const [cards, questions, grammarPoints] = await Promise.all([
  readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/questions.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse)
]);
const result = buildExamCoverage({ knowledgeCards: cards, questions, grammarPoints });
const ascending = [...result.points].sort((a, b) => a.coverageScore - b.coverageScore || a.knowledgePointId.localeCompare(b.knowledgePointId));
const descending = [...result.points].sort((a, b) => b.coverageScore - a.coverageScore || a.knowledgePointId.localeCompare(b.knowledgePointId));
const percent = (value) => `${value.toFixed(2)}%`;
const pointRow = (point) => `| ${point.knowledgePointId} | ${point.title} | ${EXAM_CATEGORY_LABELS[point.category]} | ${point.questionCount}/${point.questionTarget} | ${point.contexts.join("、") || "无"} | ${point.difficultyBands.join("、") || "无"} | ${point.verificationStatus} | ${percent(point.coverageScore)} |`;
const list = (items) => items.length ? items.map((point) => `- ${point.knowledgePointId} · ${point.title}（${percent(point.coverageScore)}）`) : ["- 无"];

const lines = [
  "# N2 考试覆盖率报告",
  "",
  "由 Knowledge Card、Question Bank 与 Grammar Map 的统一知识点数据自动计算。Coverage Score 权重：题量覆盖 40%、知识卡 20%、题型与难度多样性 20%、来源验证 20%。",
  "",
  "## 总览",
  "",
  `- Knowledge Point：**${result.summary.knowledgePointCount}**`,
  `- Question：**${result.summary.questionCount}**`,
  `- 已统计题目关联：**${result.summary.countedQuestionAssociations}**`,
  `- N2 考试覆盖率：**${percent(result.summary.coverageScore)}**`,
  "",
  "## 分类覆盖率",
  "",
  "| 分类 | Knowledge Point | Coverage |",
  "| --- | ---: | ---: |",
  ...result.categoryCoverage.map((entry) => `| ${entry.label} | ${entry.knowledgePointCount} | ${percent(entry.coverageScore)} |`),
  "",
  "## 覆盖率最高 Top20",
  "",
  "| Knowledge Point | 标题 | 分类 | 题量 | 场景 | 难度 | 验证 | Coverage |",
  "| --- | --- | --- | ---: | --- | --- | --- | ---: |",
  ...descending.slice(0, 20).map(pointRow),
  "",
  "## 覆盖率最低 Top20",
  "",
  "| Knowledge Point | 标题 | 分类 | 题量 | 场景 | 难度 | 验证 | Coverage |",
  "| --- | --- | --- | ---: | --- | --- | --- | ---: |",
  ...ascending.slice(0, 20).map(pointRow),
  "",
  "## 缺少阅读题",
  "",
  ...list(ascending.filter((point) => point.risks.missingReading)),
  "",
  "## 缺少长文",
  "",
  ...list(ascending.filter((point) => point.risks.missingLongText)),
  "",
  "## 缺少高难题",
  "",
  ...list(ascending.filter((point) => point.risks.missingHardQuestion)),
  "",
  "## 缺少 Verification",
  "",
  ...list(ascending.filter((point) => point.risks.missingVerification)),
  "",
  "## 下一批建议补题 Top30",
  "",
  ...ascending.slice(0, 30).map((point, index) => `${index + 1}. ${point.knowledgePointId} · ${point.title}：Coverage ${percent(point.coverageScore)}，当前 ${point.questionCount}/${point.questionTarget} 题`),
  ""
];

await mkdir(new URL("../knowledge/reports/", import.meta.url), { recursive: true });
await writeFile(new URL("../knowledge/reports/exam-coverage-report.md", import.meta.url), `${lines.join("\n")}\n`);
console.log(`Exam Coverage report generated: ${result.summary.knowledgePointCount} knowledge points, ${result.summary.coverageScore.toFixed(2)}%.`);
