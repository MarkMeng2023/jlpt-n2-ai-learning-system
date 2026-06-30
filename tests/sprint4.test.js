import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  KNOWLEDGE_STATUS,
  buildKnowledgeProfiles,
  buildLearningProfile,
  buildMistakeQuestionIds,
  buildReviewQueue
} from "../src/review-engine.js";

const questions = [
  { questionId: "Q-1", knowledgePointIds: ["KP-A"], knowledgePointTitles: ["知识点 A"] },
  { questionId: "Q-2", knowledgePointIds: ["KP-A"], knowledgePointTitles: ["知识点 A"] },
  { questionId: "Q-3", knowledgePointIds: ["KP-B"], knowledgePointTitles: ["知识点 B"] },
  { questionId: "Q-4", knowledgePointIds: ["KP-C"], knowledgePointTitles: ["知识点 C"] }
];

function record(questionId, overrides = {}) {
  return {
    recordId: `AR-${questionId}-${Math.random()}`,
    questionId,
    isCorrect: true,
    confidence: "sure",
    answeredAt: "2026-06-01T00:00:00.000Z",
    knowledgePointIds: questionId === "Q-3" ? ["KP-B"] : questionId === "Q-4" ? ["KP-C"] : ["KP-A"],
    ...overrides
  };
}

test("Knowledge Status 按 NEW、LEARNING、REVIEW、MASTERED 规则计算", () => {
  const records = [
    record("Q-1", { isCorrect: false }),
    record("Q-1", { isCorrect: true }),
    record("Q-3", { answeredAt: "2026-06-02T00:00:00.000Z" }),
    ...Array.from({ length: 10 }, (_, index) => record("Q-4", {
      isCorrect: index !== 0,
      answeredAt: `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`
    }))
  ];
  const profiles = buildKnowledgeProfiles(questions, records);
  assert.equal(profiles.find((point) => point.knowledgePointId === "KP-A").status, KNOWLEDGE_STATUS.LEARNING);
  assert.equal(profiles.find((point) => point.knowledgePointId === "KP-B").status, KNOWLEDGE_STATUS.REVIEW);
  assert.equal(profiles.find((point) => point.knowledgePointId === "KP-C").status, KNOWLEDGE_STATUS.MASTERED);

  const newProfiles = buildKnowledgeProfiles([...questions, {
    questionId: "Q-5", knowledgePointIds: ["KP-D"], knowledgePointTitles: ["知识点 D"]
  }], records);
  assert.equal(newProfiles.find((point) => point.knowledgePointId === "KP-D").status, KNOWLEDGE_STATUS.NEW);
});

test("今日复习按弱点优先且每题必须关联该知识点，结果不随机", () => {
  const records = [
    record("Q-1", { isCorrect: false, answeredAt: "2026-06-10T00:00:00.000Z" }),
    record("Q-2", { isCorrect: false, confidence: "uncertain", answeredAt: "2026-06-11T00:00:00.000Z" }),
    record("Q-3", { isCorrect: true, confidence: "guessed", answeredAt: "2026-06-12T00:00:00.000Z" })
  ];
  const first = buildReviewQueue(questions, records);
  const second = buildReviewQueue(questions, records);
  assert.deepEqual(first, second);
  assert.equal(first[0].knowledgePointId, "KP-A");
  assert.deepEqual(first[0].questionIds, ["Q-2", "Q-1"]);
  first.forEach((group) => group.questionIds.forEach((questionId) => {
    const question = questions.find((item) => item.questionId === questionId);
    assert.ok(question.knowledgePointIds.includes(group.knowledgePointId));
  }));
});

test("错题重做去重并按最近错误时间倒序", () => {
  const ids = buildMistakeQuestionIds([
    record("Q-1", { isCorrect: false, answeredAt: "2026-06-01T00:00:00.000Z" }),
    record("Q-1", { isCorrect: false, answeredAt: "2026-06-03T00:00:00.000Z" }),
    record("Q-2", { isCorrect: false, answeredAt: "2026-06-04T00:00:00.000Z" }),
    record("Q-2", { isCorrect: true, answeredAt: "2026-06-05T00:00:00.000Z" })
  ], questions.map((question) => question.questionId));
  assert.deepEqual(ids, ["Q-2", "Q-1"]);
});

test("learning_profile 包含 Sprint 4 要求的全部计数", () => {
  const records = [record("Q-1", { isCorrect: false }), record("Q-3")];
  const profile = buildLearningProfile(questions, records, 3, new Date("2026-06-30T12:00:00.000Z"));
  assert.deepEqual(Object.keys(profile), [
    "lastStudyDate", "totalAnswered", "totalCorrect", "accuracy", "masteredCount",
    "learningCount", "reviewCount", "newCount", "todayReviewCount", "lastUpdated"
  ]);
  assert.equal(profile.totalAnswered, 2);
  assert.equal(profile.totalCorrect, 1);
  assert.equal(profile.accuracy, 50);
  assert.equal(profile.todayReviewCount, 3);
});

test("首页包含四种模式，Apps Script 仅新增 learning_profile", async () => {
  const [html, appsScript] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../apps-script/Code.gs", import.meta.url), "utf8")
  ]);
  ["继续学习", "今日复习", "错题重做", "随机练习"].forEach((label) => assert.match(html, new RegExp(label)));
  assert.match(appsScript, /const LEARNING_PROFILE_SHEET = "learning_profile"/);
  assert.match(appsScript, /"todayReviewCount"/);
  assert.match(appsScript, /if \(payload\.action === "getReviewData"\)/);
});
