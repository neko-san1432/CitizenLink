const cryptoSource = typeof window !== "undefined" && window.crypto
  ? window.crypto
  : (typeof globalThis !== "undefined" ? globalThis.crypto : null);

class ToastManager {

  constructor(config = {}) {
    this.defaults = {
      maxVisible: 4,
      durationMs: 4000,
      type: "info",
      title: "Notice",
      position: "top-right"
    };
    this.config = { ...this.defaults, ...config };
    this.container = null;
    this.activeToasts = new Map();
    this.queue = [];
    this._boot();
  }

  configure(partialConfig = {}) {
    this.config = { ...this.config, ...partialConfig };
    if (partialConfig.position && this.container) {
      this.container.dataset.position = partialConfig.position;
    }
  }

  show(arg1 = "info", arg2 = "", arg3 = this.config.durationMs, arg4 = {}) {
    const payload = this._normalizeArgs(arg1, arg2, arg3, arg4);
    if (this.activeToasts.size >= this.config.maxVisible) {
      this.queue.push(payload);
      return payload.id;
    }
    this._render(payload);
    return payload.id;
  }

  success(message, options = {}) {
    return this.show({ ...options, type: "success", message });
  }

  error(message, options = {}) {
    return this.show({ ...options, type: "error", message });
  }

  warning(message, options = {}) {
    return this.show({ ...options, type: "warning", message });
  }

  info(message, options = {}) {
    return this.show({ ...options, type: "info", message });
  }

  clear() {
    this.activeToasts.forEach((_, toastId) => this.dismiss(toastId, { silent: true }));
    this.queue = [];
  }

  dismiss(toastId, { silent = false } = {}) {
    const entry = this.activeToasts.get(toastId);
    if (!entry) return;
    clearTimeout(entry.timeoutId);
    const { element } = entry;
    element.classList.remove("toast-show");
    element.classList.add("toast-hide");
    const remove = () => {
      element.removeEventListener("animationend", remove);
      element.remove();
      this.activeToasts.delete(toastId);
      this._flushQueue();
    };
    element.addEventListener("animationend", remove, { once: true });
    if (!silent && typeof entry.onDismiss === "function") {
      entry.onDismiss();
    }
  }

  subscribeToEvents(eventName = "citizenlink:toast") {
    window.addEventListener(eventName, (event) => {
      if (event?.detail) {
        this.show(event.detail);
      }
    });
  }

  _boot() {
    this.container = document.querySelector("#toast-container");
    if (!this.container) {
      this.container = document.createElement("section");
      this.container.id = "toast-container";
      this.container.className = "toast-container";
      this.container.setAttribute("aria-live", "polite");
      this.container.setAttribute("role", "region");
      document.body.appendChild(this.container);
    }
    this.container.dataset.position = this.config.position;
    this.subscribeToEvents();
  }

  _normalizeArgs(arg1, arg2, arg3, arg4) {
    if (typeof arg1 === "object" && arg1 !== null) {
      return this._buildPayload(arg1);
    }
    const legacyPayload = {
      type: arg1 ?? this.config.type,
      message: arg2 ?? "",
      durationMs: typeof arg3 === "number" ? arg3 : this.config.durationMs,
      options: typeof arg4 === "object" && arg4 !== null ? arg4 : {}
    };
    return this._buildPayload(legacyPayload);
  }

  _buildPayload({
    id = cryptoSource?.randomUUID ? cryptoSource.randomUUID() : `${Date.now()}-${Math.random()}`,
    title = this.config.title,
    message = "",
    type = this.config.type,
    durationMs = this.config.durationMs,
    options = {}
  }) {
    return { id, title, message, type, durationMs, options };
  }

  _render({ id, title, message, type, durationMs, options }) {
    const toast = document.createElement("article");
    toast.className = `toast toast-${type}`;
    toast.dataset.toastId = id;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    if (options.link) {
      toast.classList.add("toast-clickable");
    }
    const iconMarkup = `<div class="toast-icon">${this._iconFor(type)}</div>`;
    const metadataMarkup = options.metadata
      ? `<div class="toast-metadata">${formatMetadata(options.metadata)}</div>`
      : "";
    toast.innerHTML = `
      <div class="toast-content">
        ${iconMarkup}
        <div class="toast-body">
          <p class="toast-title">${escapeHtml(title)}</p>
          <p class="toast-message">${escapeHtml(message)}</p>
          ${metadataMarkup}
        </div>
        <button class="toast-close" aria-label="Close notification">×</button>
      </div>
      <div class="toast-progress"></div>
    `;
    this.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("toast-show"));
    const timeoutId = window.setTimeout(() => this.dismiss(id), durationMs);
    const entry = { element: toast, timeoutId, onDismiss: options.onDismiss };
    this.activeToasts.set(id, entry);

    toast.querySelector(".toast-close")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.dismiss(id);
    });

    if (options.link) {
      toast.addEventListener("click", (event) => {
        if (event.target.closest(".toast-close")) return;
        this.dismiss(id);
        window.location.href = options.link;
      });
    }

    const progress = toast.querySelector(".toast-progress");
    if (progress) {
      progress.style.animationDuration = `${durationMs}ms`;
    }
  }

  _flushQueue() {
    if (this.queue.length === 0) {
      return;
    }
    if (this.activeToasts.size >= this.config.maxVisible) {
      return;
    }
    const nextToast = this.queue.shift();
    if (nextToast) {
      this._render(nextToast);
    }
  }

  _iconFor(type) {
    switch (type) {
      case "success": return "✓";
      case "error": return "✕";
      case "warning": return "⚠";
      case "urgent": return "🚨";
      case "info":
      default: return "ℹ";
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function formatMetadata(metadata) {
  if (metadata == null) return "";
  if (typeof metadata === "object") {
    return Object.entries(metadata)
      .map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(String(value ?? ""))}`)
      .join(", ");
  }
  return escapeHtml(String(metadata));
}

const toastManager = new ToastManager();

export function getToastManager() {
  return toastManager;
}

export function showMessage(...args) {
  return toastManager.show(...args);
}

export const Toast = {
  success: (message, options = {}) => toastManager.success(message, options),
  error: (message, options = {}) => toastManager.error(message, options),
  warning: (message, options = {}) => toastManager.warning(message, options),
  info: (message, options = {}) => toastManager.info(message, options),
  message: (message, options = {}) => toastManager.show({ ...options, type: "message", message }),
  clear: () => toastManager.clear(),
  dismiss: (toastId) => toastManager.dismiss(toastId)
};

export { ToastManager };

export default showMessage;
