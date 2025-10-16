export default function showMessage(arg1 = 'info', arg2 = '', arg3 = 4000) {
  // Backward compatibility: support both object and positional signatures
  // Positional: showMessage(type, message, durationMs)
  // Object: showMessage({ title, message, type, durationMs })
  let type = 'info';
  let message = '';
  let durationMs = 4000;
  let title = 'Notice';

  if (typeof arg1 === 'object' && arg1 !== null) {
    ({ type = 'info', message = '', durationMs = 4000, title = 'Notice' } = arg1);
  } else {
    type = arg1 ?? 'info';
    message = arg2 ?? '';
    durationMs = typeof arg3 === 'number' ? arg3 : 4000;
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

  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">❯</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
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

  toast.querySelector('.toast-close')?.addEventListener('click', close);
  setTimeout(close, durationMs);
}


