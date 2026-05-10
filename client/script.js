// ════════════════════════════════════════════════════════════
// CONFIG — point WORKER_URL at your deployed Cloudflare Worker
// ════════════════════════════════════════════════════════════
const WORKER_URL = 'https://liltask-sync.abdullahalkafajy.workers.dev/';
// If no worker deployed, app works offline-only (no sync indicator shown)

// ─── State ────────────────────────────────────────────────
let lists = {}; // { listId: { name, roomId } }
let activeListId = null;
let currentView = 'lists';
let calYear, calMonth;
let plugins = { categoryGroup: false, finishRewards: false };
let stores = {}; // { listId: store from createStore() }
let syncTimers = {};

const now = new Date();
calYear = now.getFullYear();
calMonth = now.getMonth();

// ─── Persistence ──────────────────────────────────────────
function save() {
    localStorage.setItem('liltask_lists', JSON.stringify(lists));
    localStorage.setItem('liltask_plugins', JSON.stringify(plugins));
    localStorage.setItem('liltask_active', activeListId);
}

function load() {
    try {
        lists = JSON.parse(localStorage.getItem('liltask_lists') || '{}');
        plugins = JSON.parse(localStorage.getItem('liltask_plugins') || '{"categoryGroup":false,"finishRewards":false}');
        activeListId = localStorage.getItem('liltask_active');
    } catch(e) {
        lists = {}; plugins = { categoryGroup: false, finishRewards: false };
    }
}

// ─── Room ID (URL-based collaboration) ───────────────────
function getRoomFromURL() {
    const hash = location.hash.slice(1);
    if (hash && hash.startsWith('room:')) {
        const rest = hash.slice(5); // roomId:encodedName  OR  roomId (legacy)
        const colonIdx = rest.indexOf(':');
        if (colonIdx !== -1) {
            return { roomId: rest.slice(0, colonIdx), name: decodeURIComponent(rest.slice(colonIdx + 1)) };
        }
        return { roomId: rest, name: 'Shared List' };
    }
    return null;
}

function generateId(len = 10) {
    return Math.random().toString(36).slice(2, 2 + len) +
    Math.random().toString(36).slice(2, 2 + Math.max(0, len - 10));
}

// ─── Custom CRDT store per list ──────────────────────────
function getOrCreateStore(listId) {
    if (stores[listId]) return stores[listId];
    const store = window.CRDT.createStore();
    stores[listId] = store;

    // Load persisted state
    const stored = localStorage.getItem('liltask_ydoc_' + listId);
    if (stored) {
        try {
            const arr = Uint8Array.from(JSON.parse(stored));
            const deltas = window.CRDT.decodeUpdates(arr.buffer);
            store.applyUpdate(deltas);
        } catch(e) {}
    }

    // Persist + re-render on change
    store.observe(() => {
        const state = store.encodeFullState();
        localStorage.setItem('liltask_ydoc_' + listId, JSON.stringify(Array.from(state)));
        scheduleSync(listId);
        renderTodos();
        renderListsNav();
        updateProgress();
        if (currentView === 'calendar') renderCalendar();
    });

    return store;
}

// Alias for compatibility with calendar/render code
function getOrCreateYDoc(listId) { return getOrCreateStore(listId); }

function getYTodos(listId) {
    return {
        toArray: () => getOrCreateStore(listId).getState(),
        get length() { return getOrCreateStore(listId).getState().length; }
    };
}

function getTodosForDate(listId, dateKey) {
    return getOrCreateStore(listId).getState().filter(t => t.dueDate === dateKey);
}

// ─── Sync to/from Worker ──────────────────────────────────
function setSyncStatus(state) {
    const dot = document.getElementById('sync-dot');
    const label = document.getElementById('sync-label');
    if (!dot) return;
    dot.className = 'sync-dot ' + state;
    label.textContent = state === 'synced' ? 'synced' : state === 'syncing' ? 'syncing…' : state === 'error' ? 'error' : 'offline';
}

let isPulling = false; // guard: don't push during/after pull

function getWorkerUrl() {
    return window._customWorkerUrl || localStorage.getItem('liltask_worker_url') || WORKER_URL;
}

async function pushUpdate(listId) {
    const list = lists[listId];
    const workerUrl = getWorkerUrl();
    if (!list || !list.roomId || workerUrl.includes('YOUR_WORKER')) return;
    const store = getOrCreateStore(listId);

    const framed = store.encodeFullState();
    if (!framed || framed.length <= 4) return;

    try {
        setSyncStatus('syncing');
        const r = await fetch(workerUrl + '/' + list.roomId, {
            method: 'POST',
            body: framed,
            headers: { 'Content-Type': 'application/octet-stream' }
        });
        if (r.ok) setSyncStatus('synced');
        else setSyncStatus('error');
    } catch(e) { setSyncStatus('error'); }
}

