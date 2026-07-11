const tg = window.Telegram ? window.Telegram.WebApp : null;
const app = document.getElementById('app');

if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor('#0b0b0c'); } catch (e) {}
  try { tg.setBackgroundColor('#0b0b0c'); } catch (e) {}
}

async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (tg && tg.initData) headers['Authorization'] = 'tma ' + tg.initData;
  let fetchBody;
  if (body) {
    if (isForm) fetchBody = body;
    else { headers['Content-Type'] = 'application/json'; fetchBody = JSON.stringify(body); }
  }
  const res = await fetch('/api/admin' + path, { method, headers, body: fetchBody });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Ошибка запроса');
  return data;
}

function esc(s) { return (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const STATUS_LABEL = {
  new: ['Новая', 'status-new'], confirmed: ['Подтверждена', 'status-confirmed'],
  declined: ['Отклонена', 'status-declined'], done: ['Проведена', 'status-done']
};

function setBack(show, fallback = '#/') {
  if (!tg) return;
  if (show) { tg.BackButton.show(); tg.BackButton.onClick(() => { window.location.hash = fallback; }); }
  else tg.BackButton.hide();
}

function bottomNav(active) {
  return `
  <div class="bottom-nav">
    <a class="nav-item ${active === 'dash' ? 'active' : ''}" href="#/">
      <span class="ic">◈</span>Обзор
    </a>
    <a class="nav-item ${active === 'models' ? 'active' : ''}" href="#/models">
      <span class="ic">◆</span>Модели
    </a>
    <a class="nav-item ${active === 'bookings' ? 'active' : ''}" href="#/bookings">
      <span class="ic">✎</span>Заявки
    </a>
  </div>`;
}

function accessDenied(message) {
  app.innerHTML = `
    <div class="access-denied">
      <div class="code">403</div>
      <p style="color:var(--text-dim); font-family: var(--font-mono); font-size:13px;">${esc(message || 'Доступ только для сотрудников агентства')}</p>
    </div>`;
}

// --- Dashboard ---
async function renderDashboard() {
  setBack(false);
  if (tg) tg.MainButton.hide();
  app.innerHTML = `
    <div class="hazard-bar"></div>
    <div class="admin-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="min-width:0;">
        <div class="eyebrow" style="font-family:var(--font-mono);font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:2px;">Admin</div>
        <h1 style="font-family:var(--font-display);text-transform:uppercase;font-size:clamp(20px, 6vw, 26px);margin:4px 0 0;">LOVEINASIA</h1>
      </div>
      <a href="#/admins" class="btn small outline" style="white-space:nowrap;">👤 Сотрудники</a>
    </div>
    <div class="stat-row" id="stats">
      <div class="stat-card skeleton" style="height:60px;"></div>
      <div class="stat-card skeleton" style="height:60px;"></div>
    </div>
    <div class="section-title">Последние заявки</div>
    <div id="recent"></div>
    ${bottomNav('dash')}
  `;
  try {
    const s = await api('/summary');
    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><div class="n">${s.modelsCount}</div><div class="l">Моделей</div></div>
      <div class="stat-card"><div class="n">${s.newBookings}</div><div class="l">Новых заявок</div></div>
    `;
    document.getElementById('recent').innerHTML = s.recentBookings.length ? s.recentBookings.map(bookingRow).join('') : `<div class="empty-state">Заявок пока нет</div>`;
    bindBookingActions(document.getElementById('recent'));
  } catch (e) {
    if (e.message.includes('forbidden') || e.message.includes('администратор')) return accessDenied(e.message);
    app.innerHTML += `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

function bookingRow(b) {
  const [label, cls] = STATUS_LABEL[b.status] || [b.status, 'status-new'];
  return `
    <div class="admin-list-item" style="flex-direction:column; align-items:stretch;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <span class="name" style="font-size:15px;">${esc(b.model_name || 'Общий запрос')}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="status-badge ${cls}">${label}</span>
          <button class="icon-btn-danger" data-delete-booking="${b.id}" title="Удалить заявку">🗑</button>
        </div>
      </div>
      <div class="sub">${esc(b.client_name)}${b.client_username ? ' · @' + esc(b.client_username) : ''}${b.client_phone ? ' · ' + esc(b.client_phone) : ''}</div>
      <div class="sub">${b.shoot_date ? 'Дата: ' + esc(b.shoot_date) : ''}</div>
      ${b.client_relevance === 'not_actual' ? `<div class="sub" style="color:var(--accent); font-weight:700;">⚠️ Клиент отметил как неактуальную — можно не связываться</div>` : ''}
      ${b.status === 'new' ? `
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn small ghost-acid" data-act="confirm" data-id="${b.id}">Подтвердить</button>
          <button class="btn small ghost-danger" data-act="decline" data-id="${b.id}">Отклонить</button>
        </div>` : `
        <div style="margin-top:8px;">
          <button class="btn small outline" data-act="done" data-id="${b.id}" ${b.status === 'done' ? 'disabled' : ''}>Отметить как проведена</button>
        </div>`}
      <div style="margin-top:8px;">
        <button class="btn small outline" data-msg-toggle="${b.id}">✉️ Написать клиенту</button>
      </div>
      <div id="compose-${b.id}" style="display:none; margin-top:8px;">
        <textarea id="msgtext-${b.id}" rows="2" placeholder="Текст сообщения — придёт клиенту от бота" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:8px 10px; border-radius:var(--radius); font-family:var(--font-body); font-size:16px;"></textarea>
        <div id="msgstatus-${b.id}" style="font-family:var(--font-mono); font-size:11px; margin-top:4px;"></div>
        <button class="btn small full" style="margin-top:6px;" data-msg-send="${b.id}">Отправить</button>
      </div>
    </div>`;
}

function showAlert(text) {
  if (tg && tg.showAlert) tg.showAlert(text);
  else alert(text);
}

function bindBookingActions(container) {
  container.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = async () => {
      const action = btn.dataset.act;
      const status = { confirm: 'confirmed', decline: 'declined', done: 'done' }[action];
      btn.disabled = true;
      try {
        await api(`/bookings/${btn.dataset.id}/status`, { method: 'POST', body: { status } });
        tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success');
        if (action === 'confirm') {
          showAlert('Заявка подтверждена. Не забудьте связаться с клиентом — используйте кнопку «✉️ Написать клиенту» или его контакт в заявке.');
        }
        router();
      } catch (e) {
        alert(e.message);
        btn.disabled = false;
      }
    };
  });

  container.querySelectorAll('[data-msg-toggle]').forEach(btn => {
    btn.onclick = () => {
      const box = document.getElementById(`compose-${btn.dataset.msgToggle}`);
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    };
  });

  container.querySelectorAll('[data-delete-booking]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить заявку безвозвратно?')) return;
      btn.disabled = true;
      try {
        await api(`/bookings/${btn.dataset.deleteBooking}/delete`, { method: 'POST' });
        router();
      } catch (e) {
        alert(e.message);
        btn.disabled = false;
      }
    };
  });

  container.querySelectorAll('[data-msg-send]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.msgSend;
      const textarea = document.getElementById(`msgtext-${id}`);
      const statusEl = document.getElementById(`msgstatus-${id}`);
      const text = textarea.value.trim();
      if (!text) { statusEl.textContent = 'Введите текст'; statusEl.style.color = 'var(--accent)'; return; }
      btn.disabled = true;
      statusEl.textContent = 'Отправка...';
      statusEl.style.color = 'var(--text-dim)';
      try {
        await api(`/bookings/${id}/message`, { method: 'POST', body: { text } });
        statusEl.textContent = 'Отправлено ✓';
        statusEl.style.color = 'var(--acid)';
        textarea.value = '';
        tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success');
      } catch (e) {
        statusEl.textContent = e.message;
        statusEl.style.color = 'var(--accent)';
      } finally {
        btn.disabled = false;
      }
    };
  });
}

