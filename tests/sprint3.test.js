import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const code = await readFile(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const context = vm.createContext({ console });
vm.runInContext(code, context);

function calculate(records) {
  return JSON.parse(JSON.stringify(context.calculateLearningStats_(records)));
}

function record(overrides = {}) {
  return {
    recordId: `AR-${Math.random()}`,
    questionType: "grammar_choice",
    isCorrect: true,
    confidence: "sure",
    answeredAt: "2026-06-30T01:00:00.000Z",
    knowledgePointIds: ["KP-1"],
    knowledgePointTitles: ["知识点一"],
    ...overrides
  };
}

test("answer_records 为空时返回零值且不报错", () => {
  assert.deepEqual(calculate([]), {
    totalAnswered: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracy: 0,
    byQuestionType: [],
    byKnowledgePoint: [],
    lastAnsweredAt: null
  });
});

test("多条记录能正确计算总正确率和题型统计", () => {
  const stats = calculate([
    record(),
    record({ isCorrect: false, answeredAt: "2026-06-30T02:00:00.000Z" }),
    record({ questionType: "adverb", isCorrect: true })
  ]);
  assert.equal(stats.totalAnswered, 3);
  assert.equal(stats.correctCount, 2);
  assert.equal(stats.wrongCount, 1);
  assert.equal(stats.accuracy, 66.67);
  assert.equal(stats.lastAnsweredAt, "2026-06-30T02:00:00.000Z");
  assert.deepEqual(stats.byQuestionType.find((item) => item.type === "grammar_choice"), {
    type: "grammar_choice", total: 2, correct: 1, wrong: 1, accuracy: 50
  });
});

test("同一个 knowledgePointId 会跨多条记录聚合", () => {
  const stats = calculate([
    record(),
    record({
      isCorrect: false,
      knowledgePointIds: JSON.stringify(["KP-1"]),
      knowledgePointTitles: JSON.stringify(["知识点一"])
    }),
    record({ knowledgePointIds: ["KP-2"], knowledgePointTitles: ["知识点二"] })
  ]);
  const point = stats.byKnowledgePoint.find((item) => item.knowledgePointId === "KP-1");
  assert.equal(point.total, 2);
  assert.equal(point.correct, 1);
  assert.equal(point.wrong, 1);
  assert.equal(point.accuracy, 50);
});

test("guessed 和 uncertain 按规则提高 weaknessScore", () => {
  const stats = calculate([
    record({ isCorrect: false, confidence: "uncertain" }),
    record({ isCorrect: true, confidence: "guessed" })
  ]);
  const point = stats.byKnowledgePoint[0];
  assert.equal(point.uncertainCount, 1);
  assert.equal(point.guessedCount, 1);
  assert.equal(point.accuracy, 50);
  assert.equal(point.weaknessScore, 12); // 1*3 + 1*2 + 1*2 + 5
});

test("页面包含统计区域，客户端支持 getLearningStats", async () => {
  const [html, client] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/sync-client.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="learning-stats-content"/);
  assert.match(html, /最弱 5 个知识点/);
  assert.match(client, /async getLearningStats\(\)/);
});
