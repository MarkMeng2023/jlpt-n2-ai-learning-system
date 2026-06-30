import { APP_CONFIG } from "./config.js";
import { buildChatGptPrompt } from "./prompt-builder.js";
import { createSubmission } from "./records.js";
import { ProgressStore, mergeAnsweredQuestionIds } from "./progress.js";
import { loadQuestionBank } from "./question-bank.js";
import { loadProjectStatusData } from "./project-status.js";
import {
  KNOWLEDGE_STATUS,
  buildKnowledgeProfiles,
  buildLearningProfile,
  buildMistakeQuestionIds,
  buildReviewQueue,
  shuffleQuestions
} from "./review-engine.js";
import { SyncClient } from "./sync-client.js";
import { SyncQueue } from "./sync-queue.js";

const elements = Object.fromEntries([
  "app-message", "home-view", "study-view", "new-question-count", "today-review-count",
  "mistake-count", "mastered-count", "learning-count", "review-count", "continue-count",
  "progress-status", "queue-point-count", "review-queue", "knowledge-status-detail",
  "home-button", "answer-form", "choices", "question-number", "question-type", "question-heading",
  "submit-button", "next-button", "feedback", "feedback-title", "correct-answer", "explanation",
  "sync-status", "sync-detail", "pending-count", "prompt-section", "chatgpt-prompt",
  "copy-button", "copy-status"
  , "project-eyebrow", "project-status-sprint", "project-version", "project-question-count",
  "project-knowledge-count", "project-coverage", "project-question-target", "project-last-updated"
].map((id) => [id.replaceAll("-", "_"), document.querySelector(`#${id}`)]));

const queue = new SyncQueue(APP_CONFIG.queueStorageKey);
const progressStore = new ProgressStore(APP_CONFIG.progressStorageKey);
const syncClient = new SyncClient(APP_CONFIG.appsScriptUrl, APP_CONFIG.requestTimeoutMs);
const modeNames = { continue: "继续学习", review: "今日复习", mistakes: "错题重做", random: "随机练习" };
const questionTypeNames = {
  vocabulary_collocation: "词汇・固定搭配",
  adverb: "词汇・副词",
  synonym: "词汇・近义词",
  grammar_choice: "文法・选择",
  grammar_meaning: "文法・句意",
  short_reading: "阅读・短篇"
};

let questions = [];
let answerRecords = [];
let answeredQuestionIds = [];
let reviewGroups = [];
let mistakeQuestionIds = [];
let activeQuestions = [];
let activePosition = 0;
let activeMode = "continue";
let questionStartedAt = new Date();
let submitted = false;

function mergeRecords(...collections) {
  const merged = new Map();
  collections.flat().filter(Boolean).forEach((record) => {
    const key = record.recordId || `${record.questionId}:${record.answeredAt}`;
    merged.set(key, record);
  });
  return [...merged.values()];
}

async function init() {
  updatePendingCount();
  try {
    const bank = await loadQuestionBank();
    questions = bank.questions;
    const projectStatus = await loadProjectStatusData(questions, bank.knowledgePoints, undefined, bank.grammarPoints);
    renderProjectStatus(projectStatus);

    const pendingRecords = queue.getAll().map((operation) => operation.answerRecord).filter(Boolean);
    answerRecords = pendingRecords;
    answeredQuestionIds = mergeAnsweredQuestionIds(
      progressStore.getAnsweredQuestionIds(),
      pendingRecords.map((record) => record.questionId)
    );

    try {
      const reviewData = await syncClient.getReviewData();
      answerRecords = mergeRecords(reviewData.answerRecords, pendingRecords);
      answeredQuestionIds = mergeAnsweredQuestionIds(
        answeredQuestionIds,
        answerRecords.map((record) => record.questionId)
      );
      elements.progress_status.textContent = "今日计划已根据 Google Sheets 最新记录生成";
    } catch (error) {
      elements.progress_status.textContent = "暂时使用本地记录生成计划";
      elements.progress_status.title = error.message;
    }
    progressStore.save(answeredQuestionIds);
    refreshEngine();
    persistLearningProfile();
  } catch (error) {
    showAppError(`${error.message}。请通过本地 HTTP 服务器打开本项目。`);
    document.querySelectorAll(".mode-card").forEach((button) => { button.disabled = true; });
  }
}

function renderProjectStatus(status) {
  elements.project_eyebrow.textContent = `JLPT N2 · ${status.sprint}`;
  elements.project_status_sprint.textContent = status.sprint;
  elements.project_version.textContent = status.version;
  elements.project_question_count.textContent = `${status.questionCount} Questions`;
  elements.project_knowledge_count.textContent = String(status.knowledgePointCount);
  elements.project_coverage.textContent = `${status.coverage.toFixed(2)}%`;
  elements.project_question_target.textContent = `${status.questionCount} / ${status.questionTarget}`;
  elements.project_last_updated.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(status.lastUpdated));
}

