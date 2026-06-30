import { APP_CONFIG } from "./config.js";
import { buildChatGptPrompt } from "./prompt-builder.js";
import { createSubmission } from "./records.js";
import {
  COMPLETION_MESSAGE,
  ProgressStore,
  findFirstUnansweredIndex,
  getProgressCounts,
  loadAnsweredProgress,
  mergeAnsweredQuestionIds
} from "./progress.js";
import { SyncClient } from "./sync-client.js";
import { SyncQueue } from "./sync-queue.js";

const elements = {
  appMessage: document.querySelector("#app-message"),
  form: document.querySelector("#answer-form"),
  choices: document.querySelector("#choices"),
  questionNumber: document.querySelector("#question-number"),
  questionType: document.querySelector("#question-type"),
  questionHeading: document.querySelector("#question-heading"),
  submitButton: document.querySelector("#submit-button"),
  nextButton: document.querySelector("#next-button"),
  feedback: document.querySelector("#feedback"),
  feedbackTitle: document.querySelector("#feedback-title"),
  correctAnswer: document.querySelector("#correct-answer"),
  explanation: document.querySelector("#explanation"),
  syncStatus: document.querySelector("#sync-status"),
  syncDetail: document.querySelector("#sync-detail"),
  pendingCount: document.querySelector("#pending-count"),
  promptSection: document.querySelector("#prompt-section"),
  prompt: document.querySelector("#chatgpt-prompt"),
  copyButton: document.querySelector("#copy-button"),
  copyStatus: document.querySelector("#copy-status"),
  totalCount: document.querySelector("#total-count"),
  completedCount: document.querySelector("#completed-count"),
  remainingCount: document.querySelector("#remaining-count"),
  progressStatus: document.querySelector("#progress-status")
};

const queue = new SyncQueue(APP_CONFIG.queueStorageKey);
const progressStore = new ProgressStore(APP_CONFIG.progressStorageKey);
const syncClient = new SyncClient(APP_CONFIG.appsScriptUrl, APP_CONFIG.requestTimeoutMs);
let questions = [];
let answeredQuestionIds = [];
let currentIndex = 0;
let questionStartedAt = new Date();
let submitted = false;

async function init() {
  updatePendingCount();
  try {
    const response = await fetch("data/questions.json");
    if (!response.ok) throw new Error(`题库加载失败（HTTP ${response.status}）`);
    questions = await response.json();
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("题库为空");
    answeredQuestionIds = mergeAnsweredQuestionIds(
      progressStore.getAnsweredQuestionIds(),
      queue.getAll().map((operation) => operation.answerRecord?.questionId)
    );
    progressStore.save(answeredQuestionIds);
    updateProgressSummary();

    const progress = await loadAnsweredProgress(
      answeredQuestionIds,
      () => syncClient.getProgress()
    );
    answeredQuestionIds = progress.answeredQuestionIds;
    if (progress.source === "remote") {
      progressStore.save(answeredQuestionIds);
      elements.progressStatus.textContent = "学习进度已同步";
    } else {
      elements.progressStatus.textContent = "使用本地进度继续学习";
      elements.progressStatus.title = progress.error?.message || "";
    }

    updateProgressSummary();
    currentIndex = findFirstUnansweredIndex(questions, answeredQuestionIds);
    if (currentIndex === -1) renderCompletion();
    else renderQuestion();
  } catch (error) {
    showAppError(`${error.message}。请通过本地 HTTP 服务器打开本项目。`);
    elements.submitButton.disabled = true;
  }
}

function renderQuestion() {
  const question = questions[currentIndex];
  submitted = false;
  questionStartedAt = new Date();
  elements.form.classList.remove("hidden");
  elements.form.reset();
  elements.questionNumber.textContent = `第 ${currentIndex + 1} / ${questions.length} 题`;
  elements.questionType.textContent = question.typeLabel || question.type;
  elements.questionHeading.textContent = question.prompt;
  elements.choices.innerHTML = Object.entries(question.choices)
    .map(([key, value]) => `
      <label class="choice">
        <input type="radio" name="answer" value="${key}" />
        <span class="choice-key">${key}</span>
        <span>${escapeHtml(value)}</span>
      </label>`)
    .join("");
  enableAnswerInputs();
  elements.submitButton.disabled = false;
  elements.submitButton.classList.remove("hidden");
  elements.nextButton.classList.add("hidden");
  elements.feedback.className = "feedback hidden";
  elements.promptSection.classList.add("hidden");
  elements.copyStatus.textContent = "";
  elements.syncStatus.textContent = "尚未提交答案";
  elements.syncDetail.textContent = "";
}

