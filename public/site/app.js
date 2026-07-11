const app = document.getElementById('app');

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  let fetchBody;
  if (body) { headers['Content-Type'] = 'application/json'; fetchBody = JSON.stringify(body); }
  const res = await fetch(path, { method, headers, body: fetchBody });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Ошибка запроса');
  return data;
}

function esc(s) { return (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function formatVND(n) {
  const num = Math.round(Number(n));
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' VND';
}

function header() {
  return `
  <div class="hazard-bar"></div>
  <header class="site-header">
    <div class="site-container">
      <a href="#/" class="site-logo">LOVEIN<span>ASIA</span></a>
      <nav class="site-nav-links">
        <a href="#/">Каталог</a>
      </nav>
    </div>
  </header>`;
}

function footer() {
  return `
  <footer class="site-footer">
    <div class="site-container" style="display:flex; justify-content:space-between; width:100%; flex-wrap:wrap; gap:10px;">
      <span>© ${new Date().getFullYear()} LOVEINASIA AGENCY</span>
      <span>Заявки обрабатываются в течение 24 часов</span>
    </div>
  </footer>`;
}

let currentCity = 'all';

async function renderCatalog() {
  app.innerHTML = `
    <div class="site-page-body">
      ${header()}
      <section class="site-hero">
        <div class="site-container">
          <h1>Каталог<br><em>моделей</em><br>агентства.</h1>
          <p>Каталог моделей агентства Loveinasia. Выбирайте, изучайте анкету и отправляйте заявку — мы подтвердим её в течение суток.</p>
        </div>
      </section>
      <div class="site-container">
        <div class="site-filter-row" id="cityFilters"></div>
        <div class="site-model-grid" id="grid">
          ${Array.from({ length: 8 }).map(() => `<div class="tag-card"><div class="photo-wrap skeleton"></div></div>`).join('')}
        </div>
      </div>
      ${footer()}
    </div>
  `;

  try {
    const [{ models }, { cities }] = await Promise.all([
      api(`/api/models?category=women${currentCity !== 'all' ? '&city=' + encodeURIComponent(currentCity) : ''}`),
      api('/api/cities')
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
  app.innerHTML = `
    <div class="site-page-body">
      ${header()}
      <div class="site-container"><div class="detail-photo skeleton" style="margin-top:24px;"></div></div>
    </div>
  `;

  let model;
  try {
    const r = await api(`/api/models/${slug}`);
    model = r.model;
  } catch (e) {
    app.innerHTML = `
      <div class="site-page-body">
        ${header()}
        <div class="site-container"><div class="empty-state">Модель не найдена.</div></div>
      </div>`;
    return;
  }

  app.innerHTML = `
    <div class="site-page-body">
      ${header()}
      <div class="site-container">
        <div class="site-model-detail">
          <div>
            <div class="detail-photo">
              <img src="${model.photo_main || 'https://placehold.co/600x800/1a1a1d/666?text=NO+PHOTO'}">
            </div>
            ${model.photos && model.photos.length ? `<div class="thumb-row" style="padding-left:0;">${model.photos.map(p => `<img src="${p}">`).join('')}</div>` : ''}
          </div>
          <div class="detail-body" style="padding:0;">
            <h1>${esc(model.name)}</h1>
            <div class="casting-no">Casting № ${String(model.id).padStart(4, '0')}${model.city ? ' · ' + esc(model.city) : ''}</div>
            ${model.nationality ? `<div class="nationality-line">${esc(model.nationality)}</div>` : ''}
            <div class="spec-strip spec-strip-4">
              <div class="spec-cell"><div class="label">Возраст</div><div class="value">${model.age || '—'}</div></div>
              <div class="spec-cell"><div class="label">Рост</div><div class="value">${model.height || '—'}</div></div>
              <div class="spec-cell"><div class="label">Грудь</div><div class="value">${model.bust || '—'}</div></div>
              <div class="spec-cell"><div class="label">Вес</div><div class="value">${model.weight || '—'}</div></div>
            </div>
            ${model.price ? `<div class="price-tag">Стоимость: ${formatVND(model.price)}</div>` : ''}
            ${model.bio ? `<div class="services-title" style="margin-bottom:6px;">О модели</div><div class="bio">${esc(model.bio)}</div>` : ''}
            ${model.services ? `<div class="services-block"><div class="services-title">Основные услуги</div><div class="services-list">${model.services.split('\n').filter(Boolean).map(s => `<span class="service-pill">${esc(s.trim())}</span>`).join('')}</div></div>` : ''}
            ${model.services_extra ? `<div class="services-block"><div class="services-title">Дополнительные услуги</div><div class="services-list">${model.services_extra.split('\n').filter(Boolean).map(s => `<span class="service-pill service-pill-extra">${esc(s.trim())}</span>`).join('')}</div></div>` : ''}

            <div class="ticket" id="booking" style="margin-top:24px;">
              <div class="ticket-head"><span>Заявка</span><span class="stamp">Booking</span></div>
              <div id="bookingMsg"></div>
              <form id="bookingForm">
                <div class="field-row">
                  <div class="field"><label>Имя</label><input id="f_name" type="text" required></div>
                  <div class="field"><label>Телефон</label><input id="f_phone" type="tel" required placeholder="+7 900 000-00-00"></div>
                </div>
                <div class="field"><label>Telegram / доп. контакт</label><input id="f_contact" type="text" placeholder="@username"></div>
                <div class="field"><label>Желаемая дата</label><input id="f_date" type="date"></div>
                <div class="field"><label>Комментарий</label><textarea id="f_comment" rows="3" placeholder="Детали, бюджет, референсы..."></textarea></div>
                <button type="submit" class="btn full" id="submitBtn">Отправить заявку</button>
              </form>
            </div>
          </div>
        </div>
      </div>
      ${footer()}
    </div>
  `;

  document.getElementById('bookingForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('bookingMsg');
    const client_name = document.getElementById('f_name').value.trim();
    const client_phone = document.getElementById('f_phone').value.trim();
    if (!client_name || !client_phone) {
      msg.innerHTML = `<div class="alert error">Укажите имя и телефон</div>`;
      return;
    }
    btn.disabled = true; btn.textContent = 'Отправка...';
    try {
      await api('/api/site/bookings', {
        method: 'POST',
        body: {
          slug,
          client_name,
          client_phone,
          client_contact: document.getElementById('f_contact').value.trim(),
          shoot_date: document.getElementById('f_date').value,
          comment: document.getElementById('f_comment').value.trim()
        }
      });
      msg.innerHTML = `<div class="alert success">Заявка отправлена! Мы свяжемся с вами в течение 24 часов.</div>`;
      document.getElementById('bookingForm').reset();
    } catch (e2) {
      msg.innerHTML = `<div class="alert error">${esc(e2.message)}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Отправить заявку';
    }
  };
}

function router() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const m = hash.match(/^\/model\/([^/]+)$/);
  if (m) return renderModel(m[1]);
  renderCatalog();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', router);
router();
