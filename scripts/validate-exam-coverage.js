#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { buildExamCoverage, validateExamCoverage } from "../src/exam-coverage.js";

const [cards, questions, grammarPoints] = await Promise.all([
  readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/questions.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse)
]);
const result = buildExamCoverage({ knowledgeCards: cards, questions, grammarPoints });
const validation = validateExamCoverage(result, cards, questions, grammarPoints);
try {
  await access(new URL("../knowledge/reports/exam-coverage-report.md", import.meta.url));
} catch {
  validation.errors.push("Exam Coverage Report 尚未生成");
  validation.valid = false;
}
if (!validation.valid) {
  console.error(validation.errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Exam Coverage valid: ${result.summary.knowledgePointCount} knowledge points, ${result.summary.questionCount} questions, ${result.summary.coverageScore.toFixed(2)}%.`);
}
