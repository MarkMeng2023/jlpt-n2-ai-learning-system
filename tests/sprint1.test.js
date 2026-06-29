import assert from "node:assert/strict";
import test from "node:test";
import { buildChatGptPrompt } from "../src/prompt-builder.js";
import { createSubmission } from "../src/records.js";
import { SyncQueue } from "../src/sync-queue.js";

const question = {
  questionId: "Q-TEST-0001",
  level: "N2",
  section: "language_knowledge",
  type: "vocabulary_collocation",
  typeLabel: "词汇・固定搭配",
  prompt: "疲れが（　　　）。",
  choices: { A: "たまった", B: "集まった", C: "増えた", D: "積んだ" },
  correctAnswer: "A",
  knowledgePointIds: ["KP-TEST-001"]
};

test("答错且蒙题时保留两个弱点原因和必要快照", () => {
  const operation = createSubmission(question, "D", "guessed", new Date());

  assert.equal(operation.syncStatus, "pending");
  assert.equal(operation.weakPoint.sourceRecordId, operation.answerRecord.recordId);
  assert.deepEqual(operation.weakPoint.reasons, ["wrong_answer", "guessed"]);
  assert.equal(operation.weakPoint.prompt, question.prompt);
  assert.equal(operation.weakPoint.userAnswer, "D");
  assert.equal(operation.weakPoint.correctAnswer, "A");
  assert.equal(operation.weakPoint.questionType, question.type);
});

test("确定且答对时不生成 WeakPoint", () => {
  const operation = createSubmission(question, "A", "sure", new Date());
  assert.equal(operation.answerRecord.isCorrect, true);
  assert.equal(operation.weakPoint, null);
});

test("本地队列按 operationId 防重复并可在成功后移除", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };

  const queue = new SyncQueue("test-queue");
  const operation = createSubmission(question, "B", "uncertain", new Date());
  queue.add(operation);
  queue.add(operation);
  assert.equal(queue.getAll().length, 1);

  queue.remove(operation.operationId);
  assert.equal(queue.getAll().length, 0);
});

test("ChatGPT Prompt 包含题目、答案、确定度和知识点", () => {
  const operation = createSubmission(question, "B", "uncertain", new Date());
  const prompt = buildChatGptPrompt({ question, answerRecord: operation.answerRecord });

  assert.match(prompt, /Q-TEST-0001/);
  assert.match(prompt, /我的答案：B/);
  assert.match(prompt, /正确答案：A/);
  assert.match(prompt, /不确定/);
  assert.match(prompt, /KP-TEST-001/);
});