async function pullUpdate(listId) {
    const list = lists[listId];
    const workerUrl = getWorkerUrl();
    if (!list || !list.roomId || workerUrl.includes('YOUR_WORKER')) return;
    try {
        const r = await fetch(workerUrl + '/' + list.roomId);
        if (r.status === 204) return;
        if (r.ok) {
            const buf = await r.arrayBuffer();
            const store = getOrCreateStore(listId);
            const deltas = window.CRDT.decodeUpdates(buf);
            if (deltas.length > 0) {
                isPulling = true;
                store.applyUpdate(deltas);
                isPulling = false;
            }
            setSyncStatus('synced');
        }
    } catch(e) { setSyncStatus('error'); }
}

function scheduleSync(listId) {
    if (isPulling) return; // don't echo remote changes back
    clearTimeout(syncTimers[listId]);
    syncTimers[listId] = setTimeout(() => pushUpdate(listId), 800);
}

// ─── List Management ──────────────────────────────────────
function createList(name, roomId = null) {
    const id = generateId();
    roomId = roomId || generateId(16);
    lists[id] = { name: name || 'Untitled', roomId };
    save();
    getOrCreateStore(id); // init
    return id;
}

function ensureDefaultList() {
    if (Object.keys(lists).length === 0) {
        const id = createList('My List');
        activeListId = id;
        save();
    }
    if (!activeListId || !lists[activeListId]) {
        activeListId = Object.keys(lists)[0];
        save();
    }
}

function switchList(id) {
    activeListId = id;
    save();
    document.getElementById('header-title').textContent = lists[id]?.name || 'List';
    renderListsNav();
    renderTodos();
    updateProgress();
    pullUpdate(id);
    touchListTTL(id);
    if (window.innerWidth <= 640) closeSidebar();
}

function touchListTTL(listId) {
    const list = lists[listId];
    const workerUrl = getWorkerUrl();
    if (!list || !list.roomId || workerUrl.includes('YOUR_WORKER')) return;
    const store = getOrCreateStore(listId);
    const framed = store.encodeFullState();
    if (!framed || framed.length <= 4) return;
    fetch(workerUrl + '/' + list.roomId, {
        method: 'POST',
        body: framed,
        headers: { 'Content-Type': 'application/octet-stream' }
    }).catch(() => {});
}

window.deleteList = function(listId) {
    if (Object.keys(lists).length <= 1) {
        openModal(`<div class="modal-title">Can't delete</div>
        <p style="color:var(--text3);font-size:14px;margin-bottom:16px">You need at least one list.</p>
        <div class="modal-actions"><button class="modal-btn primary" onclick="closeModal()">OK</button></div>`);
        return;
    }
    const listName = escHtml(lists[listId]?.name || 'this list');
    openModal(`<div class="modal-title">Delete list?</div>
    <p style="color:var(--text3);font-size:14px;margin-bottom:16px">Delete <strong style="color:var(--text)">${listName}</strong>? This removes it from your device only — collaborators keep their copy.</p>
    <div class="modal-actions">
    <button class="modal-btn" onclick="closeModal()">Cancel</button>
    <button class="modal-btn" style="background:var(--red);border-color:var(--red);color:#fff" onclick="confirmDeleteList('${listId}')">Delete</button>
    </div>`);
};

window.confirmDeleteList = function(listId) {
    delete lists[listId];
    localStorage.removeItem('liltask_ydoc_' + listId);
    delete stores[listId];
    if (activeListId === listId) {
        activeListId = Object.keys(lists)[0] || null;
    }
    save();
    closeModal();
    ensureDefaultList();
    renderListsNav();
    switchList(activeListId);
};

window.manualSync = async function() {
    const btn = document.getElementById('sync-btn');
    if (btn) btn.classList.add('spinning');
    await pullUpdate(activeListId);
    if (btn) {
        btn.classList.remove('spinning');
    }
};

// ─── Add / Toggle / Delete Todo ──────────────────────────
function addTodo() {
    const inp = document.getElementById('todo-input');
    const text = inp.value.trim();
    if (!text || !activeListId) return;
    const store = getOrCreateStore(activeListId);
    const { encoded } = store.addTodo(text);
    inp.value = '';
    inp.focus();
}

document.getElementById('todo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
});

function toggleTodo(listId, todoId) {
    const store = getOrCreateStore(listId);
    store.toggleTodo(todoId);
    checkFinishReward(listId);
}

function deleteTodo(listId, todoId) {
    getOrCreateStore(listId).deleteTodo(todoId);
}

function editTodo(listId, todoId, newText) {
    getOrCreateStore(listId).editTodo(todoId, newText);
}

function reorderTodo(listId, fromIdx, toIdx) {
    // LWW store sorts by HLC — reorder not directly supported.
    // Swap HLC timestamps to influence sort order as best-effort.
    const store = getOrCreateStore(listId);
    const arr = store.getState();
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return;
    // editTodo with same text triggers new HLC, moving item to end — acceptable UX trade-off
    store.editTodo(arr[fromIdx].id, arr[fromIdx].text);
}

// ─── Finish Reward ────────────────────────────────────────
const CELEBRATE_EMOJIS = ['🎉','🥳','✨','🎊','🏆','💫','🌟','🎆'];
let celebrateTimeout;