// --- Bookings ---
let bookingsFilter = 'all';
async function renderBookings() {
  setBack(false);
  if (tg) tg.MainButton.hide();
  app.innerHTML = `
    <div class="admin-header"><h1 style="font-family:var(--font-display);text-transform:uppercase;font-size:24px;margin:0;">Заявки</h1></div>
    <div class="filter-row">
      ${['all', 'new', 'confirmed', 'declined', 'done'].map(s => `<span data-s="${s}" class="${s === bookingsFilter ? 'active' : ''}">${{ all: 'Все', new: 'Новые', confirmed: 'Подтверждены', declined: 'Отклонены', done: 'Проведены' }[s]}</span>`).join('')}
    </div>
    <div id="list" style="padding: 8px 16px;">
      <div class="skeleton" style="height:100px;border-radius:3px;"></div>
    </div>
    ${bottomNav('bookings')}
  `;
  document.querySelectorAll('.filter-row span').forEach(el => { el.onclick = () => { bookingsFilter = el.dataset.s; renderBookings(); }; });

  try {
    const { bookings } = await api(`/bookings?status=${bookingsFilter}`);
    const list = document.getElementById('list');
    list.innerHTML = bookings.length ? bookings.map(bookingRow).join('') : `<div class="empty-state">Нет заявок в этом статусе</div>`;
    bindBookingActions(list);
  } catch (e) {
    if (e.message.includes('forbidden')) return accessDenied(e.message);
    document.getElementById('list').innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

// --- Models list ---
async function renderModels() {
  setBack(false);
  if (tg) tg.MainButton.hide();
  app.innerHTML = `
    <div class="admin-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <h1 style="font-family:var(--font-display);text-transform:uppercase;font-size:24px;margin:0;">Модели</h1>
      <a class="btn small" href="#/models/new">+ Добавить</a>
    </div>
    <div id="list"><div class="skeleton" style="height:70px;margin:16px;border-radius:3px;"></div></div>
    ${bottomNav('models')}
  `;
  try {
    const { models } = await api('/models');
    const list = document.getElementById('list');
    list.innerHTML = models.length ? models.map(m => `
      <div class="admin-list-item">
        <img src="${m.photo_main || 'https://placehold.co/100x140/1a1a1d/666?text=--'}">
        <div>
          <div class="name">${esc(m.name)}</div>
          <div class="sub">${m.city ? esc(m.city) + ' · ' : ''}${{ active: 'Активна', coming_soon: 'Скоро доступна', hidden: 'Неактивна' }[m.status] || m.status}${Number(m.featured) === 1 ? ' · ⭐ Топ' : ''}</div>
        </div>
        <div class="actions">
          <a class="btn small outline" href="#/models/${m.id}/edit">Изм.</a>
        </div>
      </div>
    `).join('') : `<div class="empty-state">Моделей пока нет</div>`;
  } catch (e) {
    if (e.message.includes('forbidden')) return accessDenied(e.message);
    document.getElementById('list').innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

// --- Model form ---
async function renderModelForm(id) {
  setBack(true, '#/models');
  const isEdit = !!id;
  let model = { name: '', category: 'women', height: '', bust: '', weight: '', age: '', city: '', nationality: '', services: '', services_extra: '', price: '', bio: '', status: 'active', featured: 0, photo_main: null, photos: [] };

  app.innerHTML = `<div class="detail-body"><div class="skeleton" style="height:200px;border-radius:3px;"></div></div>`;

  if (isEdit) {
    try {
      const r = await api(`/models/${id}`);
      model = r.model;
    } catch (e) {
      return accessDenied(e.message);
    }
  }

  const CITIES = ['Нячанг', 'Дананг', 'Фукок', 'Бангкок'];

  app.innerHTML = `
    <div class="detail-body">
      <div class="ticket">
        <div class="ticket-head"><span>${isEdit ? 'Редактирование' : 'Новая модель'}</span><span class="stamp">${isEdit ? '#' + id : 'NEW'}</span></div>
        <div id="formError"></div>

        <div class="field"><label>Имя</label><input id="f_name" value="${esc(model.name)}"></div>
        <div class="field-row">
          <div class="field"><label>Рост, см</label><input id="f_height" type="number" value="${model.height || ''}"></div>
          <div class="field"><label>Вес, кг</label><input id="f_weight" type="number" value="${model.weight || ''}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Возраст</label><input id="f_age" type="number" value="${model.age || ''}"></div>
          <div class="field"><label>Грудь</label><input id="f_bust" type="number" value="${model.bust || ''}"></div>
        </div>
        <div class="field"><label>Город</label>
          <select id="f_city">
            <option value="">Не выбран</option>
            ${CITIES.map(c => `<option value="${c}" ${model.city === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Национальность</label><input id="f_nationality" type="text" value="${esc(model.nationality || '')}" placeholder="Например, Россия"></div>
        <div class="field"><label>Стоимость, VND</label><input id="f_price" type="number" step="1000" value="${model.price || ''}" placeholder="1500000"></div>
        <div class="field"><label>Основные услуги</label><textarea id="f_services" rows="3" placeholder="Впишите вручную, каждую услугу с новой строки">${esc(model.services || '')}</textarea></div>
        <div class="field"><label>Дополнительные услуги</label><textarea id="f_services_extra" rows="3" placeholder="Впишите вручную, каждую услугу с новой строки">${esc(model.services_extra || '')}</textarea></div>
        <div class="field"><label>О модели</label><textarea id="f_bio" rows="3">${esc(model.bio)}</textarea></div>
        <div class="field"><label>Статус</label>
          <select id="f_status">
            <option value="active" ${model.status === 'active' ? 'selected' : ''}>Активна</option>
            <option value="coming_soon" ${model.status === 'coming_soon' ? 'selected' : ''}>Скоро доступна</option>
            <option value="hidden" ${model.status === 'hidden' ? 'selected' : ''}>Неактивна</option>
          </select>
        </div>
        <div class="field">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input id="f_featured" type="checkbox" style="width:16px; height:16px;" ${Number(model.featured) === 1 ? 'checked' : ''}>
            <span style="text-transform:none; letter-spacing:normal; font-size:13px;">Топ-модель (выделяется бейджем и поднимается в каталоге)</span>
          </label>
        </div>

        <div class="field">
          <label>Главное фото</label>
          ${model.photo_main ? `<img class="photo-preview" src="${model.photo_main}" style="margin-bottom:8px;">` : ''}
          <input id="f_photo_main" type="file" accept="image/png,image/jpeg,image/webp">
        </div>
        <div class="field">
          <label>Доп. фото (можно несколько)</label>
          ${model.photos && model.photos.length ? `<div class="photo-upload-row" style="margin-bottom:8px;">${model.photos.map(p => `<img class="photo-preview" src="${p}">`).join('')}</div>` : ''}
          <input id="f_photos" type="file" accept="image/png,image/jpeg,image/webp" multiple>
        </div>

        <div style="display:flex; gap:10px; margin-top: 16px;">
          <button class="btn full" id="saveBtn">${isEdit ? 'Сохранить' : 'Создать'}</button>
        </div>
        ${isEdit ? `<button class="btn full ghost-danger" id="deleteBtn" style="margin-top:10px;">Удалить модель</button>` : ''}
      </div>
    </div>
  `;

  document.getElementById('saveBtn').onclick = async () => {
    const fd = new FormData();
    fd.append('name', document.getElementById('f_name').value.trim());
    fd.append('category', 'women');
    fd.append('height', document.getElementById('f_height').value);
    fd.append('weight', document.getElementById('f_weight').value);
    fd.append('age', document.getElementById('f_age').value);
    fd.append('bust', document.getElementById('f_bust').value);
    fd.append('city', document.getElementById('f_city').value);
    fd.append('nationality', document.getElementById('f_nationality').value.trim());
    fd.append('price', document.getElementById('f_price').value.trim());
    fd.append('services', document.getElementById('f_services').value.trim());
    fd.append('services_extra', document.getElementById('f_services_extra').value.trim());
    fd.append('bio', document.getElementById('f_bio').value.trim());
    fd.append('status', document.getElementById('f_status').value);
    fd.append('featured', document.getElementById('f_featured').checked ? '1' : '0');

    const mainFile = document.getElementById('f_photo_main').files[0];
    if (mainFile) fd.append('photo_main', mainFile);
    Array.from(document.getElementById('f_photos').files).forEach(f => fd.append('photos', f));

    if (!fd.get('name')) {
      document.getElementById('formError').innerHTML = `<div class="alert error">Укажите имя</div>`;
      return;
    }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.textContent = 'Сохранение...';
    try {
      if (isEdit) await api(`/models/${id}`, { method: 'PUT', body: fd, isForm: true });
      else await api('/models', { method: 'POST', body: fd, isForm: true });
      window.location.hash = '#/models';
    } catch (e) {
      document.getElementById('formError').innerHTML = `<div class="alert error">${esc(e.message)}</div>`;
      btn.disabled = false; btn.textContent = isEdit ? 'Сохранить' : 'Создать';
    }
  };

  if (isEdit) {
    document.getElementById('deleteBtn').onclick = async () => {
      if (!confirm('Удалить модель безвозвратно?')) return;
      try {
        await api(`/models/${id}/delete`, { method: 'POST' });
        window.location.hash = '#/models';
      } catch (e) { alert(e.message); }
    };
  }
}

async function renderAdmins() {
  setBack(true, '#/');
  if (tg) tg.MainButton.hide();
  app.innerHTML = `
    <div class="admin-header"><h1 style="font-family:var(--font-display);text-transform:uppercase;font-size:24px;margin:0;">Сотрудники</h1></div>
    <div class="detail-body">
      <div class="ticket">
        <div class="ticket-head"><span>Добавить доступ</span><span class="stamp">Admin</span></div>
        <div id="addAdminError"></div>
        <div class="field">
          <label>Telegram ID сотрудника</label>
          <input id="newAdminId" type="text" inputmode="numeric" placeholder="Например, 7481918197">
        </div>
        <div class="field">
          <label>Имя (по желанию, для себя)</label>
          <input id="newAdminName" type="text" placeholder="Как зовут коллегу">
        </div>
        <button class="btn full" id="addAdminBtn">Добавить</button>
        <p style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); margin-top:12px; line-height:1.6;">
          Как узнать ID: пусть коллега напишет боту <b>/admin</b> — если доступа ещё нет, бот сам покажет его Telegram ID и попросит переслать его вам.
        </p>
      </div>
    </div>
    <div class="section-title">Текущий доступ</div>
    <div id="adminsList"><div class="skeleton" style="height:60px;margin:16px;border-radius:3px;"></div></div>
  `;

  document.getElementById('addAdminBtn').onclick = async () => {
    const telegram_id = document.getElementById('newAdminId').value.trim();
    const name = document.getElementById('newAdminName').value.trim();
    const btn = document.getElementById('addAdminBtn');
    btn.disabled = true; btn.textContent = 'Добавляем...';
    try {
      await api('/admins', { method: 'POST', body: { telegram_id, name } });
      renderAdmins();
    } catch (e) {
      document.getElementById('addAdminError').innerHTML = `<div class="alert error">${esc(e.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Добавить';
    }
  };

  try {
    const { admins, currentAdminId } = await api('/admins');
    const list = document.getElementById('adminsList');
    list.innerHTML = admins.map(a => `
      <div class="admin-list-item">
        <div>
          <div class="name">${esc(a.name || 'Без имени')}${a.telegram_id === currentAdminId ? ' (вы)' : ''}</div>
          <div class="sub">ID: ${esc(a.telegram_id)}</div>
        </div>
        <div class="actions">
          ${a.telegram_id === currentAdminId ? '' : `<button class="btn small ghost-danger" data-remove-admin="${a.id}">Убрать</button>`}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-remove-admin]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Убрать доступ этому сотруднику?')) return;
        try {
          await api(`/admins/${btn.dataset.removeAdmin}/delete`, { method: 'POST' });
          renderAdmins();
        } catch (e) {
          showAlert(e.message);
        }
      };
    });
  } catch (e) {
    if (e.message.includes('forbidden')) return accessDenied(e.message);
    document.getElementById('adminsList').innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

function router() {
  const hash = window.location.hash.replace(/^#/, '') || '/';

  if (hash === '/') return renderDashboard();
  if (hash === '/models') return renderModels();
  if (hash === '/models/new') return renderModelForm(null);
  if (hash === '/bookings') return renderBookings();
  if (hash === '/admins') return renderAdmins();

  let m = hash.match(/^\/models\/(\d+)\/edit$/);
  if (m) return renderModelForm(m[1]);

  renderDashboard();
}

window.addEventListener('hashchange', router);
router();
