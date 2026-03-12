/**
 * SkeletonLoader
 * Handles global skeleton loading transitions.
 * Integrated with the premium design system.
 */
class SkeletonLoader {
    constructor() {
        this.loaderId = "global-skeleton-loader";
        this.excludedPaths = [
            "/",
            "/login",
            "/signup",
            "/signup-with-code",
            "/reset-password",
            "/resetpassword",
            "/success",
            "/oauth-callback",
            "/privacy",
            "/terms",
            "/404",
            "/500"
        ];
        this.init();
    }

    init() {
        if (this.shouldShow()) {
            this.injectStyles();
            this.injectHTML();

            // Auto-hide after DOMContentLoaded (base fallback)
            // dashboard components can override this by calling hide() manually
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                    // Slight delay for smoother feel
                    setTimeout(() => this.hide(), 100);
                });
            } else {
                setTimeout(() => this.hide(), 100);
            }
        }
    }

    shouldShow() {
        try {
            const path = (window.location.pathname || "").toLowerCase();
            // Check if path is in excluded list
            if (this.excludedPaths.includes(path)) return false;

            // Check if it's the root (landing page)
            if (path === "/" || path === "" || path.endsWith("index.html")) return false;

            // Check if specifically disabled via URL param (for debugging)
            if (window.location.search.includes("no-skeleton")) return false;

            return true;
        } catch (e) {
            return false;
        }
    }

    injectStyles() {
        // Only inject if not already present
        if (document.querySelector('link[href*="skeleton.css"]')) return;

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/css/components/skeleton.css";
        document.head.appendChild(link);
    }

    injectHTML() {
        if (document.getElementById(this.loaderId)) return;

        const loader = document.createElement("div");
        loader.id = this.loaderId;

        // Premium Skeleton Structure
        loader.innerHTML = `
            <div class="skeleton skeleton-header"></div>
            <div class="skeleton-layout">
                <div class="skeleton skeleton-sidebar"></div>
                <div class="skeleton-main">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton-content-grid">
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                    </div>
                    <div class="skeleton-content-grid">
                        <div class="skeleton" style="height: 300px; grid-column: span 2;"></div>
                        <div class="skeleton" style="height: 300px;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.prepend(loader);
    }

    hide() {
        const loader = document.getElementById(this.loaderId);
        if (loader) {
            loader.classList.add("skeleton-fade-out");
            // Remove from DOM after transition
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }, 600);
        }
    }
}

// Global singleton
const skeletonLoader = new SkeletonLoader();
window.skeletonLoader = skeletonLoader;

export default skeletonLoader;