function checkFinishReward(listId) {
    if (!plugins.finishRewards) return;
    const arr = getOrCreateStore(listId).getState();
    if (arr.length === 0) return;
    const allDone = arr.every(t => t.done);
    if (allDone) celebrate();
}

function celebrate() {
    const el = document.getElementById('celebration');
    const emoji = document.getElementById('celebrate-emoji');
    emoji.textContent = CELEBRATE_EMOJIS[Math.floor(Math.random() * CELEBRATE_EMOJIS.length)];
    el.classList.add('active');
    clearTimeout(celebrateTimeout);
    celebrateTimeout = setTimeout(() => el.classList.remove('active'), 2800);
}

// ─── Category Grouping ────────────────────────────────────
const CATEGORY_KEYWORDS = {
    '🥦 Produce':    ['apple','banana','orange','grape','lettuce','spinach','kale','tomato','onion','garlic','carrot','broccoli','pepper','potato','avocado','lemon','lime','berry','berries','mango','celery','cucumber','zucchini','mushroom','herbs','basil','cilantro','parsley'],
    '🥩 Meat & Fish':['chicken','beef','pork','fish','salmon','tuna','shrimp','turkey','lamb','steak','bacon','sausage','meat'],
    '🧀 Dairy':      ['milk','cheese','yogurt','butter','cream','egg','eggs','dairy'],
    '🍞 Bakery':     ['bread','bagel','muffin','cake','cookie','tortilla','bun','roll','pastry','croissant'],
    '🥫 Pantry':     ['pasta','rice','bean','beans','lentil','soup','can','canned','sauce','oil','vinegar','spice','flour','sugar','salt','cereal','oat','oats','jam','peanut'],
    '🧴 Household':  ['soap','shampoo','toothpaste','detergent','toilet','paper','towel','cleaner','bleach','trash','bag','bags','dishwasher'],
    '🥤 Drinks':     ['water','juice','milk','coffee','tea','soda','wine','beer','drink','drinks','beverage'],
    '🧊 Frozen':     ['frozen','ice cream','pizza','fries'],
};

function categorize(text) {
    const lower = text.toLowerCase();
    for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
        if (words.some(w => lower.includes(w))) return cat;
    }
    return '📋 Other';
}

