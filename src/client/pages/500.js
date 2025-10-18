document.addEventListener('DOMContentLoaded', () => {
  const tryAgainButton = document.getElementById('try-again');
  if (tryAgainButton) {
    tryAgainButton.addEventListener('click', () => {
      location.reload();
    });
  }
});

