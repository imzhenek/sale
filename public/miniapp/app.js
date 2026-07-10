const tg = window.Telegram ? window.Telegram.WebApp : null;
const app = document.getElementById('app');

if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor('#0b0b0c'); } catch (e) {}
  try { tg.setBackgroundColor('#0b0b0c'); } catch (e) {}
}

const tgUser = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;

// --- i18n ---
// Переводится только интерфейс (кнопки, подписи, статусы). Данные, которые
// вписывает админ (имя модели, био, услуги, город) не переводятся — это
// потребовало бы отдельных полей на двух языках в админке.
const I18N = {
  ru: {
    nav_catalog: 'Каталог', nav_my: 'Мои заявки',
    all_cities: 'Все города',
    empty_city: 'В этом городе пока нет моделей.<br>Загляните чуть позже.',
    catalog_load_error: 'Не удалось загрузить каталог.',
    years_suffix: ' лет', cm_suffix: ' см',
    model_not_found: 'Модель не найдена.',
    spec_age: 'Возраст', spec_height: 'Рост', spec_bust: 'Грудь', spec_weight: 'Вес',
    price_label: 'Стоимость:', services_title: 'Основные услуги', services_extra_title: 'Дополнительные услуги', bio_title: 'О модели',
    choose_model_btn: 'Выбрать модель',
    open_via_telegram: 'Откройте агентство через Telegram, чтобы отправить заявку.',
    ticket_head_title: 'Заявка',
    field_name: 'Имя', field_name_ph: 'Как к вам обращаться',
    field_phone: 'Телефон (по желанию)', field_phone_ph: '+7 900 000-00-00',
    field_date: 'Дата', field_comment: 'Комментарий',
    field_comment_ph: 'Детали проекта, бюджет, референсы...',
    submit_btn: 'ОТПРАВИТЬ ЗАЯВКУ',
    error_name_required: 'Укажите имя',
    my_bookings_eyebrow: 'Статус заявок', my_bookings_title: 'Мои заявки',
    sent_alert: 'Заявка отправлена! Мы подтвердим её в течение 24 часов.',
    sent_alert_short: 'Заявка отправлена!',
    no_bookings: 'Заявок пока нет — выберите модель в каталоге.',
    open_via_telegram_bookings: 'Откройте через Telegram, чтобы увидеть свои заявки.',
    general_request: 'Общий запрос', desired_date: 'Желаемая дата:',
    status_new: 'Ожидает подтверждения', status_confirmed: 'Подтверждена',
    status_declined: 'Отклонена', status_done: 'Съёмка проведена',
    generic_error: 'Ошибка запроса'
  },
  en: {
    nav_catalog: 'Catalog', nav_my: 'My requests',
    all_cities: 'All cities',
    empty_city: 'No models in this city yet.<br>Check back soon.',
    catalog_load_error: 'Failed to load catalog.',
    years_suffix: ' y.o.', cm_suffix: ' cm',
    model_not_found: 'Model not found.',
    spec_age: 'Age', spec_height: 'Height', spec_bust: 'Bust', spec_weight: 'Weight',
    price_label: 'Price:', services_title: 'Services', services_extra_title: 'Additional services', bio_title: 'About the model',
    choose_model_btn: 'Choose model',
    open_via_telegram: 'Open the agency through Telegram to send a request.',
    ticket_head_title: 'Booking request',
    field_name: 'Name', field_name_ph: 'How should we address you',
    field_phone: 'Phone (optional)', field_phone_ph: '+1 555 000-00-00',
    field_date: 'Date', field_comment: 'Comment',
    field_comment_ph: 'Project details, budget, references...',
    submit_btn: 'SUBMIT REQUEST',
    error_name_required: 'Please enter your name',
    my_bookings_eyebrow: 'Request status', my_bookings_title: 'My requests',
    sent_alert: 'Request sent! We will confirm it within 24 hours.',
    sent_alert_short: 'Request sent!',
    no_bookings: 'No requests yet — choose a model from the catalog.',
    open_via_telegram_bookings: 'Open via Telegram to see your requests.',
    general_request: 'General request', desired_date: 'Preferred date:',
    status_new: 'Pending confirmation', status_confirmed: 'Confirmed',
    status_declined: 'Declined', status_done: 'Shoot completed',
    generic_error: 'Request error'
  }
};

let lang = localStorage.getItem('loveinasia_lang') || 'ru';
function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.ru[key] || key; }

