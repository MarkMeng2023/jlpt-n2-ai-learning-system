import { createId } from "./id.js";

export function createSubmission(question, userAnswer, confidence, startedAt) {
  const now = new Date();
  const isCorrect = userAnswer === question.correctAnswer;
  const reasons = [];
  if (!isCorrect) reasons.push("wrong_answer");
  if (confidence === "uncertain") reasons.push("uncertain");
  if (confidence === "guessed") reasons.push("guessed");

  const recordId = createId("AR");
  const operationId = createId("OP");
  const answerRecord = {
    recordId,
    questionId: question.questionId,
    level: question.level,
    section: question.section,
    questionType: question.type,
    prompt: question.prompt,
    choices: { ...question.choices },
    userAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect,
    confidence,
    timeSpent: Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000)),
    answeredAt: now.toISOString(),
    knowledgePointIds: [...question.knowledgePointIds],
    knowledgePointTitles: [...question.knowledgePointTitles],
    explanation: question.explanation
  };

  const weakPoint = reasons.length
    ? {
        weakPointId: createId("WP"),
        sourceRecordId: recordId,
        questionId: question.questionId,
        prompt: question.prompt,
        userAnswer,
        correctAnswer: question.correctAnswer,
        questionType: question.type,
        knowledgePointIds: question.knowledgePointIds,
        reasons,
        createdAt: now.toISOString(),
        reviewStatus: "new"
      }
    : null;

  return {
    operationId,
    queuedAt: now.toISOString(),
    syncStatus: "pending",
    answerRecord,
    weakPoint
  };
}
