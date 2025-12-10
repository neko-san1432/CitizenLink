import showMessage from '../components/toast.js';

// Lightweight progressive signup step manager
const BARANGAY_LIST = [
  'Aplaya',
  'Balabag',
  'Binaton',
  'Cogon',
  'Colorado',
  'Dawis',
  'Dulangan',
  'Goma',
  'Igpit',
  'Kiagot',
  'Lungag',
  'Mahayahay',
  'Matti',
  'Kapatagan (Rizal)',
  'Ruparan',
  'San Agustin',
  'San Jose (Balutakay)',
  'San Miguel (Odaca)',
  'San Roque',
  'Sinawilan',
  'Soong',
  'Tiguman',
  'Tres de Mayo',
  'Zone 1 (Pob.)',
  'Zone 2 (Pob.)',
  'Zone 3 (Pob.)'
];

const initBarangaySelect = () => {
  const select = document.getElementById('barangay');
  if (!select || select.dataset.populated === 'true') return;

  const currentValue = select.value;
  select.innerHTML = '<option value="" selected>Select barangay</option>';
  BARANGAY_LIST.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  if (currentValue) {
    const match = BARANGAY_LIST.find(b => b.toLowerCase() === currentValue.toLowerCase());
    if (match) {
      select.value = match;
    }
  }
  select.dataset.populated = 'true';
};

document.addEventListener('DOMContentLoaded', initBarangaySelect);

const stepsRoot = document.getElementById('signup-steps');
if (stepsRoot) {
  const steps = Array.from(stepsRoot.querySelectorAll('.signup-step'));
  const nextBtn = document.getElementById('signup-next-btn');
  const prevBtn = document.getElementById('signup-prev-btn');
  const submitBtn = document.getElementById('signup-submit-btn');
  const progressFill = document.getElementById('signup-progress-fill');
  const progressLabel = document.getElementById('signup-progress-label');
  const progressBar = progressFill ? progressFill.parentElement : null;
  let current = 0;

  const STEP_STORAGE_KEY = 'cl_signup_step_index';

  function showStep(index) {
    steps.forEach((s, i) => {
      s.hidden = i !== index;
    });
    current = index;
    // Controls
    prevBtn.hidden = index === 0;
    const isLast = index === steps.length - 1;
    nextBtn.hidden = isLast;
    submitBtn.hidden = !isLast;
    updateProgress();
    // focus first input in step
    const first = steps[index].querySelector('input,select,textarea,button');
    if (first) first.focus();

    // Save current step
    try {
      localStorage.setItem(STEP_STORAGE_KEY, String(current));
    } catch (e) {}
  }

  function updateProgress() {
    const pct = steps.length > 1 ? Math.round((current / (steps.length - 1)) * 100) : 0;
    if (progressFill) progressFill.style.width = `${pct  }%`;
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(pct));
    }
    if (progressLabel) {
      progressLabel.textContent = `Step ${current + 1} of ${steps.length} · ${pct}% complete`;
    }
  }

  function validateCurrentStep() {
    const inputs = Array.from(steps[current].querySelectorAll('input,select,textarea')).filter(i => i.closest('form'));
    for (const el of inputs) {
      // skip disabled or hidden fields
      if (el.disabled || el.hidden) continue;
      if (el.hasAttribute('required')) {
        if (!el.checkValidity()) {
          el.reportValidity && el.reportValidity();
          el.focus();
          return false;
        }
      }
    }

    // Check for ID verification step
    const idPlaceholder = steps[current].querySelector('#id-step-placeholder');
    if (idPlaceholder) {
      const passed = sessionStorage.getItem('cl_verification_passed') === 'true';
      if (!passed) {
        showMessage('error', 'Verification failed. Please ensure your ID matches your profile information before proceeding.');
        return false;
      }
    }

    return true;
  }

  nextBtn && nextBtn.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    showStep(Math.min(current + 1, steps.length - 1));
  });
  prevBtn && prevBtn.addEventListener('click', () => {
    showStep(Math.max(current - 1, 0));
  });

  // keyboard: Enter should move to next only when not on final step
  stepsRoot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
        // prevent form submit on Enter in steps (except final)
        if (current < steps.length - 1) {
          e.preventDefault();
          nextBtn && nextBtn.click();
        }
      }
    }
  });

  // initialize
  let initialStep = 0;
  try {
    const saved = localStorage.getItem(STEP_STORAGE_KEY);
    if (saved !== null) {
      initialStep = parseInt(saved, 10);
      if (isNaN(initialStep) || initialStep < 0 || initialStep >= steps.length) {
        initialStep = 0;
      }
    }
  } catch (e) {}

  // Ensure we don't start on a step that requires previous data if that data is missing?
  // For now, trust the user/persistence.
  showStep(initialStep);

  // Listen for reset event from other scripts
  document.addEventListener('signup-reset', () => {
    showStep(0);
    try { localStorage.removeItem(STEP_STORAGE_KEY); } catch {}
  });
}

export {};