// ─── Render Todos ─────────────────────────────────────────
function renderTodos() {
    if (!activeListId || currentView !== 'lists') return;
    const container = document.getElementById('todos-container');
    const arr = getOrCreateStore(activeListId).getState();

    if (arr.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="es-icon">📝</div><div class="es-title">No tasks yet</div><div class="es-desc">Add your first task above</div></div>`;
        return;
    }

    const global = arr.map((item, idx) => ({ ...item, idx })).filter(t => !t.dueDate);
    const dated  = arr.map((item, idx) => ({ ...item, idx })).filter(t => !!t.dueDate);

    // Sort dated by dueDate ascending
    dated.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    let html = '';

    if (global.length > 0) {
        html += `<div class="section-header">📋 Global Todos <span class="sh-count">${global.length}</span></div>`;
        if (plugins.categoryGroup) {
            const groups = {};
            global.forEach(item => {
                const cat = categorize(item.text);
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(item);
            });
            for (const [cat, items] of Object.entries(groups)) {
                html += `<div class="category-header">${cat}</div>`;
                items.forEach(item => { html += todoHTML(item, item.idx); });
            }
        } else {
            global.forEach(item => { html += todoHTML(item, item.idx); });
        }
    }

    if (dated.length > 0) {
        html += `<div class="section-header">📅 Todos with Dues <span class="sh-count">${dated.length}</span></div>`;
        dated.forEach(item => { html += todoHTML(item, item.idx); });
    }

    container.innerHTML = html;
    attachTodoListeners();
    attachDragListeners();
}

function dueBadgeHTML(item) {
    if (!item.dueDate) return '';
    const [y,m,d] = item.dueDate.split('-').map(Number);
    const due = new Date(y, m-1, d);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((due - today) / 86400000);
    let label, cls = '';
    if (diff < 0) { label = 'Overdue'; cls = 'overdue'; }
    else if (diff === 0) { label = 'Today'; }
    else if (diff === 1) { label = 'Tomorrow'; }
    else {
        const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        label = mo[m-1] + ' ' + d;
    }
    return `<span class="due-badge ${cls}">${label}</span>`;
}

function todoHTML(item, idx) {
    return `<div class="todo-item ${item.done ? 'done' : ''}" data-idx="${idx}" data-id="${item.id}" draggable="true">
    <div class="drag-handle" title="Drag to reorder">⣿</div>
    <button class="todo-check ${item.done ? 'checked' : ''}" data-id="${item.id}" onclick="toggleTodo('${activeListId}', '${item.id}')"></button>
    <div class="todo-text" contenteditable="true" data-idx="${idx}" data-id="${item.id}" spellcheck="true">${escHtml(item.text)}</div>
    ${dueBadgeHTML(item)}
    <div class="todo-actions">
    <button class="todo-act-btn" onclick="deleteTodo('${activeListId}', '${item.id}')" title="Delete">✕</button>
    </div>
    </div>`;
}

function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function attachTodoListeners() {
    document.querySelectorAll('.todo-text').forEach(el => {
        el.addEventListener('blur', () => {
            const todoId = el.dataset.id;
            const newText = el.textContent.trim();
            if (newText) editTodo(activeListId, todoId, newText);
            else renderTodos();
        });
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
            });
    });
}

function attachDragListeners() {
    let dragIdx = null;
    let overIdx = null;

    document.querySelectorAll('#todos-container .todo-item').forEach(el => {
        const handle = el.querySelector('.drag-handle');

        // Desktop drag via handle
        handle.addEventListener('mousedown', () => { el.draggable = true; });
        el.addEventListener('dragstart', e => {
            dragIdx = parseInt(el.dataset.idx);
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            document.querySelectorAll('.todo-item').forEach(i => i.classList.remove('drag-over'));
            if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
                reorderTodo(activeListId, dragIdx, overIdx);
            }
            dragIdx = null; overIdx = null;
            el.draggable = false;
        });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            document.querySelectorAll('.todo-item').forEach(i => i.classList.remove('drag-over'));
            overIdx = parseInt(el.dataset.idx);
            if (overIdx !== dragIdx) el.classList.add('drag-over');
        });

            // Touch drag
            let touchStartY = 0, touchDragIdx = null;
            handle.addEventListener('touchstart', e => {
                touchStartY = e.touches[0].clientY;
                touchDragIdx = parseInt(el.dataset.idx);
                el.classList.add('dragging');
            }, { passive: true });
            handle.addEventListener('touchmove', e => {
                e.preventDefault();
                const y = e.touches[0].clientY;
                const els = [...document.querySelectorAll('#todos-container .todo-item')];
                document.querySelectorAll('.todo-item').forEach(i => i.classList.remove('drag-over'));
                const target = els.find(item => {
                    const r = item.getBoundingClientRect();
                    return y >= r.top && y <= r.bottom;
                });
                if (target) {
                    overIdx = parseInt(target.dataset.idx);
                    if (overIdx !== touchDragIdx) target.classList.add('drag-over');
                }
            }, { passive: false });
            handle.addEventListener('touchend', () => {
                el.classList.remove('dragging');
                document.querySelectorAll('.todo-item').forEach(i => i.classList.remove('drag-over'));
                if (touchDragIdx !== null && overIdx !== null && touchDragIdx !== overIdx) {
                    reorderTodo(activeListId, touchDragIdx, overIdx);
                }
                touchDragIdx = null; overIdx = null;
            });
    });
}

function updateProgress() {
    if (!activeListId) return;
    const arr = getOrCreateStore(activeListId).getState();
    const done = arr.filter(t => t.done).length;
    const total = arr.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent = `${done} / ${total}`;
}

// ─── Lists Nav ────────────────────────────────────────────
function renderListsNav() {
    const nav = document.getElementById('lists-nav');
    nav.innerHTML = Object.entries(lists).map(([id, list]) => {
        const count = getOrCreateStore(id).getState().length;
        const active = id === activeListId ? 'active' : '';
        return `<div class="list-item ${active}" onclick="switchList('${id}')">
        <div class="li-dot"></div>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(list.name)}</span>
        <span class="li-count">${count}</span>
        <button class="li-delete-btn" onclick="event.stopPropagation();deleteList('${id}')" title="Delete list">✕</button>
        </div>`;
    }).join('');
}

// ─── New List Modal ───────────────────────────────────────
document.getElementById('new-list-btn').onclick = () => {
    openModal(`<div class="modal-title">New list</div>
    <input class="modal-input" id="nl-name" placeholder="List name…" autocomplete="off"/>
    <div class="modal-actions">
    <button class="modal-btn" onclick="closeModal()">Cancel</button>
    <button class="modal-btn primary" onclick="createAndSwitch()">Create</button>
    </div>`);
    setTimeout(() => document.getElementById('nl-name')?.focus(), 50);
    document.getElementById('nl-name').addEventListener('keydown', e => {
        if (e.key === 'Enter') createAndSwitch();
    });
};

window.createAndSwitch = function() {
    const name = document.getElementById('nl-name')?.value.trim();
    if (!name) return;
    const id = createList(name);
    activeListId = id;
    save();
    closeModal();
    renderListsNav();
    renderTodos();
    updateProgress();
    document.getElementById('header-title').textContent = name;
};

// ─── Share Modal ──────────────────────────────────────────
window.openShareModal = function() {
    const list = lists[activeListId];
    if (!list) return;
    const encodedName = encodeURIComponent(list.name);
    const shareUrl = location.origin + location.pathname + '#room:' + list.roomId + ':' + encodedName;
    openModal(`<div class="modal-title">Share list</div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:12px">Anyone with this link can collaborate in real time — no sign up needed.</p>
    <div class="share-link-box">
    <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${shareUrl}</span>
    <button class="share-copy-btn" id="copy-btn" onclick="copyShareLink('${shareUrl}')">Copy</button>
    </div>
    <div class="modal-actions"><button class="modal-btn primary" onclick="closeModal()">Done</button></div>`);
};

window.copyShareLink = function(url) {
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copy-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { if(btn) btn.textContent = 'Copy'; }, 2000); }
    });
};

// ─── Plugins Modal ────────────────────────────────────────
const PLUGIN_DEFS = [
    {
        id: 'categoryGroup',
        icon: '🏷️',
        name: 'Category Grouper',
        desc: 'Groups similar items together (great for grocery lists). Detects produce, dairy, meat, household items, and more.'
    },
{
    id: 'finishRewards',
    icon: '🎉',
    name: 'Finish Rewards',
    desc: 'When you complete every task on a list, a celebratory emoji bursts onto the screen!'
}
];

window.openPluginsModal = function() {
    const cards = PLUGIN_DEFS.map(p => `
    <div class="plugin-card ${plugins[p.id] ? 'enabled' : ''}" id="pcard-${p.id}">
    <div class="plugin-icon">${p.icon}</div>
    <div class="plugin-info">
    <div class="plugin-name">${p.name}</div>
    <div class="plugin-desc">${p.desc}</div>
    </div>
    <button class="plugin-toggle ${plugins[p.id] ? 'on' : ''}" id="ptoggle-${p.id}" onclick="togglePlugin('${p.id}')"></button>
    </div>`).join('');

    openModal(`<div class="modal-title">⚙ Plugins</div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px">Enable or disable plugins anytime. Changes apply instantly.</p>
    ${cards}
    <div class="modal-actions"><button class="modal-btn primary" onclick="closeModal()">Done</button></div>`);
};

window.togglePlugin = function(id) {
    plugins[id] = !plugins[id];
    save();
    const toggle = document.getElementById('ptoggle-' + id);
    const card = document.getElementById('pcard-' + id);
    if (toggle) toggle.classList.toggle('on', plugins[id]);
    if (card) card.classList.toggle('enabled', plugins[id]);
    renderTodos();
};

// ─── Calendar ─────────────────────────────────────────────
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function renderCalendar() {
    document.getElementById('cal-title').textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

    const header = document.getElementById('cal-header');
    header.innerHTML = DAY_NAMES.map(d => `<div class="cal-day-name">${d}</div>`).join('');

    const grid = document.getElementById('cal-grid');
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();
    const today = new Date();

    let cells = '';

    // Prev month overflow
    for (let i = firstDay - 1; i >= 0; i--) {
        const d = daysInPrev - i;
        cells += calCell(calYear, calMonth - 1, d, true, today);
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        cells += calCell(calYear, calMonth, d, false, today);
    }
    // Next month overflow
    const total = firstDay + daysInMonth;
    const nextCells = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= nextCells; d++) {
        cells += calCell(calYear, calMonth + 1, d, true, today);
    }

    grid.innerHTML = cells;
}

function calCell(year, month, day, otherMonth, today) {
    const realMonth = ((month % 12) + 12) % 12;
    const realYear = year + Math.floor(month / 12);
    const dateKey = `${realYear}-${String(realMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = today.getFullYear() === realYear && today.getMonth() === realMonth && today.getDate() === day;

    // Collect all cal todos for this date across all lists
    const allTodos = getCalTodosForDate(dateKey);
    const hasTodos = allTodos.length > 0;

    const previews = allTodos.slice(0, 2).map(t =>
    `<div class="cal-todo-preview ${t.done ? 'done-prev' : ''}">${escHtml(t.text.substring(0, 18))}${t.text.length > 18 ? '…' : ''}</div>`
    ).join('');

    const dots = allTodos.slice(0, 7).map(t =>
    `<div class="cal-dot ${t.done ? 'done-dot' : ''}"></div>`
    ).join('');
    const dotsHTML = hasTodos ? `<div class="cal-dots">${dots}</div>` : '';

    return `<div class="cal-cell ${otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasTodos ? 'has-todos' : ''}"
    onclick="openCalDateModal('${dateKey}')">
    <div class="cal-date">${day}</div>
    ${previews}
    ${dotsHTML}
    </div>`;
}

function getCalTodosForDate(dateKey) {
    const result = [];
    for (const listId of Object.keys(lists)) {
        getOrCreateStore(listId).getState()
        .filter(t => t.dueDate === dateKey)
        .forEach(t => result.push({ ...t, listName: lists[listId]?.name }));
    }
    return result;
}

window.calNav = function(dir) {
    calMonth += dir;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
};

// ─── Calendar Date Modal ──────────────────────────────────
window.openCalDateModal = function(dateKey) {
    const [y, m, d] = dateKey.split('-');
    const label = `${MONTH_NAMES[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;

    function buildModalHTML() {
        const items = getOrCreateStore(activeListId).getState()
        .filter(t => t.dueDate === dateKey);

        const itemsHTML = items.length
        ? items.map(t => `
        <div class="cal-modal-todo" data-id="${t.id}">
        <button class="todo-check ${t.done ? 'checked' : ''}" onclick="calToggleTodo('${dateKey}', '${t.id}')"></button>
        <span style="flex:1;${t.done ? 'text-decoration:line-through;color:var(--text3)' : ''}">${escHtml(t.text)}</span>
        <button class="todo-act-btn" onclick="calDeleteTodo('${dateKey}', '${t.id}')">✕</button>
        </div>`).join('')
        : `<p style="color:var(--text3);font-size:13px;padding:8px 0">No tasks for this day yet.</p>`;

        return itemsHTML;
    }

    openModal(`<div class="modal-title">📅 ${label}</div>
    <p style="color:var(--text3);font-size:12px;margin-bottom:12px">Tasks from: <strong>${escHtml(lists[activeListId]?.name || 'current list')}</strong></p>
    <div id="cal-date-todos">${buildModalHTML()}</div>
    <div style="display:flex;gap:8px;margin-top:14px">
    <input class="modal-input" id="cal-todo-inp" placeholder="Add task for this day…" style="margin-bottom:0;flex:1" autocomplete="off"/>
    <button class="modal-btn primary" onclick="calAddTodo('${dateKey}')">Add</button>
    </div>
    <div class="modal-actions"><button class="modal-btn primary" onclick="closeModal();renderCalendar()">Done</button></div>`);
    setTimeout(() => {
        const inp = document.getElementById('cal-todo-inp');
        if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') calAddTodo(dateKey); });
    }, 50);
    window._calDateKey = dateKey;
};

window.calAddTodo = function(dateKey) {
    const inp = document.getElementById('cal-todo-inp');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    const store = getOrCreateStore(activeListId);
    // addTodo then patch dueDate via editTodo workaround:
    // crdt.mjs addTodo doesn't support dueDate — use internal mutate via a snapshot trick.
    // We extend by calling store's addTodo then immediately storing a patched record.
    // Simplest: add to store with dueDate by directly using the store's internal API.
    // Since crdt.mjs doesn't expose addTodo with extra fields, we replicate the pattern:
    const { CRDT } = window;
    // Use encodeUpdate/decodeUpdates round-trip isn't needed — store exposes addTodo only.
    // So: add todo normally, then grab its id and patch via editTodo (text stays same).
    // For dueDate support we need to extend crdt.mjs OR store dueDate externally.
    // Best path: patch crdt.mjs to accept extra fields in addTodo.
    // For now: store dueDate in a separate localStorage map keyed by todo id.
    const newId = crypto.randomUUID();
    const dueDates = JSON.parse(localStorage.getItem('liltask_duedates') || '{}');
    dueDates[newId] = dateKey;
    localStorage.setItem('liltask_duedates', JSON.stringify(dueDates));

    // Inject record directly via applyUpdate with a snapshot containing dueDate
    const rec = { id: newId, text, done: false, deleted: false, dueDate: dateKey, calEntry: true, hlc: Date.now() + '.' + String(Math.random()).slice(2,8) };
    store.applyUpdate([{ op: 'set', record: rec }]);

    inp.value = '';
    inp.focus();
    // Patch modal DOM in-place
    const listEl = document.getElementById('cal-date-todos');
    if (listEl) {
        const placeholder = listEl.querySelector('p');
        if (placeholder) placeholder.remove();
        const row = document.createElement('div');
        row.className = 'cal-modal-todo';
        row.dataset.id = newId;
        row.style.cssText = 'opacity:0;transform:translateY(-4px);transition:opacity 0.18s ease,transform 0.18s ease';
        row.innerHTML = `
        <button class="todo-check" onclick="calToggleTodo('${dateKey}', '${newId}')"></button>
        <span style="flex:1">${escHtml(text)}</span>
        <button class="todo-act-btn" onclick="calDeleteTodo('${dateKey}', '${newId}')">✕</button>`;
        listEl.appendChild(row);
        requestAnimationFrame(() => { row.style.opacity = '1'; row.style.transform = 'translateY(0)'; });
    }
};

window.calToggleTodo = function(dateKey, todoId) {
    const store = getOrCreateStore(activeListId);
    store.toggleTodo(todoId);
    const arr = store.getState();
    const item = arr.find(t => t.id === todoId);
    const newDone = item ? item.done : false;
    const row = document.querySelector(`#cal-date-todos .cal-modal-todo[data-id="${todoId}"]`);
    if (row) {
        const btn = row.querySelector('.todo-check');
        const span = row.querySelector('span');
        if (btn) btn.classList.toggle('checked', newDone);
        if (span) span.style.cssText = newDone ? 'flex:1;text-decoration:line-through;color:var(--text3)' : 'flex:1';
    }
};

window.calDeleteTodo = function(dateKey, todoId) {
    getOrCreateStore(activeListId).deleteTodo(todoId);
    const row = document.querySelector(`#cal-date-todos .cal-modal-todo[data-id="${todoId}"]`);
    if (row) {
        row.style.cssText += ';transition:opacity 0.15s ease,transform 0.15s ease;opacity:0;transform:translateX(8px)';
        setTimeout(() => {
            row.remove();
            const listEl = document.getElementById('cal-date-todos');
            if (listEl && listEl.querySelectorAll('.cal-modal-todo').length === 0) {
                listEl.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:8px 0">No tasks for this day yet.</p>`;
            }
        }, 160);
    }
};

// ─── View Switching ───────────────────────────────────────
window.switchView = function(view) {
    currentView = view;
    document.getElementById('todo-view').classList.toggle('active', view === 'lists');
    document.getElementById('calendar-view').style.display = view === 'calendar' ? 'block' : 'none';
    document.getElementById('nav-lists').classList.toggle('active', view === 'lists');
    document.getElementById('nav-calendar').classList.toggle('active', view === 'calendar');
    if (view === 'calendar') renderCalendar();
    if (view === 'lists') { renderTodos(); updateProgress(); }
    if (window.innerWidth <= 640) closeSidebar();
};

// ─── Modal System ─────────────────────────────────────────
window.openModal = function(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay" onclick="overlayClose(event)"><div class="modal">${html}</div></div>`;
};

window.closeModal = function() {
    document.getElementById('modal-root').innerHTML = '';
};

window.overlayClose = function(e) {
    if (e.target.classList.contains('modal-overlay')) closeModal();
};

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

// ─── Sidebar toggle (mobile) ──────────────────────────────
window.toggleSidebar = function() {
    const sb = document.getElementById('sidebar');
    if (sb.classList.contains('open')) closeSidebar();
    else openSidebar();
};
window.openSidebar = function() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-backdrop').classList.add('active');
};
window.closeSidebar = function() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('active');
};

