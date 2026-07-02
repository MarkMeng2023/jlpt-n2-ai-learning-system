import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getProgressCounts } from "../src/progress.js";
import {
  QUESTION_REQUIRED_FIELDS,
  loadQuestionBank,
  validateQuestionBank
} from "../src/question-bank.js";
import { createSubmission } from "../src/records.js";
import { buildReviewQueue } from "../src/review-engine.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"))
  .filter((question) => !question.questionId.startsWith("Q-N2-FAC-S14-") && !question.questionId.startsWith("Q-N2-FAC-S15-"));
const knowledgePoints = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const grammarPoints = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const knowledgeCards = JSON.parse(await readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8"))
  .map((card) => ({ ...card, linkedQuestionIds: card.linkedQuestionIds.filter((id) => !id.startsWith("Q-N2-FAC-S14-") && !id.startsWith("Q-N2-FAC-S15-")) }));

test("Sprint 5 题库满足新版 schema 且校验通过", () => {
  const result = validateQuestionBank(questions, knowledgePoints, grammarPoints);
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(questions.length, 205);
  assert.equal(knowledgePoints.length, 30);
  questions.forEach((question) => {
    QUESTION_REQUIRED_FIELDS.forEach((field) => assert.ok(Object.hasOwn(question, field), `${question.questionId}.${field}`));
  });
});

test("六种题型达到 Sprint 5 目标分布", () => {
  const expected = {
    vocabulary_collocation: 20,
    adverb: 10,
    synonym: 10,
    grammar_choice: 20,
    grammar_meaning: 10,
    short_reading: 10
  };
  const actual = Object.fromEntries(Object.keys(expected).map((type) => [
    type,
    questions.filter((question) => question.type === type).length
  ]));
  Object.entries(expected).forEach(([type, count]) => assert.ok(actual[type] >= count, type));
  knowledgePoints.forEach((point) => {
    const relatedCount = questions.filter((question) => question.knowledgePointIds.includes(point.knowledgePointId)).length;
    assert.ok(relatedCount >= 2, `${point.knowledgePointId} should have at least two questions`);
  });
  ["A", "B", "C", "D"].forEach((key) => {
    assert.ok(questions.filter((question) => question.correctAnswer === key).length >= 10, `${key} distribution`);
  });
});

test("校验器为重复 ID、悬空知识点和错误选项输出清晰路径", () => {
  const broken = structuredClone(questions.slice(0, 2));
  broken[1].questionId = broken[0].questionId;
  broken[0].knowledgePointIds = ["KP-NOT-FOUND"];
  delete broken[0].choices.D;
  broken[0].correctAnswer = "E";
  broken[0].difficulty = 8;
  broken[0].tags = "固定搭配";
  broken[0].sourceType = "unknown";
  const result = validateQuestionBank(broken, knowledgePoints);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /questions\[1\]\.questionId: duplicate ID/.test(error)));
  assert.ok(result.errors.some((error) => /knowledgePointIds\[0\]: unknown knowledge point/.test(error)));
  assert.ok(result.errors.some((error) => /choices\.D/.test(error)));
  assert.ok(result.errors.some((error) => /correctAnswer/.test(error)));
  assert.ok(result.errors.some((error) => /difficulty/.test(error)));
  assert.ok(result.errors.some((error) => /tags: must be an array/.test(error)));
  assert.ok(result.errors.some((error) => /sourceType/.test(error)));
});

test("前端加载器可读取新版题库并拒绝缺少旧必需字段的数据", async () => {
  const fetchValid = async (url) => ({
    ok: true,
    status: 200,
    json: async () => url.includes("grammar-points") ? grammarPoints : url.includes("knowledge-cards") ? knowledgeCards : url.includes("knowledge-points") ? knowledgePoints : questions
  });
  const bank = await loadQuestionBank(fetchValid);
  assert.equal(bank.questions.length, 205);

  const invalidQuestions = structuredClone(questions);
  delete invalidQuestions[0].prompt;
  const fetchInvalid = async (url) => ({
    ok: true,
    status: 200,
    json: async () => url.includes("grammar-points") ? grammarPoints : url.includes("knowledge-cards") ? knowledgeCards : url.includes("knowledge-points") ? knowledgePoints : invalidQuestions
  });
  await assert.rejects(() => loadQuestionBank(fetchInvalid), /questions\[0\]\.prompt: required field is missing/);
});

test("新版题目可正常生成作答记录", () => {
  const question = questions.find((item) => item.questionId === "Q-N2-VOC-0020");
  const operation = createSubmission(question, question.correctAnswer, "sure", new Date());
  assert.equal(operation.answerRecord.questionId, question.questionId);
  assert.equal(operation.answerRecord.section, "vocabulary");
  assert.deepEqual(operation.answerRecord.knowledgePointIds, question.knowledgePointIds);
  assert.equal(operation.answerRecord.isCorrect, true);
});

test("Review Engine 能从标准知识点关联中抽取多道题", () => {
  const record = {
    recordId: "AR-SPRINT5",
    questionId: "Q-N2-VOC-0001",
    isCorrect: false,
    confidence: "uncertain",
    answeredAt: "2026-06-30T01:00:00.000Z",
    knowledgePointIds: ["KP-VOC-HATASU-001"]
  };
  const queue = buildReviewQueue(questions, [record]);
  const group = queue.find((item) => item.knowledgePointId === "KP-VOC-HATASU-001");
  assert.equal(group.questionIds.length, 4);
  group.questionIds.forEach((questionId) => {
    const question = questions.find((item) => item.questionId === questionId);
    assert.ok(question.knowledgePointIds.includes(group.knowledgePointId));
  });
});

test("扩展题库保留旧 questionId，因此历史进度不会重置", () => {
  const oldIds = ["Q-N2-VOC-0001", "Q-N2-GRC-0005", "Q-N2-READ-0005"];
  oldIds.forEach((id) => assert.ok(questions.some((question) => question.questionId === id)));
  const counts = getProgressCounts(questions, oldIds);
  assert.deepEqual(counts, { total: 205, completed: 3, remaining: 202 });
});
