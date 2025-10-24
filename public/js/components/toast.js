export default function showMessage(arg1 = 'info', arg2 = '', arg3 = 4000, arg4 = {}) {
  // Backward compatibility: support both object and positional signatures
  // Positional: showMessage(type, message, durationMs, options)
  // Object: showMessage({ title, message, type, durationMs, options })
  let type = 'info';
  let message = '';
  let durationMs = 4000;
  let title = 'Notice';
  let options = {};

  if (typeof arg1 === 'object' && arg1 !== null) {
    ({ type = 'info', message = '', durationMs = 4000, title = 'Notice', options = {} } = arg1);
  } else {
    type = arg1 ?? 'info';
    message = arg2 ?? '';
    durationMs = typeof arg3 === 'number' ? arg3 : 4000;
    options = typeof arg4 === 'object' ? arg4 : {};
  }

  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Add clickable class if link is provided
  if (options.link) {
    toast.classList.add('toast-clickable');
  }

  // Get appropriate icon for type
  const getIcon = (type) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'urgent': return '🚨';
      case 'info': 
      default: return 'ℹ';
    }
  };

  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">${getIcon(type)}</div>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
        ${options.metadata ? `<div class="toast-metadata">${formatMetadata(options.metadata)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close">×</button>
    </div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Show animation
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  const close = () => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  };

  // Close button
  toast.querySelector('.toast-close')?.addEventListener('click', close);
  
  // Click to navigate (if link provided)
  if (options.link) {
    toast.addEventListener('click', (e) => {
      if (!e.target.classList.contains('toast-close')) {
        close();
        window.location.href = options.link;
      }
    });
  }

  // Auto close
  setTimeout(close, durationMs);

  // Progress bar animation
  const progressBar = toast.querySelector('.toast-progress');
  if (progressBar) {
    progressBar.style.animationDuration = `${durationMs}ms`;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format metadata for display
function formatMetadata(metadata) {
  if (typeof metadata === 'object') {
    return Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
  return String(metadata);
}