// ─── URL-based room joining ───────────────────────────────
function handleRoomFromURL() {
    const parsed = getRoomFromURL();
    if (!parsed) return false;
    const { roomId, name } = parsed;

    // Already have this room — just switch to it
    const existing = Object.entries(lists).find(([, l]) => l.roomId === roomId);
    if (existing) {
        switchList(existing[0]);
        return true;
    }

    // New room — create list with the shared name
    const id = generateId();
    lists[id] = { name, roomId };
    save();
    getOrCreateYDoc(id);
    activeListId = id;
    save();
    pullUpdate(id);
    return true;
}

// ─── Themes Modal ─────────────────────────────────────────
const THEMES = [
    { id:'dark-violet',  label:'Violet Night',  dark:true,  swatch:['#0f0f11','#7c6aff','#a855f7'] },
{ id:'dark-slate',   label:'GitHub Dark',   dark:true,  swatch:['#0d1117','#58a6ff','#79c0ff'] },
{ id:'dark-rose',    label:'Rose Dark',     dark:true,  swatch:['#100c10','#e05c9a','#f07ac0'] },
{ id:'dark-forest',  label:'Forest Dark',   dark:true,  swatch:['#0a0f0c','#4ade80','#86efac'] },
{ id:'light-clean',  label:'Clean Light',   dark:false, swatch:['#f8f8fc','#6655ee','#9933ff'] },
{ id:'light-warm',   label:'Warm Parchment',dark:false, swatch:['#fdf8f0','#c05a10','#e07030'] },
{ id:'light-sky',    label:'Sky Blue',      dark:false, swatch:['#f0f6ff','#1a72e8','#4090ff'] },
];

