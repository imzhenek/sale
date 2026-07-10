const tg = window.Telegram ? window.Telegram.WebApp : null;
const app = document.getElementById('app');

if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor('#0b0b0c'); } catch (e) {}
  try { tg.setBackgroundColor('#0b0b0c'); } catch (e) {}
}

const tgUser = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;

async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (tg && tg.initData) headers['Authorization'] = 'tma ' + tg.initData;
  let fetchBody;
  if (body) {
    if (isForm) { fetchBody = body; }
    else { headers['Content-Type'] = 'application/json'; fetchBody = JSON.stringify(body); }
  }
  const res = await fetch('/api' + path, { method, headers, body: fetchBody });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Ошибка запроса');
  return data;
}

const STATUS_LABEL = {
  new: ['Ожидает подтверждения', 'status-new'],
  confirmed: ['Подтверждена', 'status-confirmed'],
  declined: ['Отклонена', 'status-declined'],
  done: ['Съёмка проведена', 'status-done']
};

function esc(s) { return (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function bottomNav(active) {
  return `
  <div class="bottom-nav">
    <a class="nav-item ${active === 'catalog' ? 'active' : ''}" href="#/">
      <span class="ic">◆</span>Каталог
    </a>
    <a class="nav-item ${active === 'my' ? 'active' : ''}" href="#/my-bookings">
      <span class="ic">✎</span>Мои заявки
    </a>
  </div>`;
}

function setBack(show, fallback = '#/') {
  if (!tg) return;
  if (show) {
    tg.BackButton.show();
    tg.BackButton.onClick(() => { window.location.hash = fallback; });
  } else {
    tg.BackButton.hide();
  }
}

// --- Screens ---

let currentCategory = 'women';
let currentCity = 'all';

async function renderCatalog() {
  setBack(false);
  if (tg) tg.MainButton.hide();
  app.innerHTML = `
    <div class="hazard-bar"></div>
    <div class="topbar">
      <div class="eyebrow">Casting file / 2026</div>
      <h1>LOVEINASIA</h1>
    </div>
    <div class="filter-row" id="cityFilters"></div>
    <div class="model-grid" id="grid">
      ${Array.from({ length: 4 }).map(() => `<div class="tag-card"><div class="photo-wrap skeleton"></div></div>`).join('')}
    </div>
    ${bottomNav('catalog')}
  `;

  try {
    const [{ models }, { cities }] = await Promise.all([
      api(`/models?category=${currentCategory}${currentCity !== 'all' ? '&city=' + encodeURIComponent(currentCity) : ''}`),
      api('/cities')
    ]);

    if (cities.length) {
      const filters = document.getElementById('cityFilters');
      filters.innerHTML = ['all', ...cities].map(c => `<span data-city="${esc(c)}" class="${c === currentCity ? 'active' : ''}">${c === 'all' ? 'Все города' : esc(c)}</span>`).join('');
      filters.querySelectorAll('span').forEach(el => {
        el.onclick = () => { currentCity = el.dataset.city; renderCatalog(); };
      });
    }

    const grid = document.getElementById('grid');
    if (!models.length) {
      grid.outerHTML = `<div class="empty-state">В этом городе пока нет моделей.<br>Загляните чуть позже.</div>`;
      return;
    }
    grid.innerHTML = models.map(m => `
      <a class="tag-card" href="#/model/${m.slug}">
        <div class="photo-wrap">
          <img src="${m.photo_main || 'https://placehold.co/480x640/1a1a1d/666?text=NO+PHOTO'}" loading="lazy">
          <div class="tag-id">№${String(m.id).padStart(4, '0')}</div>
        </div>
        <div class="info">
          <h3>${esc(m.name)}</h3>
          <div class="tag-meta">${m.city ? esc(m.city) + ' · ' : ''}${m.age ? m.age + ' лет' : ''}${m.height ? (m.age ? ' · ' : '') + m.height + ' см' : ''}</div>
        </div>
      </a>
    `).join('');
  } catch (e) {
    document.getElementById('grid').outerHTML = `<div class="empty-state">Не удалось загрузить каталог.<br>${esc(e.message)}</div>`;
  }
}

async function renderModel(slug) {
  setBack(true, '#/');
  app.innerHTML = `<div class="detail-photo skeleton"></div>`;
  try {
    const { model } = await api(`/models/${slug}`);
    app.innerHTML = `
      <div class="detail-photo">
        <img src="${model.photo_main || 'https://placehold.co/600x800/1a1a1d/666?text=NO+PHOTO'}">
      </div>
      ${model.photos && model.photos.length ? `<div class="thumb-row">${model.photos.map(p => `<img src="${p}">`).join('')}</div>` : ''}
      <div class="detail-body">
        <h1>${esc(model.name)}</h1>
        <div class="casting-no">Casting № ${String(model.id).padStart(4, '0')}${model.city ? ' · ' + esc(model.city) : ''}${model.nationality ? ' · ' + esc(model.nationality) : ''}</div>
        <div class="spec-strip spec-strip-4">
          <div class="spec-cell"><div class="label">Возраст</div><div class="value">${model.age || '—'}</div></div>
          <div class="spec-cell"><div class="label">Рост</div><div class="value">${model.height || '—'}</div></div>
          <div class="spec-cell"><div class="label">Грудь</div><div class="value">${model.bust || '—'}</div></div>
          <div class="spec-cell"><div class="label">Вес</div><div class="value">${model.weight || '—'}</div></div>
        </div>
        ${model.price ? `<div class="price-tag">Стоимость: ${esc(model.price)}</div>` : ''}
        ${model.bio ? `<div class="bio">${esc(model.bio)}</div>` : ''}
        ${model.services ? `<div class="services-block"><div class="services-title">Услуги</div><div class="services-list">${model.services.split('\n').filter(Boolean).map(s => `<span class="service-pill">${esc(s.trim())}</span>`).join('')}</div></div>` : ''}
        <a class="btn full" href="#/model/${model.slug}/book">Выбрать модель</a>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="empty-state">Модель не найдена.</div>`;
  }
}

async function renderBooking(slug) {
  setBack(true, `#/model/${slug}`);
  if (!tg || !tg.initData) {
    app.innerHTML = `<div class="empty-state">Откройте агентство через Telegram, чтобы отправить заявку.</div>`;
    return;
  }

  const first = tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') : '';

  app.innerHTML = `
    <div class="detail-body">
      <div class="ticket">
        <div class="ticket-head"><span>Заявка на съёмку</span><span class="stamp">Booking</span></div>
        <div id="bookingError"></div>
        <div class="field">
          <label>Имя</label>
          <input id="f_name" type="text" value="${esc(first)}" placeholder="Как к вам обращаться">
        </div>
        <div class="field">
          <label>Телефон (по желанию)</label>
          <input id="f_phone" type="tel" placeholder="+7 900 000-00-00">
        </div>
        <div class="field">
          <label>Дата</label>
          <input id="f_date" type="date">
        </div>
        <div class="field">
          <label>Комментарий</label>
          <textarea id="f_comment" rows="3" placeholder="Детали проекта, бюджет, референсы..."></textarea>
        </div>
      </div>
    </div>
  `;

  if (tg) {
    tg.MainButton.setText('ОТПРАВИТЬ ЗАЯВКУ');
    tg.MainButton.show();
    tg.MainButton.offClick(submit);
    tg.MainButton.onClick(submit);
  }

  async function submit() {
    const client_name = document.getElementById('f_name').value.trim();
    if (!client_name) {
      document.getElementById('bookingError').innerHTML = `<div class="alert error">Укажите имя</div>`;
      return;
    }
    tg.MainButton.showProgress(true);
    try {
      await api('/bookings', {
        method: 'POST',
        body: {
          slug,
          client_name,
          client_phone: document.getElementById('f_phone').value.trim(),
          shoot_date: document.getElementById('f_date').value,
          comment: document.getElementById('f_comment').value.trim()
        }
      });
      tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success');
      tg.MainButton.hide();
      window.location.hash = '#/my-bookings?justSent=1';
    } catch (e) {
      document.getElementById('bookingError').innerHTML = `<div class="alert error">${esc(e.message)}</div>`;
    } finally {
      tg.MainButton.hideProgress();
    }
  }
}

async function renderMyBookings(justSent) {
  setBack(false);
  if (tg) tg.MainButton.hide();

  if (!tg || !tg.initData) {
    app.innerHTML = `<div class="empty-state">Откройте через Telegram, чтобы увидеть свои заявки.</div>${bottomNav('my')}`;
    return;
  }

  app.innerHTML = `
    <div class="topbar"><div class="eyebrow">Статус заявок</div><h1>Мои заявки</h1></div>
    <div class="detail-body" id="list">
      ${justSent ? `<div class="alert success">Заявка отправлена! Мы подтвердим её в течение 24 часов.</div>` : ''}
      <div class="skeleton" style="height:80px;border-radius:3px;margin-bottom:10px;"></div>
    </div>
    ${bottomNav('my')}
  `;

  try {
    const { bookings } = await api('/my-bookings');
    const list = document.getElementById('list');
    if (!bookings.length) {
      list.innerHTML = (justSent ? `<div class="alert success">Заявка отправлена!</div>` : '') + `<div class="empty-state">Заявок пока нет — выберите модель в каталоге.</div>`;
      return;
    }
    list.innerHTML = (justSent ? `<div class="alert success">Заявка отправлена! Мы подтвердим её в течение 24 часов.</div>` : '') +
      bookings.map(b => {
        const [label, cls] = STATUS_LABEL[b.status] || [b.status, 'status-new'];
        return `
        <div class="booking-card">
          <div class="row-top">
            <div class="model">${esc(b.model_name || 'Общий запрос')}</div>
            <span class="status-badge ${cls}">${label}</span>
          </div>
          <div class="meta">${b.shoot_date ? 'Желаемая дата: ' + b.shoot_date : ''}</div>
        </div>`;
      }).join('');
  } catch (e) {
    document.getElementById('list').innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

function router() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');

  if (path === '/') return renderCatalog();
  if (path === '/my-bookings') return renderMyBookings(params.get('justSent') === '1');

  let m = path.match(/^\/model\/([^/]+)\/book$/);
  if (m) return renderBooking(m[1]);

  m = path.match(/^\/model\/([^/]+)$/);
  if (m) return renderModel(m[1]);

  renderCatalog();
}

window.addEventListener('hashchange', router);
router();