function refreshEngine() {
  reviewGroups = buildReviewQueue(questions, answerRecords);
  mistakeQuestionIds = buildMistakeQuestionIds(answerRecords, questions.map((question) => question.questionId));
  renderHome();
}

function renderHome() {
  const profiles = buildKnowledgeProfiles(questions, answerRecords);
  const reviewQuestionIds = reviewGroups.flatMap((group) => group.questionIds);
  const profile = buildLearningProfile(questions, answerRecords, reviewQuestionIds.length);
  const unanswered = questions.filter((question) => !answeredQuestionIds.includes(question.questionId));

  elements.new_question_count.textContent = String(unanswered.length);
  elements.today_review_count.textContent = String(reviewQuestionIds.length);
  elements.mistake_count.textContent = String(mistakeQuestionIds.length);
  elements.mastered_count.textContent = String(profile.masteredCount);
  elements.learning_count.textContent = String(profile.learningCount);
  elements.review_count.textContent = String(profile.reviewCount);
  elements.continue_count.textContent = String(unanswered.length);
  elements.queue_point_count.textContent = `${reviewGroups.length} 个知识点`;
  renderReviewQueue();

  const mastered = profiles.filter((point) => point.status === KNOWLEDGE_STATUS.MASTERED)
    .map((point) => point.knowledgePointTitle);
  const needsReview = profiles.filter((point) => point.status === KNOWLEDGE_STATUS.REVIEW)
    .map((point) => point.knowledgePointTitle);
  const learning = profiles.filter((point) => point.status === KNOWLEDGE_STATUS.LEARNING)
    .map((point) => point.knowledgePointTitle);
  elements.knowledge_status_detail.textContent = [
    `已掌握：${formatNames(mastered)}`,
    `待巩固（有遗忘风险）：${formatNames(needsReview)}`,
    `学习中：${formatNames(learning)}`
  ].join("　·　");
}

function formatNames(names) {
  if (names.length === 0) return "暂无";
  return names.length > 4 ? `${names.slice(0, 4).join("、")} 等 ${names.length} 个` : names.join("、");
}

function renderReviewQueue() {
  elements.review_queue.replaceChildren();
  if (reviewGroups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-queue";
    empty.textContent = answerRecords.length === 0 ? "完成几道新题后，这里会自动生成复习队列。" : "今天没有需要优先复习的知识点。";
    elements.review_queue.append(empty);
    return;
  }
  reviewGroups.forEach((group) => {
    const wrapper = document.createElement("article");
    wrapper.className = "queue-group";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    const status = document.createElement("span");
    const questionsLine = document.createElement("p");
    title.textContent = `${group.knowledgePointId} · ${group.knowledgePointTitle}`;
    status.className = "status-pill";
    status.textContent = `${group.status} · 弱点分 ${group.weaknessScore}`;
    questionsLine.textContent = group.questionIds.join("  →  ");
    header.append(title, status);
    wrapper.append(header, questionsLine);
    elements.review_queue.append(wrapper);
  });
}

function startMode(mode) {
  activeMode = mode;
  const byId = new Map(questions.map((question) => [question.questionId, question]));
  if (mode === "continue") {
    activeQuestions = questions.filter((question) => !answeredQuestionIds.includes(question.questionId));
  } else if (mode === "review") {
    activeQuestions = reviewGroups.flatMap((group) => group.questionIds).map((id) => byId.get(id)).filter(Boolean);
  } else if (mode === "mistakes") {
    activeQuestions = mistakeQuestionIds.map((id) => byId.get(id)).filter(Boolean);
  } else {
    activeQuestions = shuffleQuestions(questions);
  }
  activePosition = 0;
  elements.home_view.classList.add("hidden");
  elements.study_view.classList.remove("hidden");
  if (activeQuestions.length === 0) renderSessionCompletion(true);
  else renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  const question = activeQuestions[activePosition];
  submitted = false;
  questionStartedAt = new Date();
  elements.answer_form.classList.remove("hidden");
  elements.answer_form.reset();
  elements.question_number.textContent = `${modeNames[activeMode]} · 第 ${activePosition + 1} / ${activeQuestions.length} 题`;
  elements.question_type.textContent = questionTypeNames[question.type] || question.type;
  elements.question_heading.textContent = question.prompt;
  elements.choices.innerHTML = Object.entries(question.choices).map(([key, value]) => `
    <label class="choice"><input type="radio" name="answer" value="${key}" />
      <span class="choice-key">${key}</span><span>${escapeHtml(value)}</span></label>`).join("");
  setAnswerInputsDisabled(false);
  elements.submit_button.disabled = false;
  elements.submit_button.classList.remove("hidden");
  elements.next_button.classList.add("hidden");
  elements.feedback.className = "feedback hidden";
  elements.prompt_section.classList.add("hidden");
  elements.copy_status.textContent = "";
  elements.sync_status.textContent = "尚未提交答案";
  elements.sync_detail.textContent = "";
}