let activeTheme = localStorage.getItem('liltask_theme') || 'dark-violet';

function applyTheme(id) {
    activeTheme = id;
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('liltask_theme', id);
}

applyTheme(activeTheme);

window.openThemesModal = function() {
    const cards = THEMES.map(t => {
        const active = t.id === activeTheme;
        const [bg, a1, a2] = t.swatch;
        return `<div class="theme-card ${active ? 'theme-active' : ''}" onclick="pickTheme('${t.id}')" id="tcard-${t.id}" style="cursor:pointer">
        <div class="theme-preview" style="background:${bg};border-radius:8px;height:44px;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;border:1.5px solid ${active ? a1 : 'rgba(128,128,128,0.2)'}">
        <div style="width:14px;height:14px;border-radius:50%;background:${a1}"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:${a2}"></div>
        <div style="width:8px;height:8px;border-radius:50%;background:${bg === '#f8f8fc' || bg === '#fdf8f0' || bg === '#f0f6ff' ? '#aaa' : '#fff'}; opacity:0.4"></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:13px;font-weight:600;color:var(--text)">${t.label}</span>
        <span style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-left:auto">${t.dark ? '🌙' : '☀️'}</span>
        ${active ? '<span style="font-size:10px;font-family:var(--mono);color:var(--accent);margin-left:4px">✓ active</span>' : ''}
        </div>
        </div>`;
    }).join('');

    openModal(`<div class="modal-title">🎨 Themes</div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px">Choose a look. Changes apply instantly.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">
    <div style="grid-column:1/-1;font-size:10px;font-family:var(--mono);letter-spacing:1.2px;text-transform:uppercase;color:var(--text3);margin-bottom:2px">🌙 Dark</div>
    ${THEMES.filter(t=>t.dark).map(t => {
        const active = t.id === activeTheme;
        const [bg,a1,a2] = t.swatch;
        return `<div onclick="pickTheme('${t.id}')" id="tcard-${t.id}" style="cursor:pointer;padding:10px;border-radius:var(--radius);border:1.5px solid ${active ? 'var(--accent)' : 'var(--border)'};background:${active ? 'var(--accent-glow)' : 'var(--bg3)'};transition:all 0.15s">
        <div style="background:${bg};border-radius:6px;height:38px;display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:7px">
        <div style="width:12px;height:12px;border-radius:50%;background:${a1}"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:${a2}"></div>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${t.label}</div>
        ${active ? '<div style="font-size:10px;font-family:var(--mono);color:var(--accent)">✓ active</div>' : ''}
        </div>`;
    }).join('')}
    <div style="grid-column:1/-1;font-size:10px;font-family:var(--mono);letter-spacing:1.2px;text-transform:uppercase;color:var(--text3);margin:6px 0 2px">☀️ Light</div>
    ${THEMES.filter(t=>!t.dark).map(t => {
        const active = t.id === activeTheme;
        const [bg,a1,a2] = t.swatch;
        return `<div onclick="pickTheme('${t.id}')" id="tcard-${t.id}" style="cursor:pointer;padding:10px;border-radius:var(--radius);border:1.5px solid ${active ? 'var(--accent)' : 'var(--border)'};background:${active ? 'var(--accent-glow)' : 'var(--bg3)'};transition:all 0.15s">
        <div style="background:${bg};border-radius:6px;height:38px;display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:7px;border:1px solid rgba(0,0,0,0.08)">
        <div style="width:12px;height:12px;border-radius:50%;background:${a1}"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:${a2}"></div>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${t.label}</div>
        ${active ? '<div style="font-size:10px;font-family:var(--mono);color:var(--accent)">✓ active</div>' : ''}
        </div>`;
    }).join('')}
    </div>
    <div class="modal-actions"><button class="modal-btn primary" onclick="closeModal()">Done</button></div>`);
};

