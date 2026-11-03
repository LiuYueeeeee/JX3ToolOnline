(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const role = document.body.dataset.role;
  const admin = role === 'admin';
  const params = new URLSearchParams(location.search);
  const localDemo = location.protocol === 'file:' || params.get('demo') === '1';
  const GH_CONFIG = window.TZSN_CONFIG || {};
  const GH_OWNER = String(GH_CONFIG.OWNER || '').trim();
  const GH_REPO = String(GH_CONFIG.REPO || '').trim();
  const GH_BRANCH = String(GH_CONFIG.BRANCH || 'main').trim();
  const GH_DATA_PATH = String(GH_CONFIG.DATA_PATH || 'site/data.json').replace(/^\/+|\/+$/g, '');
  const LOCAL_KEY = 'TZSN_VIDEO_DELIVERY_V4';
  const TOKEN_KEY = 'TZSN_ADMIN_TOKEN';
  const state = {
    records: [],
    selectedId: null,
    editing: null,
    editingNum: null,
    search: '',
    busy: false,
    authorized: !admin
  };

  const shapes = {
    film: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    list: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    play: '<path d="m9 6 10 6-10 6z"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>'
  };

  const ico = (name, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || ''}</svg>`;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const num3 = (number) => String(number).padStart(3, '0');
  const recordTime = (record) => Number(record.updatedAt || record.createdAt) || 0;
  const secs = (value) => {
    const seconds = Math.max(0, Number(value) || 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = Math.floor(seconds % 60);
    return hours
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  };
  const stamp = (value) => {
    const date = new Date(Number(value) || Date.now());
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const generateId = () => globalThis.crypto?.randomUUID?.() || `vid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function normalizePan(text) {
    const source = String(text || '');
    const match = source.match(/https?:\/\/(?:pan|yun)\.baidu\.com\/[^\s<>"'，；;]+/i);
    if (!match) return '';
    try {
      const url = new URL(match[0].replace(/[，。,.）)]+$/g, ''));
      if (!['pan.baidu.com', 'yun.baidu.com'].includes(url.hostname)) return '';
      if (!(/\/s\/|\/share\/(?:init|link)/.test(url.pathname))) return '';
      url.protocol = 'https:';
      const code = source.match(/(?:提取码|访问码|密码)\s*[：:]\s*([a-zA-Z0-9]{4})/);
      if (code && !url.searchParams.has('pwd')) url.searchParams.set('pwd', code[1]);
      return url.href;
    } catch {
      return '';
    }
  }

  function validDirect(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2800);
  }

  function demoData() {
    try {
      const value = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveDemo(records) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  }

  async function demoApi(path, options = {}) {
    let records = demoData();
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    if (path === '/auth') return { authorized: true, demo: true };
    if (path === '/login') return { authorized: true, demo: true };
    if (path === '/logout') return { ok: true };
    if (path === '/videos' && method === 'GET') return { records };
    const numberMatch = path.match(/^\/videos\/no\/(\d{1,3})$/);
    if (numberMatch && method === 'GET') return { records: records.filter((record) => record.num === Number(numberMatch[1])) };
    if (path === '/videos' && method === 'POST') {
      const record = { ...body, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() };
      records.push(record);
      saveDemo(records);
      return { record };
    }
    const idMatch = path.match(/^\/videos\/([^/]+)$/);
    if (idMatch && method === 'PUT') {
      const index = records.findIndex((record) => record.id === decodeURIComponent(idMatch[1]));
      if (index < 0) throw new Error('记录不存在');
      records[index] = { ...records[index], ...body, updatedAt: Date.now() };
      saveDemo(records);
      return { record: records[index] };
    }
    if (idMatch && method === 'DELETE') {
      records = records.filter((record) => record.id !== decodeURIComponent(idMatch[1]));
      saveDemo(records);
      return { ok: true };
    }
    if (path === '/admin/export') return { records };
    if (path === '/admin/import' && method === 'POST') {
      let imported = 0;
      for (const record of body.records || []) {
        if (!records.some((item) => item.id === record.id)) {
          records.push({ ...record, id: record.id || generateId(), createdAt: record.createdAt || Date.now(), updatedAt: record.updatedAt || Date.now() });
          imported++;
        }
      }
      saveDemo(records);
      return { imported };
    }
    throw new Error('本地演示不支持该操作');
  }

  function githubConfigured() {
    return !!(GH_OWNER && GH_REPO && !GH_OWNER.includes('YOUR-') && !GH_REPO.includes('YOUR-'));
  }

  function githubContentsEndpoint() {
    const path = GH_DATA_PATH.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return `/repos/${encodeURIComponent(GH_OWNER)}/${encodeURIComponent(GH_REPO)}/contents/${path}?ref=${encodeURIComponent(GH_BRANCH)}`;
  }

  function decodeBase64Utf8(value) {
    const binary = atob(String(value || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  async function githubRequest(endpoint, token, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body) headers.set('Content-Type', 'application/json');
    let response;
    try {
      response = await fetch(`https://api.github.com${endpoint}`, { ...options, headers, cache: 'no-store' });
    } catch {
      throw new Error('无法连接 GitHub API，请检查网络或稍后重试');
    }
    let data = {};
    try { data = await response.json(); } catch { /* GitHub may return an empty response */ }
    if (!response.ok) {
      const error = new Error(data.message || `GitHub API 请求失败（${response.status}）`);
      error.status = response.status;
      if (response.status === 401) error.message = 'GitHub Token 无效或已过期';
      if (response.status === 403) error.message = 'GitHub 拒绝访问：请检查 Token 的 Contents 读写权限或 API 额度';
      if (response.status === 404) error.message = '找不到仓库或数据文件，请检查仓库名称、分支和 DATA_PATH';
      throw error;
    }
    return data;
  }

  async function readGithubFile(token) {
    const file = await githubRequest(githubContentsEndpoint(), token);
    if (!file.content || file.encoding !== 'base64') throw new Error('data.json 内容为空或超过 GitHub Contents API 可读取范围');
    let parsed;
    try { parsed = JSON.parse(decodeBase64Utf8(file.content)); }
    catch { throw new Error('仓库中的 data.json 不是有效 JSON，请先修复文件内容'); }
    return { sha: file.sha, records: Array.isArray(parsed.records) ? parsed.records : [] };
  }

  async function readRecords() {
    if (admin) {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) throw new Error('请先使用 GitHub Token 登录管理端');
      return readGithubFile(token);
    }
    let response;
    try {
      response = await fetch(`./data.json?ts=${Date.now()}`, { cache: 'no-store' });
    } catch {
      throw new Error('无法读取 GitHub Pages 中的 data.json，请检查网站是否已部署');
    }
    if (!response.ok) throw new Error(`读取数据失败（${response.status}），请确认 site/data.json 已提交并完成 Pages 部署`);
    let parsed;
    try { parsed = await response.json(); }
    catch { throw new Error('data.json 格式错误，请检查 JSON 文件'); }
    return { sha: null, records: Array.isArray(parsed.records) ? parsed.records : [] };
  }

  async function writeGithubFile(records, sha, token) {
    const payload = JSON.stringify({ schema: 4, updatedAt: Date.now(), records }, null, 2) + '\n';
    const body = {
      message: `Update video delivery records (${new Date().toISOString()})`,
      content: encodeBase64Utf8(payload),
      branch: GH_BRANCH
    };
    if (sha) body.sha = sha;
    try {
      await githubRequest(githubContentsEndpoint().split('?')[0], token, { method: 'PUT', body: JSON.stringify(body) });
    } catch (error) {
      if (error.status === 409 || error.status === 422) {
        throw new Error('数据文件刚刚被其他操作修改，请刷新页面后重新提交');
      }
      throw error;
    }
  }

  async function validateGithubToken(token) {
    if (!githubConfigured()) throw new Error('尚未配置 GitHub 仓库。请先修改 site/config.js 中的 OWNER 和 REPO');
    if (!token || token.length < 10) throw new Error('请输入 GitHub Personal Access Token');
    const repo = await githubRequest(`/repos/${encodeURIComponent(GH_OWNER)}/${encodeURIComponent(GH_REPO)}`, token);
    if (repo.permissions && repo.permissions.push === false) throw new Error('当前 Token 对该仓库没有写入权限，请授予 Contents: Read and write');
    await readGithubFile(token);
    return true;
  }

  async function api(path, options = {}) {
    if (localDemo) return demoApi(path, options);
    if (!githubConfigured()) throw new Error('尚未配置 GitHub 仓库。请修改 site/config.js 中的 OWNER、REPO 和 DATA_PATH');
    const method = String(options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};

    if (path === '/auth') {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) return { authorized: false };
      try { await validateGithubToken(token); return { authorized: true }; }
      catch { sessionStorage.removeItem(TOKEN_KEY); return { authorized: false }; }
    }
    if (path === '/login' && method === 'POST') {
      await validateGithubToken(String(body.password || '').trim());
      sessionStorage.setItem(TOKEN_KEY, String(body.password || '').trim());
      return { authorized: true };
    }
    if (path === '/logout') {
      sessionStorage.removeItem(TOKEN_KEY);
      return { ok: true };
    }

    if (path === '/videos' && method === 'GET') {
      const data = await readRecords();
      return { records: data.records };
    }
    const numberMatch = path.match(/^\/videos\/no\/(\d{1,3})$/);
    if (numberMatch && method === 'GET') {
      const data = await readRecords();
      return { records: data.records.filter((record) => Number(record.num) === Number(numberMatch[1])) };
    }

    if (!admin) throw new Error('客户端为只读模式，请在管理端执行修改');
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { showLogin('管理会话已失效，请重新输入 GitHub Token'); throw new Error('请先登录管理端'); }

    if (path === '/admin/export' && method === 'GET') {
      const data = await readGithubFile(token);
      return { records: data.records };
    }
    if (path === '/videos' && method === 'POST') {
      const data = await readGithubFile(token);
      const now = Date.now();
      const record = { ...body, id: generateId(), createdAt: now, updatedAt: now };
      data.records.push(record);
      await writeGithubFile(data.records, data.sha, token);
      return { record };
    }
    const idMatch = path.match(/^\/videos\/([^/]+)$/);
    if (idMatch && method === 'PUT') {
      const data = await readGithubFile(token);
      const id = decodeURIComponent(idMatch[1]);
      const index = data.records.findIndex((record) => record.id === id);
      if (index < 0) throw new Error('记录不存在');
      data.records[index] = { ...data.records[index], ...body, updatedAt: Date.now() };
      await writeGithubFile(data.records, data.sha, token);
      return { record: data.records[index] };
    }
    if (idMatch && method === 'DELETE') {
      const data = await readGithubFile(token);
      const id = decodeURIComponent(idMatch[1]);
      const next = data.records.filter((record) => record.id !== id);
      if (next.length === data.records.length) throw new Error('记录不存在');
      await writeGithubFile(next, data.sha, token);
      return { ok: true };
    }
    if (path === '/admin/import' && method === 'POST') {
      const data = await readGithubFile(token);
      let imported = 0;
      for (const record of body.records || []) {
        if (!data.records.some((item) => item.id === record.id)) {
          data.records.push({ ...record, id: record.id || generateId(), createdAt: record.createdAt || Date.now(), updatedAt: record.updatedAt || Date.now() });
          imported++;
        }
      }
      if (imported) await writeGithubFile(data.records, data.sha, token);
      return { imported };
    }
    throw new Error('不支持的操作');
  }

  function latest(records) {
    return [...records].sort((a, b) => recordTime(b) - recordTime(a) || String(b.id).localeCompare(String(a.id)))[0] || null;
  }

  function sorted(records) {
    const priority = { '终稿': 3, '初稿': 2, '演示稿': 1 };
    return [...records].sort((a, b) => (priority[b.version] || 0) - (priority[a.version] || 0) || recordTime(b) - recordTime(a) || String(b.id).localeCompare(String(a.id)));
  }

  function preferred(records, number) {
    if (number === 0) return latest(records.filter((record) => record.version === '演示稿')) || latest(records);
    return latest(records.filter((record) => record.version === '终稿')) || latest(records.filter((record) => record.version === '初稿')) || latest(records);
  }

  function toGroups() {
    const groups = new Map();
    for (const record of state.records) {
      if (!Number.isInteger(Number(record.num)) || Number(record.num) < 0 || Number(record.num) > 100) continue;
      const number = Number(record.num);
      if (!groups.has(number)) groups.set(number, []);
      groups.get(number).push(record);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, records]) => ({ number, records: sorted(records), preferred: preferred(records, number) }));
  }

  function finalRecord(group) {
    return latest(group.records.filter((record) => record.version === '终稿'));
  }

  async function reload() {
    const data = await api('/videos');
    state.records = data.records || [];
    renderDashboard();
  }

  function renderDashboard() {
    const groups = toGroups();
    const countedGroups = groups.filter((group) => group.number >= 1 && group.number <= 100 && !!finalRecord(group));
    const totalDuration = countedGroups.reduce((sum, group) => sum + (Number(finalRecord(group).duration) || 0), 0);
    const count = countedGroups.length;
    const percentage = Math.min(count, 100);

    $('#count-num').textContent = count;
    $('#time-num').textContent = totalDuration.toLocaleString('zh-CN');
    $('#time-foot').textContent = `合计 ${secs(totalDuration)} · ${totalDuration}秒`;
    $('#done-num').textContent = count;
    $('#progress-percent').textContent = `${percentage}%`;
    $('#progress-fill').style.width = `${percentage}%`;

    const query = state.search.toLowerCase().trim();
    const visible = groups.filter((group) => !query ||
      String(group.number).includes(query) ||
      num3(group.number).includes(query) ||
      group.records.some((record) =>
        (record.topic || '').toLowerCase().includes(query) ||
        String(record.week).includes(query) ||
        (record.shareUrl || '').toLowerCase().includes(query) ||
        `no.${num3(group.number)}`.includes(query)
      )
    );
    $('#result-left').textContent = `显示 ${visible.length} 个编号 · 已完成 ${count} / 100 个终稿`;

    $('#video-list').innerHTML = visible.length ? visible.map((group) => {
      const record = group.preferred;
      const recordCount = group.records.length;
      const note = group.number === 0
        ? '演示稿 · 不计入数量及总时长'
        : record.version === '终稿'
          ? `${recordCount} 条版本记录 · 终稿已提交`
          : `${recordCount} 条版本记录 · 尚无终稿`;
      const versionClass = record.version === '终稿' ? 'version-final' : record.version === '演示稿' ? 'version-demo' : 'version-draft';
      return `<article class="video-card" tabindex="0" role="link" aria-label="打开 NO.${num3(group.number)} 视频详情" data-num="${group.number}">
        <div class="thumb"><div class="thumb-art">${ico('film', 30)}<span>视频记录</span></div><span class="thumb-count">第 ${Number(record.week) || 1} 周</span></div>
        <div class="video-body"><div class="video-overline"><span class="video-seq">NO. ${num3(group.number)}</span><span class="status ${versionClass}">${escape(record.version)}</span></div>
        <h3 class="video-title">${escape(record.topic)}</h3><p class="video-note">${escape(note)}</p>
        <div class="video-bottom"><div class="duration-chip">${ico('clock', 14)} ${secs(record.duration)}<span> · ${Number(record.duration) || 0} 秒</span></div><span class="card-chevron">${ico('chevron')}</span></div></div></article>`;
    }).join('') : `<div class="empty"><div class="empty-illustration">${ico('film', 40)}</div><h3>${query ? '未找到对应视频' : '暂无视频记录'}</h3><p>${query ? '尝试搜索其他关键词' : '管理端登记视频后，客户端将按序号展示'}</p>${admin && !query ? '<button class="empty-btn" data-empty-add>登记第一个视频</button>' : ''}</div>`;
  }

  function showLogin(message = '') {
    state.authorized = false;
    $('#auth-view').hidden = false;
    $('#app').hidden = true;
    $('#bottom-dock')?.setAttribute('hidden', '');
    if (message) $('#login-error').textContent = message;
  }

  function showApp() {
    state.authorized = true;
    $('#auth-view').hidden = true;
    $('#app').hidden = false;
    if (admin) $('#bottom-dock').hidden = false;
    if (localDemo) $('#demo-ribbon').hidden = false;
  }

  async function login(event) {
    event.preventDefault();
    const button = $('#login-form button');
    button.disabled = true;
    $('#login-error').textContent = '';
    try {
      const result = await api('/login', { method: 'POST', body: JSON.stringify({ password: $('#admin-password').value }) });
      if (result.token) sessionStorage.setItem(TOKEN_KEY, result.token);
      $('#admin-password').value = '';
      showApp();
      await reload();
      await renderRoute();
    } catch (error) {
      $('#login-error').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function logout() {
    try { await api('/logout', { method: 'POST', body: '{}' }); } catch { /* token is removed locally either way */ }
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
  }

  async function renderRoute() {
    if (!state.authorized) return;
    const match = location.hash.match(/^#video\/(\d{1,3})$/);
    if (match && Number(match[1]) <= 100) {
      $('#dashboard').hidden = true;
      $('#detail-page').hidden = false;
      $('#hero').hidden = true;
      if (admin) $('#bottom-dock').hidden = true;
      await showDetail(Number(match[1]));
    } else {
      $('#hero').hidden = false;
      $('#dashboard').hidden = false;
      $('#detail-page').hidden = true;
      if (admin) $('#bottom-dock').hidden = false;
      renderDashboard();
    }
  }

  async function showDetail(number) {
    const box = $('#detail-body');
    box.innerHTML = '<div class="loading">正在读取该序号的所有上传记录…</div>';
    try {
      const data = await api(`/videos/no/${number}`);
      const records = data.records || [];
      if (!records.length) {
        box.innerHTML = '<div class="empty">该序号暂无视频记录</div>';
        return;
      }
      const options = sorted(records);
      if (!options.some((record) => record.id === state.selectedId)) state.selectedId = options[0].id;
      renderDetail(number, options);
    } catch (error) {
      box.innerHTML = `<div class="error-box">${escape(error.message)}</div>`;
    }
  }

  function renderDetail(number, records) {
    const record = records.find((item) => item.id === state.selectedId) || records[0];
    state.selectedId = record.id;
    const versionClass = record.version === '终稿' ? 'version-final' : record.version === '演示稿' ? 'version-demo' : 'version-draft';
    const isDemo = number === 0;
    $('#detail-body').innerHTML = `
      <div class="detail-placeholder"><div>${ico('film', 48)}<span>NO. ${num3(number)}</span></div></div>
      <h1 class="detail-hero-title">${escape(record.topic)}</h1>
      <div class="detail-meta"><span class="meta-pill">NO. ${num3(number)}</span><span class="status ${versionClass}">${escape(record.version)}</span><span class="meta-pill">第 ${Number(record.week) || 1} 周</span><span class="meta-pill">${secs(record.duration)} · ${Number(record.duration) || 0} 秒</span></div>
      <button class="play-primary" id="play-this" ${!(record.shareUrl || record.directUrl) ? 'disabled' : ''}>${ico('play', 21)} 播放当前视频</button>
      <p class="detail-hint">${record.directUrl ? '点击后尝试在网页内播放；如果源站不允许跨域播放，请使用百度网盘分享链接。' : '点击播放后将打开百度网盘分享页面。'}</p>
      <h2 class="detail-section-title">此序号的所有上传记录（${records.length}）</h2>
      <div class="record-list">${records.map((item) => {
        const cls = item.version === '终稿' ? 'version-final' : item.version === '演示稿' ? 'version-demo' : 'version-draft';
        return `<button class="record-row ${item.id === record.id ? 'active' : ''}" data-select="${escape(item.id)}"><span class="status ${cls}">${escape(item.version)}</span><div class="record-row-main"><div class="record-row-title">${escape(item.topic)}</div><span class="record-row-time">${secs(item.duration)} · 第 ${Number(item.week) || 1} 周 · ${stamp(item.updatedAt || item.createdAt)}</span></div>${ico('chevron', 15)}</button>`;
      }).join('')}</div>
      <div class="detail-section-title">当前记录的视频信息</div><div class="detail-text">${escape(record.notes || '暂无备注')}</div>
      <div class="detail-section-title">百度网盘分享地址</div><div class="detail-text detail-link">${record.shareUrl ? `<a href="${escape(record.shareUrl)}" target="_blank" rel="noopener noreferrer">${escape(record.shareUrl)}</a>` : '尚未添加'}</div>
      ${admin ? `<div class="manage-actions"><button id="edit-this">编辑当前记录</button><button id="delete-this" class="delete">删除当前记录</button></div><button class="play-primary" id="add-version">＋ ${isDemo ? '为 NO.000 新增演示稿' : `为 NO.${num3(number)} 新增初稿 / 终稿`}</button>` : ''}
      ${isDemo ? '<p class="detail-hint">NO.000 为演示稿专用编号，不纳入终稿数量、交付进度或累计总时长。</p>' : ''}
    `;
  }

  function playRecord(record) {
    if (record.directUrl) {
      const url = validDirect(record.directUrl);
      if (url) {
        const video = $('#native-player');
        video.src = url;
        $('#video-player').classList.add('open');
        video.load();
        video.play().catch(() => {});
        return;
      }
    }
    if (record.shareUrl) {
      window.open(record.shareUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    toast('当前记录没有可播放链接');
  }

  function closePlayer() {
    const video = $('#native-player');
    video.pause();
    video.removeAttribute('src');
    video.load();
    $('#video-player').classList.remove('open');
  }

  function nextAvailableNumber() {
    const taken = new Set(toGroups().filter((group) => group.number >= 1).map((group) => group.number));
    for (let number = 1; number <= 100; number++) if (!taken.has(number)) return number;
    return 100;
  }

  function syncSequenceMode() {
    const version = $('#video-revision').value;
    const sequence = $('#video-seq');
    const demo = version === '演示稿';
    [...sequence.options].forEach((option) => {
      const number = Number(option.value);
      option.disabled = demo ? number !== 0 : number === 0;
    });
    if (demo) {
      sequence.value = '0';
      sequence.disabled = true;
      $('#seq-hint').textContent = '演示稿编号固定为 NO.000，不参与统计';
    } else {
      if (Number(sequence.value) === 0 || !sequence.value) sequence.value = String(state.editingNum || nextAvailableNumber());
      sequence.disabled = !!state.editing;
      $('#seq-hint').textContent = '下拉滚动选择 NO.001～NO.100';
    }
  }

  function openEditor(record = null, number = null) {
    if (!admin || !state.authorized) return;
    state.editing = record?.id || null;
    state.editingNum = record ? Number(record.num) : null;
    const sequence = $('#video-seq');
    sequence.innerHTML = Array.from({ length: 101 }, (_, index) => `<option value="${index}">NO. ${num3(index)}${index === 0 ? ' · 演示稿专用' : ''}</option>`).join('');

    const selectedNumber = record ? Number(record.num) : number !== null ? Number(number) : nextAvailableNumber();
    const selectedVersion = record?.version || (selectedNumber === 0 ? '演示稿' : '初稿');
    $('#video-revision').value = selectedVersion;
    $('#video-seq').value = String(selectedNumber);

    const revision = $('#video-revision');
    [...revision.options].forEach((option) => {
      option.disabled = !!record && (selectedNumber === 0 ? option.value !== '演示稿' : option.value === '演示稿');
    });
    $('#editor-title').textContent = record ? '编辑本次上传记录' : '登记视频版本';
    $('#video-week').value = record?.week || 1;
    $('#video-topic').value = record?.topic || '';
    $('#video-duration').value = record?.duration || '';
    $('#duration-hint').textContent = record?.duration ? secs(record.duration) : '手动输入总秒数';
    $('#video-url').value = record?.shareUrl || '';
    $('#direct-url').value = record?.directUrl || '';
    $('#video-notes').value = record?.notes || '';
    syncSequenceMode();
    $('#editor-overlay').classList.add('open');
    $('#video-topic').focus({ preventScroll: true });
  }

  function closeEditor() {
    $('#editor-overlay').classList.remove('open');
    state.editing = null;
    state.editingNum = null;
    $('#video-revision').value = '初稿';
    $('#video-seq').disabled = false;
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (state.busy) return;
    const version = $('#video-revision').value;
    const number = Number($('#video-seq').value);
    const duration = Number($('#video-duration').value);
    const week = Number($('#video-week').value);
    const topic = $('#video-topic').value.trim();
    const shareUrl = normalizePan($('#video-url').value);
    const directUrl = $('#direct-url').value.trim();

    if (!['初稿', '终稿', '演示稿'].includes(version)) return toast('请选择稿件类型');
    if (version === '演示稿' ? number !== 0 : !Number.isInteger(number) || number < 1 || number > 100) return toast('演示稿固定为 NO.000，初稿和终稿请选择 NO.001～NO.100');
    if (!topic) return toast('请填写视频主题');
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 2592000) return toast('请输入有效的整数秒数');
    if (!Number.isInteger(week) || week < 1 || week > 999) return toast('请输入有效的交付周次');
    if (!shareUrl) return toast('请输入有效的百度网盘分享链接');
    if (directUrl && !validDirect(directUrl)) return toast('直接播放链接必须是 HTTPS 地址');

    const record = { num: number, topic, version, duration, week, shareUrl, directUrl: directUrl || '', notes: $('#video-notes').value.trim() };
    state.busy = true;
    $('#save-editor').disabled = true;
    try {
      const result = await api(state.editing ? `/videos/${encodeURIComponent(state.editing)}` : '/videos', {
        method: state.editing ? 'PUT' : 'POST',
        body: JSON.stringify(record)
      });
      closeEditor();
      await reload();
      state.selectedId = result.record?.id || null;
      toast('已保存视频记录');
      if (location.hash === `#video/${num3(number)}`) await showDetail(number);
      else if (location.hash.startsWith('#video/')) location.hash = `#video/${num3(number)}`;
      else renderDashboard();
    } catch (error) {
      toast(error.message);
    } finally {
      state.busy = false;
      $('#save-editor').disabled = false;
    }
  }

  async function deleteRecord(record) {
    if (!confirm(`确定删除 NO.${num3(record.num)} 的这条${record.version}记录？\n此操作不可撤销。`)) return;
    try {
      await api(`/videos/${encodeURIComponent(record.id)}`, { method: 'DELETE', body: '{}' });
      state.selectedId = null;
      await reload();
      toast('已删除记录');
      await showDetail(record.num);
    } catch (error) {
      toast(error.message);
    }
  }

  function downloadObject(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function backup() {
    try {
      const data = await api('/admin/export');
      downloadObject({ schema: 4, exportedAt: new Date().toISOString(), records: data.records }, `天旨速能_视频交付备份_${new Date().toISOString().slice(0, 10)}.json`);
      toast('备份已导出');
    } catch (error) {
      toast(error.message);
    }
  }

  function normalizeImported(raw) {
    if (Array.isArray(raw)) raw = { records: raw, schema: 3 };
    const schema = Number(raw.schema || 0);
    if (Array.isArray(raw.records)) {
      return raw.records.map((item) => {
        const version = ['初稿', '终稿', '演示稿'].includes(item.version) ? item.version : item.version === '修改稿' ? '终稿' : '初稿';
        let number = Number(item.num);
        if (version === '演示稿') number = 0;
        else if (schema < 4) number += 1;
        return {
          id: String(item.id || generateId()),
          num: number,
          version,
          topic: String(item.topic || ''),
          duration: Number(item.duration),
          week: Number(item.week || 1),
          shareUrl: String(item.shareUrl || ''),
          directUrl: String(item.directUrl || ''),
          notes: String(item.notes || ''),
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.updatedAt || item.createdAt) || Date.now()
        };
      });
    }
    if (Array.isArray(raw.videos)) {
      return raw.videos.map((item) => {
        const version = item.revision === '演示稿' ? '演示稿' : item.revision === '修改稿' || item.revision === '终稿' ? '终稿' : '初稿';
        return {
          id: `legacy-${String(item.id || generateId()).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 110)}`,
          num: version === '演示稿' ? 0 : Math.max(1, Math.min(100, Number(item.order || 1))),
          version,
          topic: String(item.topic || ''),
          duration: Number(item.durationSec || item.duration),
          week: Number(item.week || 1),
          shareUrl: String(item.shareUrl || ''),
          directUrl: '',
          notes: String(item.notes || ''),
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.createdAt) || Date.now()
        };
      });
    }
    throw new Error('不是有效的视频记录 JSON 文件');
  }

  async function importRecords(raw) {
    const records = normalizeImported(raw);
    if (!records.length) return toast('没有可导入的记录');
    if (!confirm(`准备导入 ${records.length} 条上传记录。\n旧版 NO.000～NO.099 会平移为 NO.001～NO.100；演示稿仍固定 NO.000。确定继续？`)) return;
    const result = await api('/admin/import', { method: 'POST', body: JSON.stringify({ records }) });
    const imported = result.imported;
    await reload();
    toast(`已导入 ${imported} 条记录`);
  }


  function bindEvents() {
    if (admin) {
      $('#login-form').addEventListener('submit', login);
      $('#logout-btn').addEventListener('click', logout);
      $('#add-record').addEventListener('click', () => openEditor());
      $('#close-editor').addEventListener('click', closeEditor);
      $('#cancel-editor').addEventListener('click', closeEditor);
      $('#editor-overlay').addEventListener('click', (event) => { if (event.target.id === 'editor-overlay') closeEditor(); });
      $('#editor-form').addEventListener('submit', saveEditor);
      $('#video-revision').addEventListener('change', syncSequenceMode);
      $('#video-duration').addEventListener('input', (event) => { $('#duration-hint').textContent = event.target.value ? secs(event.target.value) : '手动输入总秒数'; });
      $('#download-backup').addEventListener('click', backup);
      $('#import-file').addEventListener('change', async (event) => {
        try {
          const file = event.target.files?.[0];
          if (file) await importRecords(JSON.parse(await file.text()));
        } catch (error) {
          toast(error.message);
        }
        event.target.value = '';
      });
    }

    $('#video-list').addEventListener('click', (event) => {
      if (event.target.closest('[data-empty-add]')) { if (admin) openEditor(); return; }
      const card = event.target.closest('[data-num]');
      if (card) location.hash = `#video/${num3(Number(card.dataset.num))}`;
    });
    $('#video-list').addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-num]')) {
        event.preventDefault();
        location.hash = `#video/${num3(Number(event.target.closest('[data-num]').dataset.num))}`;
      }
    });
    $('#detail-body').addEventListener('click', async (event) => {
      const select = event.target.closest('[data-select]');
      if (select) {
        state.selectedId = select.dataset.select;
        const match = location.hash.match(/^#video\/(\d{1,3})$/);
        if (match) await showDetail(Number(match[1]));
        return;
      }
      if (event.target.closest('#play-this')) {
        const record = state.records.find((item) => item.id === state.selectedId) || (await api(`/videos/no/${Number(location.hash.split('/')[1])}`)).records?.find((item) => item.id === state.selectedId);
        if (record) playRecord(record);
        return;
      }
      if (!admin) return;
      const current = state.records.find((item) => item.id === state.selectedId);
      if (event.target.closest('#edit-this') && current) openEditor(current);
      if (event.target.closest('#delete-this') && current) await deleteRecord(current);
      if (event.target.closest('#add-version')) {
        const match = location.hash.match(/^#video\/(\d{1,3})$/);
        if (match) openEditor(null, Number(match[1]));
      }
    });

    $('#search-input').addEventListener('input', (event) => {
      state.search = event.target.value;
      $('#clear-search').classList.toggle('visible', !!state.search);
      renderDashboard();
    });
    $('#clear-search').addEventListener('click', () => {
      state.search = '';
      $('#search-input').value = '';
      $('#clear-search').classList.remove('visible');
      renderDashboard();
    });
    $('#back-list').addEventListener('click', () => { location.hash = '#list'; });
    $('#close-player').addEventListener('click', closePlayer);
    $('#video-player').addEventListener('click', (event) => { if (event.target.id === 'video-player') closePlayer(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closePlayer();
        if (admin) closeEditor();
      }
    });
    window.addEventListener('hashchange', renderRoute);
  }

  async function start() {
    const icons = [
      ['#brand-icon', 'film', 20], ['#count-icon', 'list', 15], ['#time-icon', 'clock', 15],
      ['#search-icon', 'search', 18], ['#clear-search', '', 12], ['#plus-icon', 'plus', 22]
    ];
    for (const [selector, name, size] of icons) if ($(selector)) $(selector).innerHTML = name ? ico(name, size) : '✕';
    bindEvents();

    try {
      if (admin) {
        if (localDemo) showApp();
        else {
          const auth = await api('/auth');
          if (auth.authorized) showApp();
          else showLogin();
        }
      } else showApp();

      if (state.authorized) {
        await reload();
        await renderRoute();
      }
    } catch (error) {
      if (admin && !state.authorized) {
        showLogin(error.message);
        return;
      }
      showApp();
      $('#video-list').innerHTML = `<div class="error-box">${escape(error.message)}<p>客户端直接读取 GitHub Pages 的 data.json。请确认 site/data.json 已提交、GitHub Pages 已部署，并检查 config.js 中的仓库配置。</p></div>`;
      toast('加载数据失败');
    }
  }

  start();
})();