function renderCompletion() {
  submitted = true;
  elements.questionNumber.textContent = `${questions.length} / ${questions.length}`;
  elements.questionType.textContent = "完成";
  elements.questionHeading.textContent = COMPLETION_MESSAGE;
  elements.form.classList.add("hidden");
  elements.feedback.className = "feedback hidden";
  elements.promptSection.classList.add("hidden");
  elements.syncStatus.textContent = "全部题目均已有作答记录";
  elements.syncDetail.textContent = "未来可在复习模式中重新练习，当前不会重复出题。";
}

async function handleSubmit(event) {
  event.preventDefault();
  if (submitted) return;

  const formData = new FormData(elements.form);
  const userAnswer = formData.get("answer");
  const confidence = formData.get("confidence");
  if (!userAnswer || !confidence) {
    elements.syncStatus.textContent = "请先选择答案和确定度";
    elements.syncDetail.textContent = "两项都是生成学习记录的必要信息。";
    return;
  }

  submitted = true;
  elements.submitButton.disabled = true;
  disableAnswerInputs();
  const question = questions[currentIndex];
  const operation = createSubmission(question, userAnswer, confidence, questionStartedAt);

  showFeedback(question, operation.answerRecord);
  showPrompt(buildChatGptPrompt({ question, answerRecord: operation.answerRecord }));

  try {
    // 写前日志：远端请求开始前，记录已经安全进入本地队列。
    queue.add(operation);
    answeredQuestionIds = progressStore.add(question.questionId);
    updatePendingCount();
    updateProgressSummary();
  } catch (error) {
    submitted = false;
    elements.submitButton.disabled = false;
    enableAnswerInputs();
    elements.syncStatus.textContent = "⚠️ 无法保存本地待同步队列";
    elements.syncDetail.textContent = `${error.message}。为避免丢失，本次不会发送远端请求。`;
    return;
  }

  elements.syncStatus.textContent = "正在同步…";
  elements.syncDetail.textContent = `记录ID：${operation.answerRecord.recordId}`;

  try {
    const result = await syncClient.submit(operation);
    queue.remove(operation.operationId);
    updatePendingCount();
    elements.syncStatus.textContent = "✅ 已更新完成";
    elements.syncDetail.textContent = formatSyncResult(result);
  } catch (error) {
    elements.syncStatus.textContent = "⚠️ 同步失败，已保存到本地待同步队列";
    elements.syncDetail.textContent = error.message;
  } finally {
    elements.nextButton.textContent = findFirstUnansweredIndex(questions, answeredQuestionIds, currentIndex + 1) === -1
      ? "查看完成状态"
      : "下一题";
    elements.nextButton.classList.remove("hidden");
  }
}

function showFeedback(question, answerRecord) {
  elements.feedback.className = `feedback ${answerRecord.isCorrect ? "correct" : "incorrect"}`;
  elements.feedbackTitle.textContent = answerRecord.isCorrect ? "回答正确" : "回答错误";
  elements.correctAnswer.textContent = `正确答案：${question.correctAnswer}. ${question.choices[question.correctAnswer]}`;
  elements.explanation.textContent = `解析：${question.explanation}`;
}

function showPrompt(prompt) {
  elements.prompt.value = prompt;
  elements.promptSection.classList.remove("hidden");
}

function formatSyncResult(result) {
  const answerStatus = result.results?.answerRecord?.status || "unknown";
  const weakStatus = result.results?.weakPoint?.status || "unknown";
  return `记录ID：${result.recordId} · 答题记录：${answerStatus} · 弱点记录：${weakStatus}`;
}

function updatePendingCount() {
  elements.pendingCount.textContent = `待同步：${queue.getAll().length} 条`;
}

function updateProgressSummary() {
  const counts = getProgressCounts(questions, answeredQuestionIds);
  elements.totalCount.textContent = String(counts.total);
  elements.completedCount.textContent = String(counts.completed);
  elements.remainingCount.textContent = String(counts.remaining);
}

function disableAnswerInputs() {
  elements.form.querySelectorAll("input").forEach((input) => { input.disabled = true; });
}

function enableAnswerInputs() {
  elements.form.querySelectorAll("input").forEach((input) => { input.disabled = false; });
}

function showAppError(message) {
  elements.appMessage.textContent = message;
  elements.appMessage.classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.form.addEventListener("submit", handleSubmit);
elements.nextButton.addEventListener("click", () => {
  currentIndex = findFirstUnansweredIndex(questions, answeredQuestionIds, currentIndex + 1);
  if (currentIndex === -1) renderCompletion();
  else renderQuestion();
});
elements.copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.prompt.value);
    elements.copyStatus.textContent = "已复制，可以粘贴到 ChatGPT Project。";
  } catch {
    elements.prompt.select();
    elements.copyStatus.textContent = "自动复制失败，文本已选中，请手动复制。";
  }
});

init();