window.pickTheme = function(id) {
    applyTheme(id);
    openThemesModal(); // re-render to show active state
};

// ─── Settings Modal ───────────────────────────────────────
window.openSettingsModal = function() {
    const currentUrl = localStorage.getItem('liltask_worker_url') || WORKER_URL;
    openModal(`<div class="modal-title">⚙️ Settings</div>
    <div style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:var(--text2);margin-bottom:6px;font-family:var(--mono)">CLOUDFLARE WORKER URL</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.5">Set your own deployed worker for sync. Leave the default to run offline-only.</div>
    <div style="background:var(--bg3);border:1.5px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-family:var(--mono);font-size:11px;color:var(--text3);word-break:break-all;margin-bottom:10px">${escHtml(currentUrl)}</div>
    <input class="modal-input" id="worker-url-inp" placeholder="https://your-worker.workers.dev" value="${currentUrl.includes('YOUR_WORKER') ? '' : escHtml(currentUrl)}" autocomplete="off" style="margin-bottom:0"/>
    </div>
    <div class="modal-actions">
    <button class="modal-btn" onclick="resetWorkerUrl()">Reset Default</button>
    <button class="modal-btn" onclick="closeModal()">Cancel</button>
    <button class="modal-btn primary" onclick="saveWorkerUrl()">Save</button>
    </div>`);
    setTimeout(() => document.getElementById('worker-url-inp')?.focus(), 50);
};

