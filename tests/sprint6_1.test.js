import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeQuestionBankQuality } from "../src/question-bank-quality.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"));
const knowledgePoints = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const sourceRegistry = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const grammarPoints = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const pointsById = new Map(knowledgePoints.map((point) => [point.knowledgePointId, point]));

test("Sprint 6.1 不新增题目并保留全部稳定 ID", () => {
  assert.equal(questions.length, 80);
  assert.equal(new Set(questions.map((question) => question.questionId)).size, 80);
  ["Q-N2-VOC-0001", "Q-N2-GRC-0005", "Q-N2-READ-0010"].forEach((id) => {
    assert.ok(questions.some((question) => question.questionId === id));
  });
});

test("80 题解析均包含知识点、正确理由、逐项分析和类似例句", () => {
  questions.forEach((question) => {
    const point = pointsById.get(question.knowledgePointIds[0]);
    assert.match(question.explanation, new RegExp(`知识点：${point.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.ok(question.explanation.includes(`正确答案：${question.correctAnswer}`));
    assert.ok(question.explanation.includes("正确理由："));
    ["A", "B", "C", "D"].forEach((key) => {
      assert.ok(question.explanation.includes(`${key}「${question.choices[key]}」`), `${question.questionId}.${key}`);
    });
    assert.ok(question.explanation.includes("类似例句："));
    assert.ok(question.explanation.replace(/\s/g, "").length >= 30);
    assert.equal(question.version, 2);
  });
});

test("质量报告确认解析短与干扰项问题归零", () => {
  const report = analyzeQuestionBankQuality(questions, knowledgePoints, sourceRegistry, { additionalKnowledgePoints: grammarPoints });
  assert.equal(report.summary.shortExplanationCount, 0);
  assert.equal(report.summary.missingDistractorAnalysisCount, 0);
  assert.equal(report.summary.publicationBlockerCount, 25);
  assert.equal(report.summary.expansionGate, "HOLD");
  assert.equal(report.summary.missingValidationSourceCount, 25);
});
