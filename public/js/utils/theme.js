import skeletonLoader from "./skeletonLoader.js";

/**
 * ThemeManager
 * Handles global theme state (light, dark).
 * Persists preference to localStorage.
 */
class ThemeManager {
  constructor() {
    this.storageKey = "theme-preference";
    this.init();
  }

  init() {
    // expose to window for debugging
    window.themeManager = this;

    // Apply initial theme
    this.applyTheme(this.getStoredTheme());

    // Watch for external changes to classList for robustness
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          const isDark = document.documentElement.classList.contains("dark");
          const expected = this.getStoredTheme() === "dark";
          if (isDark !== expected) {
            // Re-apply if mismatch detected
            this.applyTheme(this.getStoredTheme());
          }
        }
      });
    });

    this.observer.observe(document.documentElement, { attributes: true });
  }

  getStoredTheme() {
    // Default to 'light' if nothing stored
    return localStorage.getItem(this.storageKey) || "light";
  }

  setTheme(theme) {
    if (theme !== "dark" && theme !== "light") {
      console.warn("[ThemeManager] Invalid theme:", theme);
      return;
    }
    localStorage.setItem(this.storageKey, theme);
    this.applyTheme(theme);
    this.dispatchChangeEvent(theme);
  }

  toggle() {
    const current = this.getStoredTheme();
    const newTheme = current === "dark" ? "light" : "dark";
    this.setTheme(newTheme);
    return newTheme;
  }

  applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  dispatchChangeEvent(theme) {
    window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme } }));
  }
}

// Initialize immediately
const themeManager = new ThemeManager();
export default themeManager;
