// Temporary mock data for Publications page
const USE_MOCK_PUBLICATION = false;
const MOCK_PUBLICATION = {
  news: [
    { id: 'n1', title: 'City launches new waste program', excerpt: 'Segregation and recycling drive...', content: 'Full article: The city introduced...', created_at: new Date(Date.now()-2*86400000).toISOString(), office: 'SWM' },
    { id: 'n2', title: 'Road repairs scheduled', excerpt: 'Repairs along Main Ave...', content: 'Full article: DPWH will...', created_at: new Date(Date.now()-5*86400000).toISOString(), office: 'ENG' }
  ],
  notices: [
    { id: 't1', title: 'Water Service Interruption', content: 'Maintenance from 9AM-5PM', created_at: new Date().toISOString(), priority: 'urgent', office: 'ENG' },
    { id: 't2', title: 'Public Consultation', content: 'Join us this Friday at the hall', created_at: new Date(Date.now()-86400000).toISOString(), priority: 'normal', office: 'HR' }
  ],
  events: [
    { id: 'e1', title: 'Health Fair at Plaza', description: 'Free checkups', event_date: new Date(Date.now()+10*86400000).toISOString(), organizer: 'HEALTH' },
    { id: 'e2', title: 'Job Fair', description: 'Opportunities at city hall', event_date: new Date(Date.now()+18*86400000).toISOString(), organizer: 'HR' }
  ]
};
import showMessage from '../components/toast.js'

let currentType = 'news'
let currentList = []

document.addEventListener('DOMContentLoaded', () => {
  wireTabs()
  wireFilters()
  document.getElementById('btn-create')?.addEventListener('click', () => openCreate())
  ensureCreateVisibility()
  const initialType = getTypeFromHash() || 'news'
  activateTab(initialType)
  loadContent(initialType)
  window.addEventListener('hashchange', () => {
    const t = getTypeFromHash()
    if (t) {
      activateTab(t)
      loadContent(t)
    }
  })
})

function wireTabs() {
  document.querySelectorAll('.pub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pub-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const type = btn.getAttribute('data-type')
      if (location.hash !== `#${type}`) {
        history.replaceState(null, '', `#${type}`)
      }
      loadContent(type)
    })
  })
}

function wireFilters() {
  document.getElementById('filter-apply')?.addEventListener('click', () => loadContent(currentType))
}

function getFilters() {
  const from = document.getElementById('filter-from')?.value
  const to = document.getElementById('filter-to')?.value
  const office = document.getElementById('filter-office')?.value
  return { from, to, office }
}

async function loadContent(type) {
  currentType = type
  const { from, to, office } = getFilters()

  // build URL with published-only defaults
  const base = type === 'events' ? '/api/content/events' : `/api/content/${type}`
  const params = new URLSearchParams()
  if (type === 'news') params.set('status', 'published')
  if (type === 'notices') params.set('status', 'active')
  if (from) params.set(type === 'events' ? 'from' : 'from', from)
  if (to) params.set(type === 'events' ? 'to' : 'to', to)
  if (office) params.set('office', office)

  let data = []
  if (USE_MOCK_PUBLICATION) {
    data = Array.isArray(MOCK_PUBLICATION[type]) ? MOCK_PUBLICATION[type] : []
  } else {
    try {
      const res = await fetch(`${base}?${params.toString()}`)
      const json = await res.json()
      data = Array.isArray(json?.data) ? json.data : []
    } catch (e) {
      console.warn('[PUB] fetch failed', e)
    }
  }

  console.log(`[PUB DEBUG] Loaded ${type}:`, data.length)
  currentList = data
  renderList()
  if (currentList.length) selectItem(0)
  else renderEmptyDetail()
}

function getTypeFromHash() {
  const h = (location.hash || '').toLowerCase()
  if (h === '#news') return 'news'
  if (h === '#notices' || h === '#notice') return 'notices'
  if (h === '#events' || h === '#event') return 'events'
  return null
}

function activateTab(type) {
  document.querySelectorAll('.pub-tab').forEach(b => b.classList.remove('active'))
  const btn = document.querySelector(`.pub-tab[data-type="${type}"]`)
  if (btn) btn.classList.add('active')
}

function renderList() {
  const list = document.getElementById('pub-list')
  if (!list) return
  list.innerHTML = currentList.map((item, idx) => `
    <div class="pub-card" data-idx="${idx}">
      <div class="pub-card-title">${escapeHtml(item.title || 'Untitled')}</div>
      <div class="pub-card-meta">
        <span>${formatDate(item.published_at || item.created_at || item.event_date)}</span>
        ${item.office ? `<span>${escapeHtml(item.office)}</span>` : ''}
      </div>
    </div>
  `).join('')
  list.querySelectorAll('.pub-card').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.getAttribute('data-idx'), 10)
      selectItem(i)
      // Highlight selection
      list.querySelectorAll('.pub-card').forEach(c => c.classList.remove('selected'))
      el.classList.add('selected')
    })
  })
}

function selectItem(index) {
  const item = currentList[index]
  if (!item) return
  const detail = document.getElementById('pub-detail')
  const date = formatDate(item.published_at || item.created_at || item.event_date)
  const office = escapeHtml(item.office || item.department || item.organizer || '')
  const body = escapeHtml(item.content || item.description || item.excerpt || '')
  detail.innerHTML = `
    <h2>${escapeHtml(item.title || 'Untitled')}</h2>
    <div class="meta">
      ${date ? `<span>📅 ${date}</span>` : ''}
      ${office ? `<span>🏢 ${office}</span>` : ''}
    </div>
    <div class="content">${body}</div>
  `
}

function renderEmptyDetail() {
  const detail = document.getElementById('pub-detail')
  detail.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📄</div>
      <h3>No content found</h3>
      <p>Try adjusting filters or switch tabs.</p>
    </div>
  `
}

function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString() } catch { return '' }
}

function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div');
  div.textContent = String(text)
  return div.innerHTML
}

// mock data intentionally removed per request

function openCreate() {
  showMessage('info', 'Creation UI coming soon. (POST endpoints already available)')
}

async function ensureCreateVisibility() {
  try {
    const res = await fetch('/api/user/role', { credentials: 'include' })
    const json = await res.json()
    const role = json?.data?.role || 'citizen'
    if (String(role).toLowerCase() !== 'lgu-admin') {
      const btn = document.getElementById('btn-create')
      if (btn) btn.style.display = 'none'
    }
  } catch (e) {
    const btn = document.getElementById('btn-create')
    if (btn) btn.style.display = 'none'
  }
}


