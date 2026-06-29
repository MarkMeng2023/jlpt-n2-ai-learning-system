export class SyncQueue {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  getAll() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  add(operation) {
    const queue = this.getAll();
    if (!queue.some((item) => item.operationId === operation.operationId)) {
      queue.push(operation);
      this.#save(queue);
    }
  }

  remove(operationId) {
    this.#save(this.getAll().filter((item) => item.operationId !== operationId));
  }

  #save(queue) {
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
  }
}