// Список городов фиксированный (задаётся в админке через выпадающий список),
// поэтому его, в отличие от свободного текста (био, услуги), можно перевести.
const CITY_NAMES = {
  'Нячанг': { ru: 'Нячанг', en: 'Nha Trang' },
  'Дананг': { ru: 'Дананг', en: 'Da Nang' },
  'Фукок': { ru: 'Фукок', en: 'Phu Quoc' },
  'Бангкок': { ru: 'Бангкок', en: 'Bangkok' }
};
function trCity(city) {
  if (!city) return '';
  const entry = CITY_NAMES[city];
  return entry ? entry[lang] : city;
}

function setLang(l) {
  lang = l;
  localStorage.setItem('loveinasia_lang', l);
  updateLangButton();
  router();
}

function updateLangButton() {
  const btn = document.getElementById('langBtn');
  if (btn) btn.textContent = lang === 'ru' ? 'EN' : 'RU';
}

function statusLabel(status) {
  const map = { new: ['status_new', 'status-new'], confirmed: ['status_confirmed', 'status-confirmed'], declined: ['status_declined', 'status-declined'], done: ['status_done', 'status-done'] };
  const entry = map[status] || ['status_new', 'status-new'];
  return [t(entry[0]), entry[1]];
}

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
  if (!res.ok) throw new Error(data.message || data.error || t('generic_error'));
  return data;
}

function esc(s) { return (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function formatVND(n) {
  const num = Math.round(Number(n));
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' VND';
}

function bottomNav(active) {
  return `
  <div class="bottom-nav">
    <a class="nav-item ${active === 'catalog' ? 'active' : ''}" href="#/">
      <span class="ic">◆</span>${t('nav_catalog')}
    </a>
    <a class="nav-item ${active === 'my' ? 'active' : ''}" href="#/my-bookings">
      <span class="ic">✎</span>${t('nav_my')}
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
      filters.innerHTML = ['all', ...cities].map(c => `<span data-city="${esc(c)}" class="${c === currentCity ? 'active' : ''}">${c === 'all' ? t('all_cities') : esc(trCity(c))}</span>`).join('');
      filters.querySelectorAll('span').forEach(el => {
        el.onclick = () => { currentCity = el.dataset.city; renderCatalog(); };
      });
    }

    const grid = document.getElementById('grid');
    if (!models.length) {
      grid.outerHTML = `<div class="empty-state">${t('empty_city')}</div>`;
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
          <div class="tag-meta">${m.city ? esc(trCity(m.city)) + ' · ' : ''}${m.age ? m.age + t('years_suffix') : ''}${m.height ? (m.age ? ' · ' : '') + m.height + t('cm_suffix') : ''}</div>
        </div>
      </a>
    `).join('');
  } catch (e) {
    document.getElementById('grid').outerHTML = `<div class="empty-state">${t('catalog_load_error')}<br>${esc(e.message)}</div>`;
  }
}