window.saveWorkerUrl = function() {
    const inp = document.getElementById('worker-url-inp');
    if (!inp) return;
    const val = inp.value.trim();
    if (val) {
        localStorage.setItem('liltask_worker_url', val);
        // Patch WORKER_URL at runtime
        window._customWorkerUrl = val;
    }
    closeModal();
    setSyncStatus(val && !val.includes('YOUR_WORKER') ? 'synced' : 'offline');
};

window.resetWorkerUrl = function() {
    localStorage.removeItem('liltask_worker_url');
    window._customWorkerUrl = null;
    closeModal();
    setSyncStatus('offline');
};


// ─── Init ─────────────────────────────────────────────────
function appInit() {
    load();
    handleRoomFromURL();
    ensureDefaultList();
    renderListsNav();
    switchList(activeListId);
    const effectiveUrl = window._customWorkerUrl || localStorage.getItem('liltask_worker_url') || WORKER_URL;
    setSyncStatus(effectiveUrl.includes('YOUR_WORKER') ? 'offline' : 'synced');

    setInterval(() => {
        if (activeListId && lists[activeListId]?.roomId) pullUpdate(activeListId);
    }, 10000);

        if ('serviceWorker' in navigator) {
            const swCode = `
            const CACHE = 'liltask-v1';
            self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/']))));
            self.addEventListener('fetch', e => e.respondWith(
                caches.match(e.request).then(r => r || fetch(e.request).then(res => {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                    return res;
                }).catch(() => caches.match('/')))
            ));
            `;
            const swBlob = new Blob([swCode], { type: 'application/javascript' });
            navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(() => {});
        }
}

// crdt.mjs is an ES module — loads async. Wait for it before init.
if (window.CRDT) {
    appInit();
} else {
    window.addEventListener('crdt-ready', appInit, { once: true });
    // Fallback: poll briefly in case event was missed
    const _crdtPoll = setInterval(() => {
        if (window.CRDT) { clearInterval(_crdtPoll); appInit(); }
    }, 20);
    setTimeout(() => clearInterval(_crdtPoll), 5000);
}
