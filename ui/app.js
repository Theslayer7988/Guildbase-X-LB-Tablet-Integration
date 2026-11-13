/* Guildbase app for LB Tablet — styled after the guildbase.gg dashboard */
(() => {
    const PREVIEW = location.protocol === 'file:'; // opened from disk = sample data

    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const state = { init: null, view: 'home', roles: null };

    // ─── helpers ──────────────────────────────────────────────
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const label = (s) => String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const date = (iso) => { const d = iso && new Date(iso); return d && !isNaN(d) ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; };
    function ago(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d)) return '';
        const s = (Date.now() - d.getTime()) / 1000;
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s / 60)} min ago`;
        if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
        const days = Math.floor(s / 86400);
        if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
        if (days < 30) return Math.floor(days / 7) === 1 ? '1 week ago' : `${Math.floor(days / 7)} weeks ago`;
        return date(iso);
    }
    const listOf = (res, ...keys) => {
        const d = res?.data;
        if (Array.isArray(d)) return d;
        for (const k of keys) if (Array.isArray(d?.[k])) return d[k];
        return Array.isArray(d?.data) ? d.data : [];
    };
    const metaOf = (res) => res?.meta || res?.data?.meta || {};

    async function call(name, data = {}) {
        if (PREVIEW) return Mock[name]?.(data) ?? { ok: false, message: 'preview: ' + name };
        try {
            const res = await globalThis.fetchNui(name, data);
            return res && typeof res === 'object' ? res : { ok: false, message: 'Empty response.' };
        } catch (e) {
            return { ok: false, message: 'Could not reach the server.' };
        }
    }
    function waitForBridge() {
        return new Promise((resolve) => {
            const tick = (n) => {
                if (typeof globalThis.fetchNui === 'function' && typeof globalThis.onNuiEvent === 'function') return resolve(true);
                if (n >= 100) return resolve(false);
                setTimeout(() => tick(n + 1), 100);
            };
            tick(0);
        });
    }

    let toastTimer;
    function toast(msg, err = false) {
        const t = $('#toast');
        t.textContent = msg;
        t.classList.toggle('err', err);
        t.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.add('hidden'), 3800);
    }
    const spinner = () => '<div class="spinner"></div>';
    const empty = (title, msg = '') => `<div class="empty"><b>${esc(title)}</b>${esc(msg)}</div>`;
    const errorBox = (res) => empty('Something went wrong', res?.message || '');

    // ─── icons ────────────────────────────────────────────────
    const P = {
        home: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
        doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zm0 0v6h6M8 13h8M8 17h5',
        apply: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zm0 0v6h6M12 18v-6m-3 3h6',
        inbox: 'M4 6h16v12H4zM4 7l8 6 8-6',
        members: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
        roles: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
        exams: 'M12 3 2 8l10 5 10-5-10-5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5',
        certs: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-3.5 4.5L7 23l5-2 5 2-1.5-3.5',
        clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4l3 2',
        check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-3.5-9 2.5 2.5 4.5-5',
        xc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-3-12 6 6m0-6-6 6',
        flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
        x: 'M6 6l12 12M18 6 6 18',
        tick: 'M5 12.5 10 17 19 7',
        move: 'M7 7h13m0 0-4-4m4 4-4 4M17 17H4m0 0 4 4m-4-4 4-4',
        undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
        hand: 'M7 11V6a1.5 1.5 0 0 1 3 0v4m0-5a1.5 1.5 0 0 1 3 0v5m0-4a1.5 1.5 0 0 1 3 0v5m0-2a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 14a1.6 1.6 0 0 1 2.6-1.8L7 13.5',
        trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
        sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
        chev: 'M9 6l6 6-6 6',
        back: 'M15 6l-6 6 6 6',
        refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4m-4 5a8 8 0 0 0 14.9 3M20 20v-4h-4',
        chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
        list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
        warn: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
        plus: 'M12 5v14M5 12h14',
    };
    const icon = (k, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24"><path d="${P[k] || ''}"/></svg>`;

    // ─── colours (site pills are colour + "20" alpha) ─────────
    const COL = {
        pending: '#f59e0b', submitted: '#f59e0b', in_review: '#3b82f6', accepted: '#10b981', rejected: '#ef4444',
        withdrawn: '#737373', passed: '#10b981', failed: '#ef4444', in_progress: '#3b82f6', valid: '#10b981', revoked: '#ef4444',
        expired: '#737373', low: '#10b981', medium: '#f59e0b', high: '#ef4444', flagged: '#ef4444',
    };
    const STATUS_TEXT = { pending: 'Pending Review', submitted: 'Pending Review', in_review: 'Under Review' };
    const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : null);
    const pill = (text, color, cls = '') => {
        const c = hex(color) || '#737373';
        return `<span class="pill ${cls}" style="background:${c}20;color:${c}">${esc(text)}</span>`;
    };
    const statusPill = (s) => pill(STATUS_TEXT[s] || label(s), COL[s]);
    // Prefer the workflow stage (name + colour) like the website does
    const stagePill = (a) => {
        const st = a.current_stage || a.stage;
        if (st?.name && !a.is_final) return pill(st.name, hex(st.color) || COL[a.status]);
        return statusPill(a.status);
    };

    function avatar(user, cls = '') {
        const name = user?.display_name || user?.username || '?';
        const initials = name.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
        return `<div class="avatar ${cls}">${user?.avatar_url ? `<img src="${esc(user.avatar_url)}" onerror="this.parentNode.textContent='${esc(initials)}'">` : esc(initials)}</div>`;
    }
    const userName = (u, fb = 'Unknown') => u?.display_name || u?.username || fb;
    const userCell = (u, fb) => `<div class="user-cell">${avatar(u)}<div><b>${esc(userName(u, fb))}</b>${u?.username ? `<div class="discord">${icon('chat')}${esc(u.username)}</div>` : u?.discord_id ? `<div class="discord mono">${esc(u.discord_id)}</div>` : ''}</div></div>`;

    function pager(meta, onPage) {
        if (!meta || !(meta.last_page > 1)) return '';
        const id = 'p' + Math.random().toString(36).slice(2, 8);
        setTimeout(() => $$(`[data-pg="${id}"]`).forEach((b) => (b.onclick = () => onPage((meta.current_page || 1) + Number(b.dataset.d)))));
        return `<div class="pager">
            <button class="btn sm" data-pg="${id}" data-d="-1" ${meta.current_page <= 1 ? 'disabled' : ''}>← Previous</button>
            <span class="dim small">Page ${esc(meta.current_page)} of ${esc(meta.last_page)}${meta.total != null ? ' · ' + esc(meta.total) + ' total' : ''}</span>
            <button class="btn sm" data-pg="${id}" data-d="1" ${meta.has_more || meta.current_page < meta.last_page ? '' : 'disabled'}>Next →</button>
        </div>`;
    }

    // ─── modal form ───────────────────────────────────────────
    function form(opts) {
        return new Promise((resolve) => {
            const m = $('#modal'), ok = $('#modal-ok'), box = $('#modal-fields');
            $('#modal-title').textContent = opts.title;
            $('#modal-text').textContent = opts.text || '';
            $('#modal-text').classList.toggle('hidden', !opts.text);
            ok.textContent = opts.okText || 'Confirm';
            ok.className = 'btn ' + (opts.okClass || 'primary');
            $('#modal-cancel').classList.toggle('hidden', !!opts.noCancel);
            const fields = opts.fields || [];
            box.innerHTML = fields.map((f, i) => {
                const v = esc(f.value ?? '');
                let input;
                if (f.type === 'textarea') input = `<textarea class="input" rows="${f.rows || 4}" data-i="${i}" placeholder="${esc(f.placeholder || '')}">${v}</textarea>`;
                else if (f.type === 'select') input = `<select class="input" data-i="${i}">${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(f.value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
                else if (f.type === 'color') input = `<div class="color-row"><input type="color" data-c="${i}" value="${v || '#a855f7'}"><input class="input" data-i="${i}" value="${v || '#a855f7'}" maxlength="7"></div>`;
                else input = `<input class="input" data-i="${i}" value="${v}" placeholder="${esc(f.placeholder || '')}">`;
                return `<div class="mfield">${f.label ? `<label>${esc(f.label)}</label>` : ''}${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
            }).join('');
            $$('[data-c]', box).forEach((c) => (c.oninput = () => ($(`[data-i="${c.dataset.c}"]`, box).value = c.value)));
            m.classList.remove('hidden');
            setTimeout(() => $('input.input, textarea.input', box)?.focus(), 50);
            const done = (val) => { m.classList.add('hidden'); ok.onclick = $('#modal-cancel').onclick = null; resolve(val); };
            $('#modal-cancel').onclick = () => done(null);
            ok.onclick = () => {
                const out = {};
                for (const [i, f] of fields.entries()) {
                    const v = $(`[data-i="${i}"]`, box).value.trim();
                    if (f.required && !v) return toast(`${f.label || 'Field'} is required.`, true);
                    if (f.min && v.length < f.min) return toast(`${f.label || 'Field'} needs at least ${f.min} characters.`, true);
                    out[f.key] = v;
                }
                done(out);
            };
        });
    }
    const confirm = (title, text, okText = 'Confirm', okClass = 'primary') => form({ title, text, okText, okClass });

    // ─── sidebar ──────────────────────────────────────────────
    const isStaff = () => !!state.init?.staff;
    const isAdmin = () => !!state.init?.isAdmin;
    const guildName = () => state.init?.guild?.name || state.init?.staff?.guild?.name || state.init?.community || 'Community';
    const guildIcon = (cls = '') => {
        const g = state.init?.guild || {};
        const img = g.icon_url || g.avatar_url || g.logo_url;
        return `<div class="guild-icon ${cls}">${img ? `<img src="${esc(img)}" onerror="this.remove()">` : esc(guildName().slice(0, 1).toUpperCase())}</div>`;
    };
    const myRole = () => (isAdmin() ? 'Admin' : state.init?.staff?.staff?.role?.name || (isStaff() ? 'Staff' : 'Member'));

    function renderSidebar() {
        const d = state.init || {};
        $('#user-card').innerHTML = `${avatar({ display_name: d.playerName, avatar_url: d.staff?.staff?.user?.avatar_url })}
            <div style="min-width:0"><div class="name">${esc(d.playerName || '…')}</div><div class="sub">${d.guild?.is_pro ? 'Guildbase Pro' : esc(myRole())}</div></div>`;

        const link = (id, text, ic, count, red) =>
            `<button class="side-link ${state.view === id ? 'active' : ''} ${count ? 'has-count' : ''} ${red ? 'red' : ''}" data-view="${id}" title="${esc(text)}">${icon(ic)}<span class="lbl">${esc(text)}</span>${count ? `<span class="count ${red ? 'red' : ''}">${count > 99 ? '99+' : count}</span>` : ''}</button>`;
        const sub = (id, text, ic, count) =>
            `<button class="sub-link ${state.view === id ? 'active' : ''} ${count ? 'has-count' : ''}" data-view="${id}" title="${esc(text)}">${icon(ic)}<span class="lbl">${esc(text)}</span>${count ? `<span class="count">${count > 99 ? '99+' : count}</span>` : ''}</button>`;

        const guildSubs = [
            isStaff() && sub('review', 'Applications', 'doc', d.staff?.counts?.open),
            sub('apply', 'Apply', 'apply'),
            isAdmin() && sub('members', 'Members', 'members'),
            isAdmin() && sub('roles', 'Roles', 'roles'),
            isAdmin() && sub('exams', 'Exams', 'exams'),
            isAdmin() && sub('certs', 'Certificates', 'certs'),
        ].filter(Boolean).join('');

        $('#nav').innerHTML = `
            ${link('home', 'Dashboard', 'home')}
            ${link('mine', 'My Applications', 'doc')}
            ${link('inbox', 'Inbox', 'inbox', d.unread, true)}
            <div class="side-sep"></div>
            <div class="side-label">Guilds (1)</div>
            <div class="guild-row" title="${esc(guildName())}">${guildIcon()}<div style="min-width:0"><div class="gname">${esc(guildName())}</div><div class="grole">${esc(myRole())}</div></div></div>
            <div class="sub-nav">${guildSubs}</div>`;
        $$('#nav [data-view]').forEach((b) => (b.onclick = () => { if (b.dataset.view === 'review') rv.selected = null; if (b.dataset.view === 'exams') ex.exam = null; go(b.dataset.view); }));
    }

    // ─── collapsible sidebar (remembered per player) ──────────
    const store = {
        get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} },
    };
    function setCollapsed(on) {
        document.body.classList.toggle('collapsed', on);
        $('#collapse-btn').title = on ? 'Expand sidebar' : 'Collapse sidebar';
        store.set('gb_sidebar_collapsed', on ? '1' : '0');
    }
    setCollapsed(store.get('gb_sidebar_collapsed') === '1');
    $('#collapse-btn').onclick = () => setCollapsed(!document.body.classList.contains('collapsed'));

    // ─── stop the character moving while typing ───────────────
    // LB Tablet lets the player walk while the tablet is open. While the form
    // is open or a text box has focus, ask the client to block game controls.
    let lockForm = false, lockInput = false, lockSent = null;
    function syncLock() {
        const want = lockForm || lockInput;
        if (want === lockSent || PREVIEW) return;
        lockSent = want;
        call('inputLock', { lock: want });
    }
    const isTextField = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !/^(button|submit|checkbox|radio|color|range|file)$/i.test(el.type)));
    document.addEventListener('focusin', (e) => { lockInput = isTextField(e.target); syncLock(); });
    document.addEventListener('focusout', () => setTimeout(() => { lockInput = isTextField(document.activeElement); syncLock(); }, 0));
    const formLock = (on) => { lockForm = on; syncLock(); };

    // ─── router ───────────────────────────────────────────────
    const Views = {};
    function setHead(v) {
        const title = typeof v.title === 'function' ? v.title() : v.title;
        $('#page-head').innerHTML = v.guild
            ? `${guildIcon()}<div><h1>${esc(title)}</h1><div class="crumb">${esc(title === guildName() ? (state.init?.guild?.description || 'Guild overview') : guildName())}</div></div>`
            : `<div><h1>${esc(title)}</h1>${v.sub ? `<div class="crumb">${esc(v.sub)}</div>` : ''}</div>`;
    }
    function go(view) {
        if (!Views[view]) view = 'home';
        state.view = view;
        renderSidebar();
        const v = Views[view];
        setHead(v);
        $('#top-actions').innerHTML = '';
        const c = $('#content');
        c.innerHTML = spinner();
        c.scrollTop = 0;
        v.render(c, $('#top-actions'));
    }
    const topBtn = (top, html, fn, cls = '') => {
        const b = document.createElement('button');
        b.className = 'btn ' + cls;
        b.innerHTML = html;
        b.onclick = fn;
        top.appendChild(b);
        return b;
    };
    const refreshBtn = (top, fn) => topBtn(top, icon('refresh'), fn, 'icon');

    async function refreshInit(force) {
        const res = await call('init', { force: !!force });
        if (!res.ok) {
            $('#content').innerHTML = errorBox(res);
            return false;
        }
        state.init = res.data;
        renderSidebar();
        return true;
    }

    // ─── DASHBOARD ────────────────────────────────────────────
    Views.home = {
        title: () => guildName(),
        guild: true,
        async render(c, top) {
            refreshBtn(top, async () => { await refreshInit(true); go('home'); });
            const d = state.init;
            const staff = d.staff;

            if (staff) {
                topBtn(top, `${icon('doc')}Review queue`, () => go('review'), 'primary');
                const recent = await call('staffList', { page: 1 });
                const apps = listOf(recent, 'applications').slice(0, 7);
                const cnt = staff.counts || {};
                c.innerHTML = `
                    <div class="stats">
                        ${statCard('Total applications', cnt.total ?? '—', 'doc', 'si-purple', `${esc(d.guild?.member_count ?? '—')} <span>guild members</span>`)}
                        ${statCard('Pending review', cnt.open ?? 0, 'clock', 'si-amber', 'Open in your queue')}
                        ${statCard('Flagged', cnt.flagged ?? 0, 'flag', 'si-red', 'Risk or AI flags')}
                        ${statCard('Inbox', d.unread || 0, 'inbox', 'si-green', 'Unread messages')}
                    </div>
                    <div class="card">
                        <div class="card-head"><div><h2>Recent Applications</h2><p>Latest submissions across all templates</p></div>
                            <button class="btn" data-go="review">View All →</button></div>
                        ${recent.ok ? appTable(apps) : errorBox(recent)}
                    </div>`;
                bindAppTable(c);
            } else {
                const [tpl, mine] = await Promise.all([call('templates'), call('myApps')]);
                const apps = listOf(mine, 'applications');
                const templates = tpl.ok ? tpl.data : [];
                const active = apps.filter((a) => !a.is_final && a.status !== 'withdrawn').length;
                const accepted = apps.filter((a) => a.status === 'accepted').length;
                c.innerHTML = `
                    <div class="stats">
                        ${statCard('Open forms', templates.length, 'apply', 'si-purple', 'Available to apply')}
                        ${statCard('Active applications', active, 'clock', 'si-amber', 'Waiting on staff')}
                        ${statCard('Accepted', accepted, 'check', 'si-green', `Out of ${apps.length} submitted`)}
                        ${statCard('Inbox', d.unread || 0, 'inbox', 'si-red', 'Unread messages')}
                    </div>
                    <div class="card">
                        <div class="card-head"><div><h2>My Applications</h2><p>Everything you've submitted</p></div><button class="btn" data-go="mine">View All →</button></div>
                        ${myAppsTable(apps.slice(0, 6))}
                    </div>`;
            }
            $$('[data-go]', c).forEach((b) => (b.onclick = () => go(b.dataset.go)));
        },
    };
    function statCard(k, v, ic, cls, sub) {
        return `<div class="card stat"><div><div class="label">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${sub}</div></div><div class="stat-icon ${cls}">${icon(ic)}</div></div>`;
    }

    // ─── APPLY ────────────────────────────────────────────────
    Views.apply = {
        title: 'Apply',
        guild: true,
        async render(c, top) {
            refreshBtn(top, () => go('apply'));
            const res = await call('templates');
            if (!res.ok) return (c.innerHTML = errorBox(res));
            if (!res.data.length) return (c.innerHTML = `<div class="card">${empty('No applications are open', 'Check back later.')}</div>`);
            c.innerHTML = `<div class="grid">${res.data.map((t) => `
                <div class="card tpl">
                    <div class="stat-icon si-purple" style="width:42px;height:42px">${icon('apply')}</div>
                    <h3>${esc(t.name)}</h3>
                    <p>${esc(t.description || 'No description provided.')}</p>
                    <div class="foot">
                        ${t.closes_at ? pill('Closes ' + date(t.closes_at), '#f59e0b') : pill('Open', '#10b981')}
                        <button class="btn primary sm" data-apply="${esc(t.slug)}" data-name="${esc(t.name)}">Apply now</button>
                    </div>
                </div>`).join('')}</div>`;
            $$('[data-apply]', c).forEach((b) => (b.onclick = () => startApply(b.dataset.apply, b.dataset.name, b)));
        },
    };
    async function startApply(slug, name, btn) {
        const txt = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Opening…';
        const res = await call('startApply', { slug, name });
        btn.disabled = false;
        btn.textContent = txt;
        if (!res.ok) return toast(res.message, true);
        if (res.data.overlay) return; // opened full screen by the client script
        $('#sheet-title').textContent = name;
        $('#sheet-exp').textContent = res.data.expires_at ? 'Link expires ' + new Date(res.data.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        $('#sheet').classList.remove('hidden');
        formLock(true);
        sheetEmbed.load(res.data.embed_url);
    }
    const sheetEmbed = window.GBEmbed($('#sheet-frame'), {
        onLoading: () => $('#sheet-loading').classList.remove('hidden'),
        onLoaded: () => $('#sheet-loading').classList.add('hidden'),
        onError: () => { $('#sheet-loading').classList.add('hidden'); toast('Could not load the form. Press Reload.', true); },
        onClose: (submitted) => closeSheet(submitted),
    });
    function closeSheet(submitted) {
        $('#sheet').classList.add('hidden');
        formLock(false);
        sheetEmbed.clear();
        if (submitted) toast('Application submitted!');
        state.view = 'mine';
        renderSidebar();
        setHead(Views.mine);
        $('#top-actions').innerHTML = '';
        Views.mine.render($('#content'), $('#top-actions'), true);
    }
    $('#sheet-reload').onclick = () => sheetEmbed.reload();
    $('#sheet-close').onclick = () => closeSheet(false);

    // ─── MY APPLICATIONS ──────────────────────────────────────
    function myAppsTable(apps) {
        if (!apps.length) return empty("You haven't applied yet", 'Head to Apply to get started.');
        return `<table class="tbl"><thead><tr><th>Template</th><th>Stage</th><th>Submitted</th><th></th></tr></thead><tbody>
            ${apps.map((a) => `<tr>
                <td><b style="font-weight:500">${esc(a.template?.name || 'Application')}</b></td>
                <td>${stagePill(a)}</td>
                <td>${esc(date(a.submitted_at))}<div class="t2">${esc(ago(a.submitted_at))}</div></td>
                <td class="r">${a.can_withdraw ? `<button class="btn red sm" data-withdraw="${esc(a.id)}">Withdraw</button>` : ''}</td>
            </tr>`).join('')}</tbody></table>`;
    }
    Views.mine = {
        title: 'My Applications',
        sub: 'Track every application you have submitted',
        async render(c, top, force) {
            if (top) refreshBtn(top, () => Views.mine.render(c, null, true));
            c.innerHTML = spinner();
            const res = await call('myApps', { refresh: !!force });
            if (!res.ok) return (c.innerHTML = errorBox(res));
            c.innerHTML = `<div class="card">${myAppsTable(listOf(res, 'applications'))}</div>`;
            $$('[data-withdraw]', c).forEach((b) => (b.onclick = async () => {
                const r = await form({ title: 'Withdraw application?', text: 'This cannot be undone.', fields: [{ key: 'reason', label: 'Reason (optional)', type: 'textarea', rows: 3 }], okText: 'Withdraw', okClass: 'red' });
                if (!r) return;
                const res = await call('withdraw', { id: b.dataset.withdraw, reason: r.reason });
                toast(res.ok ? (res.data?.message || 'Application withdrawn.') : res.message, !res.ok);
                if (res.ok) Views.mine.render(c, null, true);
            }));
        },
    };

    // ─── INBOX ────────────────────────────────────────────────
    Views.inbox = {
        title: 'Inbox',
        sub: 'Updates from staff about your applications',
        async render(c, top) {
            topBtn(top, 'Clear inbox', async () => {
                if (!(await confirm('Clear inbox?', 'All messages will be removed.', 'Clear', 'red'))) return;
                await call('clearInbox');
                go('inbox');
            });
            const res = await call('inbox', { markRead: true });
            if (!res.ok) return (c.innerHTML = errorBox(res));
            if (state.init) { state.init.unread = 0; renderSidebar(); }
            if (!res.data.length) return (c.innerHTML = `<div class="card">${empty('No messages yet', 'Updates appear here when staff move your application.')}</div>`);
            c.innerHTML = `<div class="card list">${res.data.map((m) => `
                <div class="list-row ${m.read ? '' : 'unread'}" style="align-items:flex-start">
                    <div class="stat-icon ${m.kind === 'submitted' ? 'si-purple' : 'si-green'}" style="width:40px;height:40px">${icon(m.kind === 'submitted' ? 'doc' : 'inbox')}</div>
                    <div class="grow">
                        <div class="title">${esc(m.subject || (m.kind === 'submitted' ? 'Application received' : 'Application update'))}</div>
                        <div class="sub">${esc(ago(m.created_at))}</div>
                        ${m.message ? `<div class="mail-body">${esc(m.message)}</div>` : ''}
                    </div>
                    ${m.kind === 'submitted' ? pill('Received', '#a855f7') : pill('Stage update', '#3b82f6')}
                </div>`).join('')}</div>`;
        },
    };

    // ─── APPLICATIONS (staff review) ──────────────────────────
    const rv = { status: '', template_id: '', risk_level: '', claimed: '', search: '', page: 1, selected: null, tab: 'responses' };

    const showRisk = () => state.init?.showRisk !== false;
    function appTable(apps) {
        if (!apps.length) return empty('No applications', 'Nothing matches these filters.');
        const risk = showRisk();
        return `<table class="tbl"><thead><tr><th>Applicant</th><th>Template</th><th>Stage</th>${risk ? '<th>Risk</th>' : ''}<th>Submitted</th><th></th></tr></thead><tbody>
            ${apps.map((a) => `<tr class="clickable" data-open="${esc(a.id)}">
                <td>${userCell(a.user, 'Applicant')}</td>
                <td>${esc(a.template?.name || '')}</td>
                <td>${stagePill(a)}${a.is_claimed ? ' ' + pill('Claimed', '#a855f7') : ''}</td>
                ${risk ? `<td>${a.risk_level ? pill(label(a.risk_level), COL[a.risk_level]) : '<span class="dim">—</span>'}</td>` : ''}
                <td>${esc(date(a.submitted_at || a.created_at))}<div class="t2">${esc(ago(a.submitted_at || a.created_at))}</div></td>
                <td class="r"><span class="arrow-btn">${icon('chev')}</span></td>
            </tr>`).join('')}</tbody></table>`;
    }
    function bindAppTable(c) {
        $$('[data-open]', c).forEach((r) => (r.onclick = () => { rv.selected = r.dataset.open; rv.tab = 'responses'; go('review'); }));
    }

    Views.review = {
        title: () => (rv.selected ? 'Application' : 'Applications'),
        guild: true,
        render(c, top) {
            if (rv.selected) return renderDetail(c, top);
            refreshBtn(top, async () => { await refreshInit(true); go('review'); });
            const staff = state.init.staff || {};
            const st = [['', 'All'], ['pending', 'Pending'], ['in_review', 'Under Review'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['withdrawn', 'Withdrawn']];
            c.innerHTML = `
                <div class="tabs" id="rv-status">${st.map(([v, l]) => `<button data-v="${v}" class="${rv.status === v ? 'active' : ''}">${l}</button>`).join('')}</div>
                <div class="toolbar">
                    <select class="input" id="rv-template"><option value="">All templates</option>${(staff.templates || []).map((t) => `<option value="${esc(t.id)}" ${String(rv.template_id) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
                    <select class="input ${showRisk() ? '' : 'hidden'}" id="rv-risk">${[['', 'Any risk'], ['low', 'Low risk'], ['medium', 'Medium risk'], ['high', 'High risk'], ['flagged', 'Flagged']].map(([v, l]) => `<option value="${v}" ${rv.risk_level === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                    <select class="input" id="rv-claimed">${[['', 'Claimed or not'], ['true', 'Claimed'], ['false', 'Unclaimed']].map(([v, l]) => `<option value="${v}" ${rv.claimed === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                    <input class="input grow" id="rv-search" placeholder="Search applicants…" value="${esc(rv.search)}">
                </div>
                <div class="card" id="queue">${spinner()}</div>`;
            $$('#rv-status button').forEach((b) => (b.onclick = () => { rv.status = b.dataset.v; rv.page = 1; $$('#rv-status button').forEach((x) => x.classList.toggle('active', x === b)); loadQueue(); }));
            $('#rv-template').onchange = (e) => { rv.template_id = e.target.value; rv.page = 1; loadQueue(); };
            $('#rv-risk').onchange = (e) => { rv.risk_level = e.target.value; rv.page = 1; loadQueue(); };
            $('#rv-claimed').onchange = (e) => { rv.claimed = e.target.value; rv.page = 1; loadQueue(); };
            let t;
            $('#rv-search').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { rv.search = e.target.value; rv.page = 1; loadQueue(); }, 450); };
            loadQueue();
        },
    };
    async function loadQueue() {
        const el = $('#queue');
        if (!el) return;
        el.innerHTML = spinner();
        const res = await call('staffList', {
            status: rv.status, template_id: rv.template_id, risk_level: rv.risk_level, search: rv.search, page: rv.page,
            claimed: rv.claimed === '' ? undefined : rv.claimed === 'true',
        });
        if (!res.ok) return (el.innerHTML = errorBox(res));
        el.innerHTML = appTable(listOf(res, 'applications')) + pager(metaOf(res), (p) => { rv.page = p; loadQueue(); });
        bindAppTable(el);
    }

    // answers: [{ title, fields: [{ label, type, value, formatted_value }] }]
    const CHOICE_TYPES = /select|radio|choice|dropdown|checkbox|multi|boolean|yes_no|toggle/i;
    function fieldValue(f) {
        const v = f.value;
        const isChoice = CHOICE_TYPES.test(f.type || '') || typeof v === 'boolean' || Array.isArray(v);
        if (v == null || v === '') return '<span class="dim">No answer</span>';
        if (isChoice) {
            const items = Array.isArray(v) ? v : [v];
            return items.map((x) => {
                const t = typeof x === 'boolean' ? (x ? 'yes' : 'no') : typeof x === 'object' ? (x.label ?? x.value ?? JSON.stringify(x)) : String(x);
                const yn = /^(yes|no|true|false)$/i.test(t);
                return `<span class="chip ${yn ? '' : 'choice'}">${esc(t)}</span>`;
            }).join('');
        }
        return esc(f.formatted_value ?? (typeof v === 'object' ? JSON.stringify(v) : v));
    }
    function renderAnswers(answers) {
        if (!answers || (Array.isArray(answers) && !answers.length)) return `<div class="card">${empty('No responses')}</div>`;
        let sections;
        if (Array.isArray(answers) && answers.some((s) => Array.isArray(s?.fields))) sections = answers;
        else if (Array.isArray(answers)) sections = [{ title: 'Responses', fields: answers.map((x, i) => (typeof x === 'object' && x ? { label: x.label ?? x.question?.label ?? x.question ?? `Question ${i + 1}`, type: x.type, value: x.answer ?? x.value, formatted_value: x.formatted_value } : { label: `Question ${i + 1}`, value: x })) }];
        else sections = [{ title: 'Responses', fields: Object.entries(answers).map(([k, v]) => ({ label: k, value: v })) }];
        return sections.map((s, i) => `
            <div class="card section-card" style="margin-bottom:14px">
                <div class="section-head"><div class="section-num">${i + 1}</div><div class="t">${esc(s.title || 'Section')}</div><span class="dim small">${(s.fields || []).length} fields</span></div>
                <div class="fields">${(s.fields || []).map((f) => `<div class="field-box"><div class="q">${esc(f.label || 'Question')}</div><div class="a">${fieldValue(f)}</div></div>`).join('')}</div>
            </div>`).join('');
    }

    async function renderDetail(c, top) {
        $('#page-head').innerHTML = '';
        const res = await call('staffGet', { id: rv.selected });
        if (!res.ok) { c.innerHTML = errorBox(res); topBtn(top, `${icon('back')}Back`, () => { rv.selected = null; go('review'); }); return; }

        const d = res.data || {};
        const a = d.application || {};
        const stages = (d.stages || []).slice().sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
        const perms = d.permissions || state.init.staff?.permissions || {};
        const can = (k) => perms[k] !== false;
        const final = a.is_final;
        const cur = a.current_stage || {};
        const curColor = hex(cur.color) || COL[a.status] || '#a855f7';
        const shortId = String(a.id || rv.selected).slice(0, 8);
        const ai = d.ai_detection;
        const aiText = ai ? (ai.interpretation || ai.message || ai.summary || (ai.score != null ? `AI likelihood score: ${ai.score}` : '')) : '';
        const history = Array.isArray(d.history) ? d.history : [];
        const b = (act, ic, text, cls, show = true) => (show ? `<button class="btn ${cls}" data-act="${act}">${icon(ic)}${text}</button>` : '');

        const curIdx = stages.findIndex((s) => (cur.id != null && s.id === cur.id) || (cur.name && s.name === cur.name));
        const steps = stages.length ? stages : (cur.name ? [cur] : []);

        c.innerHTML = `
            <div class="app-head">
                <button class="btn icon" id="back">${icon('back')}</button>
                <div>
                    <h1>Application #${esc(shortId)}</h1>
                    <div class="sub">(${esc(a.template?.name || 'Application')}) Submitted ${esc(ago(a.submitted_at))}</div>
                </div>
                <span class="stage-box" style="border-color:${curColor}55;background:${curColor}20;color:${curColor}">${esc(cur.name || STATUS_TEXT[a.status] || label(a.status))}</span>
                <div class="app-actions">
                    ${!final ? `
                        ${b('approve', 'tick', 'Accept', 'green', can('review'))}
                        ${b('reject', 'x', 'Reject', 'red', can('review'))}
                        <span class="vsep"></span>
                        ${b('advance', 'chev', 'Next Stage', '', can('manage'))}
                        ${b('move', 'move', 'Move', '', can('manage') && stages.length)}
                        ${b('pushback', 'undo', 'Push Back', 'orange', can('review') && d.can_be_pushed_back !== false)}
                        ${a.is_claimed ? b('unclaim', 'hand', 'Unclaim', 'purple', can('claim')) : b('claim', 'hand', 'Claim', 'purple', can('claim'))}
                    ` : b('overturn', 'undo', 'Overturn', 'orange', can('overturn'))}
                    ${b('delete', 'trash', 'Delete', 'red', can('delete'))}
                </div>
            </div>
            <div class="app-grid">
                <div>
                    <div class="card profile" style="margin-bottom:16px">
                        <div class="profile-top">
                            ${avatar(a.user, 'lg')}
                            <div style="min-width:0"><h2>${esc(userName(a.user, 'Applicant'))}</h2>
                            ${a.user?.username ? `<div class="discord">${icon('chat')}${esc(a.user.username)}</div>` : ''}
                            ${a.user?.discord_id ? `<div class="discord mono">${esc(a.user.discord_id)}</div>` : ''}</div>
                        </div>
                        <div class="profile-stats">
                            <div><div class="v">${esc(a.revision_count ?? 0)}</div><div class="k">Revisions</div></div>
                            ${showRisk() ? `<div><div class="v">${a.risk_level ? esc(label(a.risk_level)) : '—'}</div><div class="k">Risk Level</div></div>` : `<div><div class="v">${esc(STATUS_TEXT[a.status] || label(a.status))}</div><div class="k">Status</div></div>`}
                            <div><div class="v">${a.time_spent_seconds != null ? `${Math.floor(a.time_spent_seconds / 60)}m ${a.time_spent_seconds % 60}s` : '—'}</div><div class="k">Time Spent On App</div></div>
                        </div>
                    </div>
                    <div class="tabs" id="dtabs">
                        <button data-t="responses" class="${rv.tab === 'responses' ? 'active' : ''}">${icon('chat')}Responses</button>
                        <button data-t="events" class="${rv.tab === 'events' ? 'active' : ''}">${icon('list')}Events <span class="tab-count">${history.length}</span></button>
                        <button data-t="risk" class="${rv.tab === 'risk' ? 'active' : ''}">${icon(showRisk() ? 'warn' : 'sparkle')}${showRisk() ? 'Risk Analysis' : 'AI Check'} ${showRisk() && a.risk_level ? pill(label(a.risk_level), COL[a.risk_level], 'box') : ''}</button>
                    </div>
                    <div id="dtab-body"></div>
                </div>
                <div>
                    <div class="card side-card">
                        <span class="label">Application Workflow</span>
                        ${steps.map((s, i) => {
                            const isCur = curIdx === i || (curIdx < 0 && s.name === cur.name);
                            const done = curIdx >= 0 && i < curIdx && !s.is_final;
                            return `<div class="wf-step ${isCur ? 'current' : done ? 'done' : ''}"><span class="dot"></span>${esc(s.name)}</div>`;
                        }).join('') || '<div class="dim small">No workflow stages returned.</div>'}
                    </div>
                    <div class="card side-card">
                        <span class="label">Details</span>
                        <div class="kv"><span>Application ID</span><span class="code-chip">${esc(shortId)}</span></div>
                        <div class="kv"><span>Template</span><span>${esc(a.template?.name || '—')}</span></div>
                        <div class="kv"><span>Status</span><span>${statusPill(a.status)}</span></div>
                        <div class="kv"><span>Submitted</span><span>${esc(ago(a.submitted_at) || '—')}</span></div>
                        <div class="kv"><span>Last Updated</span><span>${esc(ago(a.updated_at) || '—')}</span></div>
                        <div class="kv"><span>Claimed by</span><span>${a.is_claimed ? esc(userName(a.claimed_by, 'Staff')) : '—'}</span></div>
                    </div>
                </div>
            </div>`;

        const body = $('#dtab-body');
        const renderTab = () => {
            if (rv.tab === 'events') {
                body.innerHTML = `<div class="card">${history.length ? history.map((h) => `
                    <div class="timeline-item"><span class="tdot"></span><div>
                        <div>${esc(h.description || h.message || h.action || h.event || label(h.type) || 'Update')}${(h.actor || h.user || h.staff) ? ` · <b style="font-weight:500">${esc(userName(h.actor || h.user || h.staff, ''))}</b>` : ''}</div>
                        ${h.notes || h.reason ? `<div class="muted small" style="margin-top:3px">${esc(h.notes || h.reason)}</div>` : ''}
                        <div class="dim small" style="margin-top:3px">${esc(ago(h.created_at))}</div>
                    </div></div>`).join('') : empty('No events yet')}</div>`;
            } else if (rv.tab === 'risk') {
                const flags = a.flags || [];
                body.innerHTML = `<div class="card" style="padding:20px 0 8px">
                    <div class="kv ${showRisk() ? '' : 'hidden'}" style="padding:0 22px 12px"><span>Risk level</span><span>${a.risk_level ? pill(label(a.risk_level), COL[a.risk_level]) : '—'}</span></div>
                    ${flags.length ? `<div style="padding:0 22px 14px" class="tags">${flags.map((f) => pill(typeof f === 'string' ? label(f) : f.label || f.name || 'Flag', '#ef4444')).join('')}</div>` : ''}
                    ${aiText ? `<div class="notice">${esc(aiText)}</div>` : ''}
                    ${d.latest_pushback?.reason ? `<div class="notice purple"><b>Last push-back:</b> ${esc(d.latest_pushback.reason)}</div>` : ''}
                    <div style="padding:4px 22px 14px">${can('ai_check') ? `<button class="btn purple" id="run-ai">${icon('sparkle')}Run AI Check</button>` : '<span class="dim small">You do not have permission to run AI checks.</span>'}</div>
                </div>`;
                $('#run-ai')?.addEventListener('click', () => act(a.id || rv.selected, 'ai-check', stages));
            } else {
                body.innerHTML = renderAnswers(a.answers);
            }
        };
        renderTab();
        $$('#dtabs button').forEach((t) => (t.onclick = () => { rv.tab = t.dataset.t; $$('#dtabs button').forEach((x) => x.classList.toggle('active', x === t)); renderTab(); }));
        $('#back').onclick = () => { rv.selected = null; go('review'); };
        $$('[data-act]', c).forEach((btn) => (btn.onclick = () => act(a.id || rv.selected, btn.dataset.act, stages)));
    }

    async function act(id, action, stages) {
        const payload = { id, action };
        const stageOpts = (filter) => stages.filter(filter).map((s) => ({ value: s.id, label: s.name + (s.is_final ? ` (final · ${s.final_status})` : '') }));

        if (action === 'approve') {
            if (!(await confirm('Accept application?', "The accepted stage's workflow actions (Discord roles, FiveRoster, etc.) will run.", 'Accept', 'green'))) return;
        } else if (action === 'reject') {
            const r = await form({ title: 'Reject application', fields: [{ key: 'reason', label: 'Reason (optional, shared with applicant)', type: 'textarea' }], okText: 'Reject', okClass: 'red' });
            if (!r) return;
            payload.reason = r.reason;
        } else if (action === 'pushback') {
            const r = await form({ title: 'Push back to applicant', text: 'They can edit and resubmit.', fields: [{ key: 'reason', label: 'What needs fixing?', type: 'textarea', min: 10 }], okText: 'Push Back', okClass: 'orange' });
            if (!r) return;
            payload.reason = r.reason;
        } else if (action === 'move') {
            const r = await form({ title: 'Move to stage', fields: [
                { key: 'stage_id', label: 'Stage', type: 'select', options: stageOpts(() => true) },
                { key: 'notes', label: 'Notes (optional)', type: 'textarea', rows: 3 },
            ], okText: 'Move' });
            if (!r) return;
            Object.assign(payload, r);
        } else if (action === 'overturn') {
            const opts = stageOpts((s) => !s.is_final);
            if (!opts.length) return toast('No open stage to send it back to.', true);
            const r = await form({ title: 'Overturn decision', text: 'Re-opens the application at the stage you pick.', fields: [
                { key: 'stage_id', label: 'Re-open at stage', type: 'select', options: opts },
                { key: 'reason', label: 'Reason', type: 'textarea', required: true },
            ], okText: 'Overturn', okClass: 'orange' });
            if (!r) return;
            Object.assign(payload, r);
        } else if (action === 'delete') {
            if (!(await confirm('Delete application?', 'This permanently removes it from Guildbase.', 'Delete', 'red'))) return;
        }

        const res = await call('staffAction', payload);
        if (!res.ok) return toast(res.message, true);

        if (action === 'ai-check') {
            const r = res.data || {};
            await form({ title: 'AI check result', text: r.interpretation || r.message || JSON.stringify(r.results || {}), okText: 'Close', noCancel: true });
        } else {
            toast(res.data?.message || 'Done.');
            if (res.data?.stage_action_warning) setTimeout(() => toast(res.data.stage_action_warning, true), 3900);
        }
        await refreshInit(true);
        if (action === 'delete') rv.selected = null;
        go('review');
    }

    // ─── MEMBERS (admin) ──────────────────────────────────────
    async function getRoles(force) {
        if (state.roles && !force) return state.roles;
        const res = await call('adminRoles', {});
        state.roles = res.ok ? listOf(res, 'roles') : [];
        return state.roles;
    }
    const rolePill = (r) => (r ? pill(r.name, hex(r.color) || '#a3a3a3') : '<span class="dim">No role</span>');
    const roleOptions = (roles, none = 'No role') => [{ value: '', label: none }, ...roles.map((r) => ({ value: r.id, label: r.name }))];

    const mb = { role_id: '', page: 1 };
    Views.members = {
        title: 'Members',
        guild: true,
        async render(c, top) {
            const roles = await getRoles();
            topBtn(top, `${icon('plus')}Add Member`, async () => {
                const r = await form({ title: 'Add member', fields: [
                    { key: 'discord_id', label: 'Discord ID', placeholder: '123456789012345678', required: true, hint: 'Right-click the user in Discord → Copy User ID' },
                    { key: 'role_id', label: 'Role', type: 'select', options: roleOptions(roles) },
                ], okText: 'Add Member' });
                if (!r) return;
                const res = await call('adminMemberAdd', r);
                toast(res.ok ? 'Member added.' : res.message, !res.ok);
                if (res.ok) loadMembers(c);
            }, 'primary');
            loadMembers(c);
        },
    };
    async function loadMembers(c) {
        const roles = state.roles || [];
        c.innerHTML = `
            <div class="toolbar"><select class="input" id="mb-role"><option value="">All roles</option>${roles.map((r) => `<option value="${esc(r.id)}" ${String(mb.role_id) === String(r.id) ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
            <div class="card" id="mb-body">${spinner()}</div>`;
        $('#mb-role').onchange = (e) => { mb.role_id = e.target.value; mb.page = 1; loadMembers(c); };
        const res = await call('adminMembers', mb);
        const body = $('#mb-body');
        if (!res.ok) return (body.innerHTML = errorBox(res));
        const members = listOf(res, 'members');
        if (!members.length) return (body.innerHTML = empty('No members found'));
        body.innerHTML = `<table class="tbl"><thead><tr><th>Member</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>
            ${members.map((m) => `<tr>
                <td>${userCell(m.user)}</td>
                <td>${rolePill(m.role)}</td>
                <td>${esc(date(m.joined_at))}<div class="t2">${esc(ago(m.joined_at))}</div></td>
                <td class="r">
                    <button class="btn sm" data-role="${esc(m.id)}" data-cur="${esc(m.role?.id ?? '')}">Change Role</button>
                    <button class="btn red sm" data-remove="${esc(m.id)}" data-name="${esc(userName(m.user))}">Remove</button>
                </td>
            </tr>`).join('')}</tbody></table>${pager(metaOf(res), (p) => { mb.page = p; loadMembers(c); })}`;
        $$('[data-role]', body).forEach((b) => (b.onclick = async () => {
            const r = await form({ title: 'Change role', fields: [{ key: 'role_id', label: 'Role', type: 'select', value: b.dataset.cur, options: roleOptions(roles, 'Remove role') }], okText: 'Save' });
            if (!r) return;
            const res = await call('adminMemberRole', { id: b.dataset.role, role_id: r.role_id });
            toast(res.ok ? 'Role updated.' : res.message, !res.ok);
            if (res.ok) loadMembers(c);
        }));
        $$('[data-remove]', body).forEach((b) => (b.onclick = async () => {
            if (!(await confirm(`Remove ${b.dataset.name}?`, 'They will be removed from this guild on Guildbase.', 'Remove', 'red'))) return;
            const res = await call('adminMemberRemove', { id: b.dataset.remove });
            toast(res.ok ? 'Member removed.' : res.message, !res.ok);
            if (res.ok) loadMembers(c);
        }));
    }

    // ─── ROLES (admin) ────────────────────────────────────────
    Views.roles = {
        title: 'Roles',
        guild: true,
        async render(c, top) {
            topBtn(top, `${icon('plus')}New Role`, () => editRole(null), 'primary');
            const roles = await getRoles(true);
            if (!roles.length) return (c.innerHTML = `<div class="card">${empty('No roles yet')}</div>`);
            c.innerHTML = `<div class="card"><table class="tbl"><thead><tr><th>Role</th><th>Members</th><th>Discord Role</th><th></th></tr></thead><tbody>
                ${roles.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => `<tr>
                    <td>${rolePill(r)} ${r.is_default ? pill('Default', '#a855f7', 'box') : ''}</td>
                    <td>${esc(r.members_count ?? '—')}</td>
                    <td>${r.discord_role_id ? `<span class="code-chip">${esc(r.discord_role_id)}</span>` : '<span class="dim">—</span>'}</td>
                    <td class="r">${r.is_default ? '<span class="dim small">Locked</span>' : `
                        <button class="btn sm" data-edit="${esc(r.id)}">Edit</button>
                        <button class="btn red sm" data-del="${esc(r.id)}" data-name="${esc(r.name)}">Delete</button>`}</td>
                </tr>`).join('')}</tbody></table></div>`;
            $$('[data-edit]', c).forEach((b) => (b.onclick = () => editRole(b.dataset.edit)));
            $$('[data-del]', c).forEach((b) => (b.onclick = async () => {
                if (!(await confirm(`Delete role "${b.dataset.name}"?`, 'Members with this role will lose it.', 'Delete', 'red'))) return;
                const res = await call('adminRoleDelete', { id: b.dataset.del });
                toast(res.ok ? 'Role deleted.' : res.message, !res.ok);
                if (res.ok) go('roles');
            }));
        },
    };
    async function editRole(id) {
        let role = {};
        if (id) {
            const res = await call('adminRoleGet', { id });
            if (!res.ok) return toast(res.message, true);
            role = res.data || {};
        }
        const perms = Array.isArray(role.permissions) ? role.permissions : [];
        const r = await form({
            title: id ? `Edit ${role.name}` : 'New role',
            fields: [
                { key: 'name', label: 'Name', value: role.name, required: true },
                { key: 'color', label: 'Colour', type: 'color', value: role.color || '#a855f7', required: true },
                { key: 'discord_role_id', label: 'Linked Discord role ID (optional)', value: role.discord_role_id },
                { key: 'permissions', label: 'Permissions', type: 'textarea', rows: 4, value: perms.join(', '), hint: 'Comma-separated Guildbase permission keys. Saving replaces the whole set.' },
            ],
            okText: id ? 'Save' : 'Create Role',
        });
        if (!r) return;
        r.permissions = r.permissions.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        if (!/^#[0-9a-f]{6}$/i.test(r.color)) return toast('Colour must be a hex value like #a855f7', true);
        const res = await call('adminRoleSave', { id, ...r });
        toast(res.ok ? (id ? 'Role saved.' : 'Role created.') : res.message, !res.ok);
        if (res.ok) { state.roles = null; go('roles'); }
    }

    // ─── EXAMS (admin) ────────────────────────────────────────
    const ex = { exam: null, status: '', page: 1 };
    Views.exams = {
        title: () => ex.exam?.name || 'Exams',
        guild: true,
        async render(c, top) {
            if (ex.exam) return renderAttempts(c, top);
            refreshBtn(top, () => go('exams'));
            const res = await call('adminExams', {});
            if (!res.ok) return (c.innerHTML = errorBox(res));
            const exams = listOf(res, 'exams');
            if (!exams.length) return (c.innerHTML = `<div class="card">${empty('No exams yet', 'Create exams on guildbase.gg.')}</div>`);
            c.innerHTML = `<div class="grid">${exams.map((e) => `
                <div class="card tpl" style="cursor:pointer" data-exam="${esc(e.id)}">
                    <div style="display:flex;justify-content:space-between;align-items:center"><div class="stat-icon si-purple" style="width:42px;height:42px">${icon('exams')}</div>${e.is_active ? pill('Active', '#10b981') : pill('Inactive', '#737373')}</div>
                    <h3>${esc(e.name)}</h3>
                    <p>${esc(e.description || '')}</p>
                    <div class="tags">
                        ${pill(`${e.questions_count ?? 0} questions`, '#a3a3a3', 'box')}
                        ${e.pass_mark != null ? pill(`Pass ${e.pass_mark}%`, '#a3a3a3', 'box') : ''}
                        ${e.time_limit_minutes ? pill(`${e.time_limit_minutes} min`, '#a3a3a3', 'box') : ''}
                        ${e.certificate_enabled ? pill('Certificate', '#a855f7', 'box') : ''}
                    </div>
                    <div class="foot"><span class="dim small">${esc(e.attempts_count ?? 0)} attempts</span><span class="btn sm">View Attempts →</span></div>
                </div>`).join('')}</div>`;
            $$('[data-exam]', c).forEach((el) => (el.onclick = () => { ex.exam = exams.find((e) => String(e.id) === el.dataset.exam); ex.page = 1; ex.status = ''; go('exams'); }));
        },
    };
    async function renderAttempts(c, top) {
        if (top) topBtn(top, `${icon('back')}All Exams`, () => { ex.exam = null; go('exams'); });
        c.innerHTML = `
            <div class="tabs" id="ex-status">${[['', 'All'], ['submitted', 'Submitted'], ['passed', 'Passed'], ['failed', 'Failed'], ['in_progress', 'In Progress']].map(([v, l]) => `<button data-v="${v}" class="${ex.status === v ? 'active' : ''}">${l}</button>`).join('')}</div>
            <div class="card" id="ex-body">${spinner()}</div>`;
        $$('#ex-status button').forEach((b) => (b.onclick = () => { ex.status = b.dataset.v; ex.page = 1; renderAttempts(c, null); }));
        const res = await call('adminExamAttempts', { id: ex.exam.id, status: ex.status, page: ex.page });
        const body = $('#ex-body');
        if (!res.ok) return (body.innerHTML = errorBox(res));
        const attempts = listOf(res, 'attempts');
        if (!attempts.length) return (body.innerHTML = empty('No attempts'));
        body.innerHTML = `<table class="tbl"><thead><tr><th>Candidate</th><th>Attempt</th><th>Score</th><th>Grade</th><th>Status</th><th>Submitted</th></tr></thead><tbody>
            ${attempts.map((a) => `<tr class="clickable" data-att="${esc(a.id)}">
                <td>${userCell(a.user)}</td>
                <td>#${esc(a.attempt_number ?? '')}</td>
                <td><b style="font-weight:500">${a.percent != null ? esc(Math.round(a.percent)) + '%' : '—'}</b><div class="t2">${a.score != null ? esc(a.score) + ' / ' + esc(a.max_score) : ''}</div></td>
                <td>${esc(a.grade_label || '—')}</td>
                <td>${statusPill(a.status)} ${a.requires_manual_grading ? pill('Needs Grading', '#f59e0b') : ''} ${a.violation_count ? pill(`${a.violation_count} violations`, '#ef4444') : ''}</td>
                <td>${esc(date(a.submitted_at))}<div class="t2">${esc(ago(a.submitted_at))}</div></td>
            </tr>`).join('')}</tbody></table>${pager(metaOf(res), (p) => { ex.page = p; renderAttempts(c, null); })}`;
        $$('[data-att]', body).forEach((r) => (r.onclick = () => showAttempt(r.dataset.att)));
    }
    async function showAttempt(id) {
        const res = await call('adminAttempt', { id });
        if (!res.ok) return toast(res.message, true);
        const a = res.data || {};
        await form({
            title: `${userName(a.user)} · attempt #${a.attempt_number ?? ''}`,
            text: [
                `Score: ${a.score ?? '—'} / ${a.max_score ?? '—'} (${a.percent != null ? Math.round(a.percent) + '%' : '—'})`,
                `Grade: ${a.grade_label || '—'}`,
                `Status: ${label(a.status)}${a.requires_manual_grading ? ' · needs manual grading' : ''}`,
                `Risk: ${label(a.risk_level || 'none')} · Violations: ${a.violation_count ?? 0}`,
                `Time spent: ${a.time_spent_seconds ? Math.round(a.time_spent_seconds / 60) + ' min' : '—'}`,
                `Started ${date(a.started_at)} · Submitted ${date(a.submitted_at)}${a.released_at ? ' · Released ' + date(a.released_at) : ''}`,
            ].join('\n'),
            okText: 'Close', noCancel: true,
        });
    }

    // ─── CERTIFICATES (admin) ─────────────────────────────────
    const ct = { exam_template_id: '', valid: '', page: 1 };
    Views.certs = {
        title: 'Certificates',
        guild: true,
        async render(c) {
            const exams = await call('adminExams', {});
            const list = exams.ok ? listOf(exams, 'exams') : [];
            c.innerHTML = `
                <div class="toolbar">
                    <div class="tabs" id="ct-valid" style="margin:0">${[['', 'All'], ['true', 'Valid'], ['false', 'Revoked']].map(([v, l]) => `<button data-v="${v}" class="${ct.valid === v ? 'active' : ''}">${l}</button>`).join('')}</div>
                    <select class="input" id="ct-exam"><option value="">All exams</option>${list.map((e) => `<option value="${esc(e.id)}" ${String(ct.exam_template_id) === String(e.id) ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
                </div>
                <div class="card" id="ct-body">${spinner()}</div>`;
            $$('#ct-valid button').forEach((b) => (b.onclick = () => { ct.valid = b.dataset.v; ct.page = 1; Views.certs.render(c); }));
            $('#ct-exam').onchange = (e) => { ct.exam_template_id = e.target.value; ct.page = 1; Views.certs.render(c); };
            const res = await call('adminCerts', { exam_template_id: ct.exam_template_id, page: ct.page, valid: ct.valid === '' ? undefined : ct.valid === 'true' });
            const body = $('#ct-body');
            if (!res.ok) return (body.innerHTML = errorBox(res));
            const certs = listOf(res, 'certificates');
            if (!certs.length) return (body.innerHTML = empty('No certificates'));
            body.innerHTML = `<table class="tbl"><thead><tr><th>Recipient</th><th>Exam</th><th>Score</th><th>Code</th><th>Issued</th><th>Status</th><th></th></tr></thead><tbody>
                ${certs.map((x) => {
                    const st = x.is_revoked ? 'revoked' : x.is_valid === false ? 'expired' : 'valid';
                    return `<tr>
                        <td><b style="font-weight:500">${esc(x.recipient_name || userName(x.user))}</b></td>
                        <td>${esc(x.exam_name || '')}</td>
                        <td>${x.score_percent != null ? esc(Math.round(x.score_percent)) + '%' : '—'}<div class="t2">${esc(x.grade_label || '')}</div></td>
                        <td><span class="code-chip">${esc(x.code || '')}</span></td>
                        <td>${esc(date(x.issued_at))}${x.expires_at ? `<div class="t2">Expires ${esc(date(x.expires_at))}</div>` : ''}</td>
                        <td>${statusPill(st)}${x.revoked_reason ? `<div class="t2">${esc(x.revoked_reason)}</div>` : ''}</td>
                        <td class="r">${x.is_revoked ? '' : `<button class="btn red sm" data-revoke="${esc(x.id)}" data-name="${esc(x.recipient_name || '')}">Revoke</button>`}</td>
                    </tr>`;
                }).join('')}</tbody></table>${pager(metaOf(res), (p) => { ct.page = p; Views.certs.render(c); })}`;
            $$('[data-revoke]', body).forEach((b) => (b.onclick = async () => {
                const r = await form({ title: `Revoke certificate${b.dataset.name ? ' for ' + b.dataset.name : ''}?`, fields: [{ key: 'reason', label: 'Reason (optional)', type: 'textarea', rows: 3 }], okText: 'Revoke', okClass: 'red' });
                if (!r) return;
                const res = await call('adminCertRevoke', { id: b.dataset.revoke, reason: r.reason });
                toast(res.ok ? 'Certificate revoked.' : res.message, !res.ok);
                if (res.ok) Views.certs.render(c);
            }));
        },
    };

    function applyTheme(st) {
        const t = st?.display?.theme ?? st?.theme;
        document.body.classList.toggle('light', t === 'light');
    }

    // ─── browser preview data (not used in game) ──────────────
    const now = Date.now();
    const ts = (h) => new Date(now - h * 3600e3).toISOString();
    const roles = [
        { id: 1, name: 'Owner', color: '#ef4444', position: 0, members_count: 2, discord_role_id: '1102938475610293847', permissions: ['applications.view', 'applications.review', 'applications.manage'] },
        { id: 2, name: 'Recruitment Staff', color: '#a855f7', position: 1, members_count: 9, discord_role_id: '1102938475610293848', permissions: ['applications.view', 'applications.review'] },
        { id: 3, name: 'Member', color: '#737373', position: 9, members_count: 412, is_default: true },
    ];
    const ST = { pending: { id: 9, name: 'Pending Review', color: '#f59e0b' }, review: { id: 10, name: 'Under Review', color: '#3b82f6' }, acc: { id: 12, name: 'Accepted', color: '#10b981', is_final: true, final_status: 'accepted' }, rej: { id: 13, name: 'Rejected', color: '#ef4444', is_final: true, final_status: 'rejected' } };
    const Mock = {
        init: () => ({ ok: true, data: {
            community: 'Example Roleplay', playerName: 'RiverStone', unread: 2, isAdmin: true,
            guild: { name: 'Example Roleplay', member_count: 423, is_pro: true },
            staff: { guild: { name: 'Example Roleplay' }, staff: { role: { name: 'Owner' } },
                permissions: { view: true, manage: true, review: true, overturn: true, delete: true, analytics: true, claim: true, ai_check: true },
                counts: { total: 39, open: 7, flagged: 1 },
                templates: [{ id: 1, name: "Sheriff's Office Application" }, { id: 2, name: 'SADOT Application' }, { id: 3, name: 'SAFR Application' }] } } }),
        templates: () => ({ ok: true, data: [
            { slug: 'bcso', name: "Sheriff's Office Application", description: 'Blaine County & Los Santos County Sheriff. Must be 18+ with a working mic.' },
            { slug: 'sadot', name: 'SADOT Application', description: 'Tow, road maintenance and traffic control across San Andreas.', closes_at: '2026-12-01' },
            { slug: 'safr', name: 'SAFR Application', description: 'Fire & EMS. No prior experience needed — training provided at Station 5.' },
        ] }),
        startApply: () => ({ ok: true, data: { embed_url: 'about:blank', expires_at: ts(-1) } }),
        myApps: () => ({ ok: true, data: { applications: [
            { id: 'a', status: 'in_review', template: { name: 'SADOT Application' }, stage: ST.review, submitted_at: ts(48), can_withdraw: true },
            { id: 'b', status: 'accepted', is_final: true, template: { name: 'Civilian Whitelist' }, stage: ST.acc, submitted_at: ts(480) },
        ] } }),
        withdraw: () => ({ ok: true, data: { message: 'Withdrawn (preview).' } }),
        inbox: () => ({ ok: true, data: [
            { kind: 'stage', subject: 'Your SADOT application moved to Under Review', message: 'Hi RiverStone,\n\nA staff member is reviewing your application now.', created_at: ts(1) },
            { kind: 'submitted', subject: 'Application received', read: true, created_at: ts(48) },
        ] }),
        clearInbox: () => ({ ok: true, data: [] }),
        staffList: () => ({ ok: true, data: [
            { id: '4f2c91d7', status: 'pending', current_stage: ST.pending, risk_level: 'high', user: { display_name: 'nova_rides', username: 'nova_rides' }, template: { name: 'SADOT Application' }, submitted_at: ts(72) },
            { id: '2', status: 'accepted', is_final: true, current_stage: ST.acc, user: { display_name: 'ColeHarrison', username: 'coleharrison' }, template: { name: "Sheriff's Office Application" }, submitted_at: ts(24) },
            { id: '3', status: 'in_review', current_stage: ST.review, is_claimed: true, user: { display_name: 'jxnny.v', username: 'jxnny.v' }, template: { name: 'SADOT Application' }, submitted_at: ts(240) },
            { id: '4', status: 'withdrawn', is_final: true, user: { display_name: 'dustyroads22', username: 'dustyroads22' }, template: { name: 'SADOT Application' }, submitted_at: ts(160) },
        ], meta: { current_page: 1, last_page: 2, total: 39, has_more: true } }),
        staffGet: () => ({ ok: true, data: {
            application: { id: '4f2c91d7', status: 'pending', risk_level: 'high', flags: ['pasted_content'], time_spent_seconds: 160, revision_count: 0, submitted_at: ts(72), updated_at: ts(72),
                user: { display_name: 'nova_rides', username: 'nova_rides', discord_id: '284719305512448001' }, template: { name: 'SADOT Application' }, current_stage: ST.pending,
                answers: [{ title: 'SADOT Application', fields: [
                    { label: 'Name of Character', type: 'text', value: 'Sam Rivers' },
                    { label: 'Why do you want to join SADOT?', type: 'textarea', value: 'I work for the DOT irl, and believe this would be a good way to get introduced to the server.' },
                    { label: 'Are you able to be active at least 1hr a week', type: 'radio', value: 'yes' },
                    { label: 'If someone is trying to get back in their vehicle while you are towing it, what do you do?', type: 'select', value: 'call_law_enforcement' },
                ] }] },
            stages: [ST.pending, ST.review, ST.acc, ST.rej],
            can_be_pushed_back: true, permissions: { view: true, manage: true, review: true, overturn: true, delete: true, claim: true, ai_check: true },
            history: [{ description: 'Application submitted', created_at: ts(72) }, { description: 'Flagged: pasted content detected', created_at: ts(72) }],
        } }),
        staffAction: (d) => ({ ok: true, data: d.action === 'ai-check' ? { interpretation: 'Likely human-written (12% AI likelihood).' } : { message: 'Done (preview).' } }),
        adminMembers: () => ({ ok: true, data: [
            { id: 1, joined_at: ts(2000), role: roles[0], user: { display_name: 'RiverStone', username: 'RiverStone' } },
            { id: 2, joined_at: ts(900), role: roles[1], user: { display_name: 'AshByrne', username: 'ash.byrne' } },
            { id: 3, joined_at: ts(40), role: roles[2], user: { display_name: 'nova_rides', username: 'nova_rides' } },
        ], meta: { current_page: 1, last_page: 9, total: 423, has_more: true } }),
        adminMemberAdd: () => ({ ok: true, data: {} }),
        adminMemberRole: () => ({ ok: true, data: {} }),
        adminMemberRemove: () => ({ ok: true, data: { deleted: true } }),
        adminRoles: () => ({ ok: true, data: roles }),
        adminRoleGet: (d) => ({ ok: true, data: roles.find((r) => String(r.id) === String(d.id)) }),
        adminRoleSave: () => ({ ok: true, data: {} }),
        adminRoleDelete: () => ({ ok: true, data: { deleted: true } }),
        adminExams: () => ({ ok: true, data: [
            { id: 1, name: 'Sheriff Academy Written Exam', description: 'Penal code, use of force and radio procedure.', is_active: true, questions_count: 40, pass_mark: 80, time_limit_minutes: 45, certificate_enabled: true, attempts_count: 58 },
            { id: 2, name: 'SADOT Tow Certification', description: 'Scene safety, impound rules and traffic control.', is_active: true, questions_count: 25, pass_mark: 85, time_limit_minutes: 30, certificate_enabled: true, attempts_count: 14 },
        ] }),
        adminExamAttempts: () => ({ ok: true, data: [
            { id: 11, attempt_number: 1, status: 'passed', score: 36, max_score: 40, percent: 90, grade_label: 'Distinction', user: { display_name: 'ColeHarrison', username: 'coleharrison' }, submitted_at: ts(5) },
            { id: 12, attempt_number: 2, status: 'failed', score: 29, max_score: 40, percent: 72.5, grade_label: 'Fail', violation_count: 2, user: { display_name: 'marlowe_k', username: 'marlowe_k' }, submitted_at: ts(26) },
        ] }),
        adminAttempt: () => ({ ok: true, data: { attempt_number: 1, status: 'passed', score: 36, max_score: 40, percent: 90, grade_label: 'Distinction', risk_level: 'low', violation_count: 0, time_spent_seconds: 1980, user: { display_name: 'ColeHarrison' }, started_at: ts(6), submitted_at: ts(5) } }),
        adminCerts: () => ({ ok: true, data: [
            { id: 1, code: 'GB-7KQ2', recipient_name: 'ColeHarrison', exam_name: 'Sheriff Academy Written Exam', score_percent: 90, grade_label: 'Distinction', is_valid: true, issued_at: ts(5), expires_at: '2027-11-13' },
            { id: 3, code: 'GB-1AB4', recipient_name: 'Former Deputy', exam_name: 'Sheriff Academy Written Exam', score_percent: 81, is_valid: false, is_revoked: true, revoked_reason: 'Left department', issued_at: ts(3000) },
        ] }),
        adminCertRevoke: () => ({ ok: true, data: {} }),
    };

    // ─── boot ─────────────────────────────────────────────────
    (async () => {
        $('#content').innerHTML = spinner();
        if (!PREVIEW) {
            if (!(await waitForBridge())) {
                $('#content').innerHTML = empty('Could not start', 'LB Tablet did not load the app bridge. Reopen the app.');
                return;
            }
            applyTheme(globalThis.settings);
            globalThis.onSettingsChange?.(applyTheme);
            globalThis.onNuiEvent('mail', async () => {
                await refreshInit();
                if (['inbox', 'mine', 'home'].includes(state.view)) go(state.view);
            });
            // full-screen page unavailable: show the form inside the tablet instead
            // full-screen page didn't load (resource not restarted after updating)
            globalThis.onNuiEvent('applyFallback', () => {
                toast('The application window could not open. Ask staff to run "restart gb-tablet".', true);
            });
            globalThis.onNuiEvent('browserOpened', (d) => toast(d?.message || 'Opened in your browser.', !d?.ok));
            globalThis.onNuiEvent('applyClosed', async (d) => {
                if (d?.submitted) toast('Application submitted!');
                await refreshInit();
                state.view = 'mine';
                renderSidebar();
                setHead(Views.mine);
                $('#top-actions').innerHTML = '';
                Views.mine.render($('#content'), $('#top-actions'), true);
            });
            globalThis.onNuiEvent('closed', () => { lockSent = null; });
            let lastOpen = 0;
            globalThis.onNuiEvent('opened', async () => {
                if (Date.now() - lastOpen < 2000) return;
                lastOpen = Date.now();
                lockSent = null;
                syncLock(); // re-assert if the form was still open when the tablet was reopened
                await refreshInit();
                if (['home', 'mine', 'inbox'].includes(state.view)) go(state.view);
            });
        }
        if (await refreshInit()) go('home');
    })();
})();
