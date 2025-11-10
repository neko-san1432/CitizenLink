// DOM helpers

export function updateStatCard(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = value;
  element.classList.add('loaded');
}

