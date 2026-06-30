export class SyncClient {
  constructor(url, timeoutMs) {
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  async submit(operation) {
    const result = await this.#post({ action: "submitAnswer", ...operation }, "同步");
    if (result.operationId !== operation.operationId || result.recordId !== operation.answerRecord.recordId) {
      throw new Error("服务端确认信息与本地记录不一致");
    }
    return result;
  }

  async getProgress() {
    const result = await this.#post({ action: "getProgress" }, "读取进度");
    if (!Array.isArray(result.answeredQuestionIds)) {
      throw new Error("服务端返回的学习进度格式无效");
    }
    return result;
  }

  async getLearningStats() {
    const result = await this.#post({ action: "getLearningStats" }, "读取学习统计");
    if (!Number.isFinite(result.totalAnswered)
      || !Number.isFinite(result.accuracy)
      || !Array.isArray(result.byQuestionType)
      || !Array.isArray(result.byKnowledgePoint)) {
      throw new Error("服务端返回的学习统计格式无效");
    }
    return result;
  }

  async getReviewData() {
    const result = await this.#post({ action: "getReviewData" }, "读取复习记录");
    if (!Array.isArray(result.answerRecords)) {
      throw new Error("服务端返回的复习记录格式无效");
    }
    return result;
  }

  async saveLearningProfile(profile) {
    return this.#post({ action: "saveLearningProfile", profile }, "更新学习档案");
  }

  async #post(payload, requestLabel) {
    if (!this.url) {
      throw new Error("尚未配置 Apps Script Web App URL");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // text/plain 可避免 Apps Script Web App 的跨域预检请求。
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`${requestLabel}请求失败（HTTP ${response.status}）`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || `服务端未完成${requestLabel}`);
      }
      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`${requestLabel}超时，请稍后重试`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
