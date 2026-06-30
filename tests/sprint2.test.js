import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMPLETION_MESSAGE,
  ProgressStore,
  findFirstUnansweredIndex,
  getProgressCounts,
  loadAnsweredProgress
} from "../src/progress.js";

const questions = [
  { questionId: "Q-1" },
  { questionId: "Q-2" },
  { questionId: "Q-3" },
  { questionId: "Q-4" }
];

test("已做题不会再次出现，下一题选择第一道未完成题", () => {
  const index = findFirstUnansweredIndex(questions, ["Q-1", "Q-2"], 0);
  assert.equal(index, 2);
  assert.equal(questions[index].questionId, "Q-3");
});

test("下一题会跳过后续已经完成的题", () => {
  const index = findFirstUnansweredIndex(questions, ["Q-1", "Q-3"], 1);
  assert.equal(questions[index].questionId, "Q-2");

  const nextIndex = findFirstUnansweredIndex(questions, ["Q-1", "Q-2", "Q-3"], index + 1);
  assert.equal(questions[nextIndex].questionId, "Q-4");
});

test("全部完成时返回完成状态", () => {
  const answered = questions.map((question) => question.questionId);
  assert.equal(findFirstUnansweredIndex(questions, answered), -1);
  assert.equal(COMPLETION_MESSAGE, "本轮题库已完成");
  assert.deepEqual(getProgressCounts(questions, answered), {
    total: 4,
    completed: 4,
    remaining: 0
  });
});

test("Google Progress 失败时使用本地缓存", async () => {
  const values = new Map([["progress", JSON.stringify(["Q-1", "Q-3"])]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const store = new ProgressStore("progress", storage);
  const result = await loadAnsweredProgress(store.getAnsweredQuestionIds(), async () => {
    throw new Error("network unavailable");
  });

  assert.equal(result.source, "local");
  assert.deepEqual(result.answeredQuestionIds, ["Q-1", "Q-3"]);
  assert.match(result.error.message, /network unavailable/);
});

test("远端进度与本地未同步进度取并集", async () => {
  const result = await loadAnsweredProgress(["Q-2"], async () => ({
    answeredQuestionIds: ["Q-1", "Q-2"]
  }));
  assert.equal(result.source, "remote");
  assert.deepEqual(result.answeredQuestionIds, ["Q-2", "Q-1"]);
});

test("题库至少 30 题、覆盖六种题型且字段完整", async () => {
  const raw = await readFile(new URL("../data/questions.json", import.meta.url), "utf8");
  const bank = JSON.parse(raw);
  const requiredTypes = [
    "vocabulary_collocation",
    "adverb",
    "synonym",
    "grammar_choice",
    "grammar_meaning",
    "short_reading"
  ];
  const requiredFields = [
    "questionId", "level", "section", "type", "prompt", "choices",
    "correctAnswer", "explanation", "knowledgePointIds",
    "knowledgePointTitles", "difficulty", "sourceType"
  ];

  assert.ok(bank.length >= 30);
  assert.equal(new Set(bank.map((question) => question.questionId)).size, bank.length);
  requiredTypes.forEach((type) => assert.ok(bank.some((question) => question.type === type), type));
  bank.forEach((question) => {
    requiredFields.forEach((field) => assert.ok(Object.hasOwn(question, field), `${question.questionId}.${field}`));
    assert.deepEqual(Object.keys(question.choices), ["A", "B", "C", "D"]);
    assert.ok(Object.hasOwn(question.choices, question.correctAnswer));
    assert.equal(question.knowledgePointIds.length, question.knowledgePointTitles.length);
  });
});
