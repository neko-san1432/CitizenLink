export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      console.warn("LocalStorage full, using sessionStorage");
      try {
        sessionStorage.setItem(key, value);
        return true;
      } catch (e2) {
        console.error("Both storage options failed:", e2);
      }
    }
    return false;
  }
}

export function storageAvailable(type) {
  try {
    // Validate storage type to prevent object injection
    if (type !== "localStorage" && type !== "sessionStorage") {
      return false;
    }
    const storage = window[type];
    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return false;
  }
}