function renderSessionCompletion(empty = false) {
  submitted = true;
  elements.question_number.textContent = modeNames[activeMode];
  elements.question_type.textContent = "完成";
  elements.question_heading.textContent = empty ? "当前没有可练习的题目" : `${modeNames[activeMode]}已完成`;
  elements.answer_form.classList.add("hidden");
  elements.feedback.className = "feedback hidden";
  elements.prompt_section.classList.add("hidden");
  elements.sync_status.textContent = empty ? "可以返回今日计划选择其他模式" : "本轮记录已保存";
  elements.sync_detail.textContent = "";
}

async function handleSubmit(event) {
  event.preventDefault();
  if (submitted) return;
  const formData = new FormData(elements.answer_form);
  const userAnswer = formData.get("answer");
  const confidence = formData.get("confidence");
  if (!userAnswer || !confidence) {
    elements.sync_status.textContent = "请先选择答案和确定度";
    elements.sync_detail.textContent = "两项都是生成学习记录的必要信息。";
    return;
  }

  submitted = true;
  elements.submit_button.disabled = true;
  setAnswerInputsDisabled(true);
  const question = activeQuestions[activePosition];
  const operation = createSubmission(question, userAnswer, confidence, questionStartedAt);
  showFeedback(question, operation.answerRecord);
  showPrompt(buildChatGptPrompt({ question, answerRecord: operation.answerRecord }));

  try {
    queue.add(operation);
    answerRecords = mergeRecords(answerRecords, [operation.answerRecord]);
    answeredQuestionIds = progressStore.add(question.questionId);
    updatePendingCount();
    refreshEngine();
  } catch (error) {
    submitted = false;
    elements.submit_button.disabled = false;
    setAnswerInputsDisabled(false);
    elements.sync_status.textContent = "⚠️ 无法保存本地待同步队列";
    elements.sync_detail.textContent = `${error.message}。为避免丢失，本次不会发送远端请求。`;
    return;
  }

  elements.sync_status.textContent = "正在同步…";
  elements.sync_detail.textContent = `记录ID：${operation.answerRecord.recordId}`;
  try {
    const result = await syncClient.submit(operation);
    queue.remove(operation.operationId);
    updatePendingCount();
    elements.sync_status.textContent = "✅ 已更新完成";
    elements.sync_detail.textContent = formatSyncResult(result);
    persistLearningProfile();
  } catch (error) {
    elements.sync_status.textContent = "⚠️ 同步失败，已保存到本地待同步队列";
    elements.sync_detail.textContent = error.message;
  } finally {
    elements.next_button.textContent = activePosition + 1 >= activeQuestions.length ? "完成本轮" : "下一题";
    elements.next_button.classList.remove("hidden");
  }
}

function persistLearningProfile() {
  const reviewCount = reviewGroups.reduce((sum, group) => sum + group.questionIds.length, 0);
  const profile = buildLearningProfile(questions, answerRecords, reviewCount);
  syncClient.saveLearningProfile(profile).catch(() => {});
}

function showFeedback(question, answerRecord) {
  elements.feedback.className = `feedback ${answerRecord.isCorrect ? "correct" : "incorrect"}`;
  elements.feedback_title.textContent = answerRecord.isCorrect ? "回答正确" : "回答错误";
  elements.correct_answer.textContent = `正确答案：${question.correctAnswer}. ${question.choices[question.correctAnswer]}`;
  elements.explanation.textContent = `解析：${question.explanation}`;
}

function showPrompt(prompt) {
  elements.chatgpt_prompt.value = prompt;
  elements.prompt_section.classList.remove("hidden");
}

function formatSyncResult(result) {
  return `记录ID：${result.recordId} · 答题记录：${result.results?.answerRecord?.status || "unknown"} · 弱点记录：${result.results?.weakPoint?.status || "unknown"}`;
}

function updatePendingCount() {
  elements.pending_count.textContent = `待同步：${queue.getAll().length} 条`;
}

function setAnswerInputsDisabled(disabled) {
  elements.answer_form.querySelectorAll("input").forEach((input) => { input.disabled = disabled; });
}

function showAppError(message) {
  elements.app_message.textContent = message;
  elements.app_message.classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

document.querySelectorAll(".mode-card").forEach((button) => {
  button.addEventListener("click", () => startMode(button.dataset.mode));
});
elements.answer_form.addEventListener("submit", handleSubmit);
elements.next_button.addEventListener("click", () => {
  activePosition += 1;
  if (activePosition >= activeQuestions.length) renderSessionCompletion();
  else renderQuestion();
});
elements.home_button.addEventListener("click", () => {
  elements.study_view.classList.add("hidden");
  elements.home_view.classList.remove("hidden");
  refreshEngine();
});
elements.copy_button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.chatgpt_prompt.value);
    elements.copy_status.textContent = "已复制，可以粘贴到 ChatGPT Project。";
  } catch {
    elements.chatgpt_prompt.select();
    elements.copy_status.textContent = "自动复制失败，文本已选中，请手动复制。";
  }
});

init();