async function renderModel(slug) {
  setBack(true, '#/');
  if (tg) tg.MainButton.hide();
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
        <div class="casting-no">Casting № ${String(model.id).padStart(4, '0')}${model.city ? ' · ' + esc(trCity(model.city)) : ''}${model.nationality ? ' · ' + esc(model.nationality) : ''}</div>
        <div class="spec-strip spec-strip-4">
          <div class="spec-cell"><div class="label">${t('spec_age')}</div><div class="value">${model.age || '—'}</div></div>
          <div class="spec-cell"><div class="label">${t('spec_height')}</div><div class="value">${model.height || '—'}</div></div>
          <div class="spec-cell"><div class="label">${t('spec_bust')}</div><div class="value">${model.bust || '—'}</div></div>
          <div class="spec-cell"><div class="label">${t('spec_weight')}</div><div class="value">${model.weight || '—'}</div></div>
        </div>
        ${model.price ? `<div class="price-tag">${t('price_label')} ${formatVND(model.price)}</div>` : ''}
        ${model.bio ? `<div class="services-title" style="margin-bottom:6px;">${t('bio_title')}</div><div class="bio">${esc(model.bio)}</div>` : ''}
        ${model.services ? `<div class="services-block"><div class="services-title">${t('services_title')}</div><div class="services-list">${model.services.split('\n').filter(Boolean).map(s => `<span class="service-pill">${esc(s.trim())}</span>`).join('')}</div></div>` : ''}
        ${model.services_extra ? `<div class="services-block"><div class="services-title">${t('services_extra_title')}</div><div class="services-list">${model.services_extra.split('\n').filter(Boolean).map(s => `<span class="service-pill service-pill-extra">${esc(s.trim())}</span>`).join('')}</div></div>` : ''}
        <a class="btn full" href="#/model/${model.slug}/book">${t('choose_model_btn')}</a>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="empty-state">${t('model_not_found')}</div>`;
  }
}

let mainButtonHandler = null;
let isSubmittingBooking = false;

async function renderBooking(slug) {
  setBack(true, `#/model/${slug}`);
  if (!tg || !tg.initData) {
    app.innerHTML = `<div class="empty-state">${t('open_via_telegram')}</div>`;
    return;
  }

  const first = tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') : '';

  app.innerHTML = `
    <div class="detail-body">
      <div class="ticket">
        <div class="ticket-head"><span>${t('ticket_head_title')}</span><span class="stamp">Booking</span></div>
        <div id="bookingError"></div>
        <div class="field">
          <label>${t('field_name')}</label>
          <input id="f_name" type="text" value="${esc(first)}" placeholder="${t('field_name_ph')}">
        </div>
        <div class="field">
          <label>${t('field_phone')}</label>
          <input id="f_phone" type="tel" placeholder="${t('field_phone_ph')}">
        </div>
        <div class="field">
          <label>${t('field_date')}</label>
          <input id="f_date" type="date">
        </div>
        <div class="field">
          <label>${t('field_comment')}</label>
          <textarea id="f_comment" rows="3" placeholder="${t('field_comment_ph')}"></textarea>
        </div>
      </div>
    </div>
  `;

  if (tg) {
    tg.MainButton.setText(t('submit_btn'));
    tg.MainButton.show();
    if (mainButtonHandler) tg.MainButton.offClick(mainButtonHandler);
    mainButtonHandler = submit;
    tg.MainButton.onClick(mainButtonHandler);
  }

  async function submit() {
    if (isSubmittingBooking) return;
    const client_name = document.getElementById('f_name').value.trim();
    if (!client_name) {
      document.getElementById('bookingError').innerHTML = `<div class="alert error">${t('error_name_required')}</div>`;
      return;
    }
    isSubmittingBooking = true;
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
      if (mainButtonHandler) { tg.MainButton.offClick(mainButtonHandler); mainButtonHandler = null; }
      tg.MainButton.hide();
      window.location.hash = '#/my-bookings?justSent=1';
    } catch (e) {
      document.getElementById('bookingError').innerHTML = `<div class="alert error">${esc(e.message)}</div>`;
    } finally {
      isSubmittingBooking = false;
      tg.MainButton.hideProgress();
    }
  }
}

async function renderMyBookings(justSent) {
  setBack(false);
  if (tg) tg.MainButton.hide();

  if (!tg || !tg.initData) {
    app.innerHTML = `<div class="empty-state">${t('open_via_telegram_bookings')}</div>${bottomNav('my')}`;
    return;
  }

  app.innerHTML = `
    <div class="topbar"><div class="eyebrow">${t('my_bookings_eyebrow')}</div><h1>${t('my_bookings_title')}</h1></div>
    <div class="detail-body" id="list">
      ${justSent ? `<div class="alert success">${t('sent_alert')}</div>` : ''}
      <div class="skeleton" style="height:80px;border-radius:3px;margin-bottom:10px;"></div>
    </div>
    ${bottomNav('my')}
  `;

  try {
    const { bookings } = await api('/my-bookings');
    const list = document.getElementById('list');
    if (!bookings.length) {
      list.innerHTML = (justSent ? `<div class="alert success">${t('sent_alert_short')}</div>` : '') + `<div class="empty-state">${t('no_bookings')}</div>`;
      return;
    }
    list.innerHTML = (justSent ? `<div class="alert success">${t('sent_alert')}</div>` : '') +
      bookings.map(b => {
        const [label, cls] = statusLabel(b.status);
        return `
        <div class="booking-card">
          <div class="row-top">
            <div class="model">${esc(b.model_name || t('general_request'))}</div>
            <span class="status-badge ${cls}">${label}</span>
          </div>
          <div class="meta">${b.shoot_date ? t('desired_date') + ' ' + b.shoot_date : ''}</div>
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

document.getElementById('langBtn').onclick = () => setLang(lang === 'ru' ? 'en' : 'ru');
updateLangButton();

window.addEventListener('hashchange', router);
router();
