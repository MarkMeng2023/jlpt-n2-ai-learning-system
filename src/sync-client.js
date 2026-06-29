export class SyncClient {
  constructor(url, timeoutMs) {
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  async submit(operation) {
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
        body: JSON.stringify({ action: "submitAnswer", ...operation }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`同步请求失败（HTTP ${response.status}）`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || "服务端未完成同步");
      }
      if (result.operationId !== operation.operationId || result.recordId !== operation.answerRecord.recordId) {
        throw new Error("服务端确认信息与本地记录不一致");
      }
      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("同步超时，请稍后重试");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
