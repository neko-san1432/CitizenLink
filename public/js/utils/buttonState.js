// Simple button state helper for consistent UX across forms
export function setButtonLoading(button, loadingText = 'Please wait...') {
  if (!button) return () => {};
  const original = {
    html: button.innerHTML,
    text: button.textContent,
    disabled: button.disabled,
  };
  button.disabled = true;
  // Prefer textContent to avoid SVG churn unless button has rich content
  if (button.querySelector('svg')) {
    button.innerHTML = `<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(0,0,0,.2);border-top-color:currentColor;border-radius:50%;vertical-align:-2px;margin-right:8px;animation:spin 0.8s linear infinite"></span>${loadingText}`;
  } else {
    button.textContent = loadingText;
  }
  return function reset() {
    button.disabled = original.disabled;
    // Restore innerHTML when it had SVG/content, otherwise text
    if (original.html && original.html !== original.text) {
      button.innerHTML = original.html;
    } else {
      button.textContent = original.text;
    }
  };
}

export function temporarilyMark(button, text, className, durationMs = 1200) {
  if (!button) return () => {};
  const original = {
    className: button.className,
    html: button.innerHTML,
    text: button.textContent,
  };
  if (text) {
    button.textContent = text;
  }
  if (className) {
    button.classList.add(className);
  }
  const timer = setTimeout(() => {
    button.className = original.className;
    if (original.html && original.html !== original.text) {
      button.innerHTML = original.html;
    } else {
      button.textContent = original.text;
    }
  }, durationMs);
  return () => {
    clearTimeout(timer);
    button.className = original.className;
    if (original.html && original.html !== original.text) {
      button.innerHTML = original.html;
    } else {
      button.textContent = original.text;
    }
  };
}

// Optional: keyframes if not already present
try {
  const id = 'btn-spinner-style';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }
} catch {}


