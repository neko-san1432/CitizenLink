import { apiClient } from '../../../src/client/config/apiClient.js';
import { showToast } from '../../../src/client/components/toast.js';

function renderForm(type) {
  const container = document.getElementById('publish-form');
  if (!container) return;

  if (type === 'news') {
    container.innerHTML = `
      <form id="news-form" class="form-grid">
        <div class="form-group">
          <label class="form-label" for="news-title">Title</label>
          <input id="news-title" class="input" required placeholder="Title" />
        </div>
        <div class="form-group">
          <label class="form-label" for="news-excerpt">Excerpt</label>
          <input id="news-excerpt" class="input" placeholder="Short summary" />
        </div>
        <div class="form-group">
          <label class="form-label" for="news-content">Content</label>
          <textarea id="news-content" class="textarea" rows="8" required placeholder="Write the content..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="news-category">Category</label>
          <input id="news-category" class="input" placeholder="Category" />
        </div>
        <div class="form-group">
          <button id="news-submit" class="btn btn-primary" type="submit">Publish News</button>
        </div>
      </form>
    `;
  } else if (type === 'events') {
    container.innerHTML = `
      <form id="event-form" class="form-grid">
        <div class="form-group">
          <label class="form-label" for="event-title">Title</label>
          <input id="event-title" class="input" required placeholder="Event title" />
        </div>
        <div class="form-group">
          <label class="form-label" for="event-location">Location</label>
          <input id="event-location" class="input" placeholder="Location" />
        </div>
        <div class="form-group">
          <label class="form-label" for="event-date">Start Date/Time</label>
          <input id="event-date" class="input" type="datetime-local" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="event-end-date">End Date/Time</label>
          <input id="event-end-date" class="input" type="datetime-local" />
        </div>
        <div class="form-group">
          <label class="form-label" for="event-category">Category</label>
          <input id="event-category" class="input" placeholder="Category" />
        </div>
        <div class="form-group">
          <button id="event-submit" class="btn btn-primary" type="submit">Publish Event</button>
        </div>
      </form>
    `;
  } else if (type === 'notices') {
    container.innerHTML = `
      <form id="notice-form" class="form-grid">
        <div class="form-group">
          <label class="form-label" for="notice-title">Title</label>
          <input id="notice-title" class="input" required placeholder="Title" />
        </div>
        <div class="form-group">
          <label class="form-label" for="notice-content">Message</label>
          <textarea id="notice-content" class="textarea" rows="6" required placeholder="Message"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="notice-priority">Priority</label>
          <select id="notice-priority" class="select">
            <option value="low">low</option>
            <option value="normal" selected>normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="notice-valid-from">Valid From</label>
          <input id="notice-valid-from" class="input" type="datetime-local" />
        </div>
        <div class="form-group">
          <label class="form-label" for="notice-valid-until">Valid Until</label>
          <input id="notice-valid-until" class="input" type="datetime-local" />
        </div>
        <div class="form-group">
          <button id="notice-submit" class="btn btn-primary" type="submit">Publish Notice</button>
        </div>
      </form>
    `;
  }

  wireFormHandlers(type);
}

function toIsoOrNull(value) {
  if (!value) return null;
  try { return new Date(value).toISOString(); } catch { return null; }
}

function wireFormHandlers(type) {
  if (type === 'news') {
    const form = document.getElementById('news-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          title: document.getElementById('news-title').value.trim(),
          content: document.getElementById('news-content').value,
          excerpt: document.getElementById('news-excerpt').value,
          category: document.getElementById('news-category').value,
          status: 'published'
        };
        const { data } = await apiClient.post('/api/content/news', payload);
        if (data && data.success) {
          showToast('News published', 'success');
          form.reset();
        } else {
          showToast('Failed to publish news', 'error');
        }
      } catch (err) {
        showToast('Failed to publish news', 'error');
      }
    });
  }

  if (type === 'events') {
    const form = document.getElementById('event-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          title: document.getElementById('event-title').value.trim(),
          location: document.getElementById('event-location').value,
          event_date: toIsoOrNull(document.getElementById('event-date').value),
          end_date: toIsoOrNull(document.getElementById('event-end-date').value),
          category: document.getElementById('event-category').value,
          status: 'upcoming'
        };
        const { data } = await apiClient.post('/api/content/events', payload);
        if (data && data.success) {
          showToast('Event published', 'success');
          form.reset();
        } else {
          showToast('Failed to publish event', 'error');
        }
      } catch (err) {
        showToast('Failed to publish event', 'error');
      }
    });
  }

  if (type === 'notices') {
    const form = document.getElementById('notice-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          title: document.getElementById('notice-title').value.trim(),
          content: document.getElementById('notice-content').value,
          priority: document.getElementById('notice-priority').value,
          valid_from: toIsoOrNull(document.getElementById('notice-valid-from').value) || new Date().toISOString(),
          valid_until: toIsoOrNull(document.getElementById('notice-valid-until').value),
          status: 'active'
        };
        const { data } = await apiClient.post('/api/content/notices', payload);
        if (data && data.success) {
          showToast('Notice published', 'success');
          form.reset();
        } else {
          showToast('Failed to publish notice', 'error');
        }
      } catch (err) {
        showToast('Failed to publish notice', 'error');
      }
    });
  }
}

function init() {
  const typeSelect = document.getElementById('content-type');
  if (!typeSelect) return;
  // Preselect from query param
  try {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type && ['news','events','notices'].includes(type)) {
      typeSelect.value = type;
    }
  } catch {}
  renderForm(typeSelect.value);
  typeSelect.addEventListener('change', (e) => renderForm(e.target.value));
}

document.addEventListener('DOMContentLoaded', init);


