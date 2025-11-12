import apiClient from '../../config/apiClient.js';
import showMessage from '../../components/toast.js';

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
        <div class="form-group-row">
          <div class="form-group">
            <label class="form-label" for="news-excerpt">Excerpt</label>
            <input id="news-excerpt" class="input" placeholder="Short summary" />
          </div>
          <div class="form-group">
            <label class="form-label" for="news-category">Category</label>
            <input id="news-category" class="input" placeholder="Category" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="news-content">Content</label>
          <textarea id="news-content" class="textarea" rows="5" required placeholder="Write the content..."></textarea>
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
          <label class="form-label" for="event-description">Description</label>
          <textarea id="event-description" class="textarea" rows="4" required placeholder="Event description..."></textarea>
        </div>
        <div class="form-group-row">
          <div class="form-group">
            <label class="form-label" for="event-location">Location</label>
            <input id="event-location" class="input" placeholder="Location" />
          </div>
          <div class="form-group">
            <label class="form-label" for="event-category">Category</label>
            <input id="event-category" class="input" placeholder="Category" />
          </div>
        </div>
        <div class="form-group-row">
          <div class="form-group">
            <label class="form-label" for="event-date">Start Date/Time</label>
            <input id="event-date" class="input" type="datetime-local" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="event-end-date">End Date/Time</label>
            <input id="event-end-date" class="input" type="datetime-local" />
          </div>
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
          <textarea id="notice-content" class="textarea" rows="4" required placeholder="Message"></textarea>
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
        <div class="form-group-row">
          <div class="form-group">
            <label class="form-label" for="notice-valid-from">Valid From</label>
            <input id="notice-valid-from" class="input" type="datetime-local" />
          </div>
          <div class="form-group">
            <label class="form-label" for="notice-valid-until">Valid Until</label>
            <input id="notice-valid-until" class="input" type="datetime-local" />
          </div>
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
        const excerpt = document.getElementById('news-excerpt').value.trim();
        const category = document.getElementById('news-category').value.trim();
        const payload = {
          title: document.getElementById('news-title').value.trim(),
          content: document.getElementById('news-content').value.trim(),
          excerpt: excerpt || null,
          category: category || null,
          status: 'published'
        };
        const response = await apiClient.post('/api/content/news', payload);
        if (response && response.success) {
          showMessage('success', 'News published successfully');
          form.reset();
        } else {
          const errorMsg = response?.error || response?.details || 'Failed to publish news';
          console.error('[PUBLISH] News publish failed:', errorMsg);
          showMessage('error', errorMsg);
        }
      } catch (err) {
        console.error('[PUBLISH] Error publishing news:', err);
        const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to publish news. Please check the console for details.';
        showMessage('error', errorMsg);
      }
    });
  }
  if (type === 'events') {
    const form = document.getElementById('event-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const location = document.getElementById('event-location').value.trim();
        const category = document.getElementById('event-category').value.trim();
        const eventDate = document.getElementById('event-date').value;
        const eventDescription = document.getElementById('event-description').value.trim();
        if (!eventDescription) {
          showMessage('error', 'Description is required');
          return;
        }
        if (!eventDate) {
          showMessage('error', 'Start date is required');
          return;
        }
        const payload = {
          title: document.getElementById('event-title').value.trim(),
          description: eventDescription,
          location: location || null,
          event_date: toIsoOrNull(eventDate),
          end_date: toIsoOrNull(document.getElementById('event-end-date').value),
          category: category || null,
          status: 'upcoming'
        };
        const response = await apiClient.post('/api/content/events', payload);
        if (response && response.success) {
          showMessage('success', 'Event published successfully');
          form.reset();
        } else {
          const errorMsg = response?.error || response?.details || 'Failed to publish event';
          console.error('[PUBLISH] Event publish failed:', errorMsg);
          showMessage('error', errorMsg);
        }
      } catch (err) {
        console.error('[PUBLISH] Error publishing event:', err);
        const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to publish event. Please check the console for details.';
        showMessage('error', errorMsg);
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
          content: document.getElementById('notice-content').value.trim(),
          priority: document.getElementById('notice-priority').value,
          valid_from: toIsoOrNull(document.getElementById('notice-valid-from').value) || new Date().toISOString(),
          valid_until: toIsoOrNull(document.getElementById('notice-valid-until').value),
          status: 'active'
        };
        const response = await apiClient.post('/api/content/notices', payload);
        if (response && response.success) {
          showMessage('success', 'Notice published successfully');
          form.reset();
        } else {
          const errorMsg = response?.error || response?.details || 'Failed to publish notice';
          console.error('[PUBLISH] Notice publish failed:', errorMsg);
          showMessage('error', errorMsg);
        }
      } catch (err) {
        console.error('[PUBLISH] Error publishing notice:', err);
        const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to publish notice. Please check the console for details.';
        showMessage('error', errorMsg);
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
