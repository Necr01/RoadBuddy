/* ================================================================
   RoadBuddy — Phase 2: In-App Messaging Engine
   File: js/messaging.js
   ----------------------------------------------------------------
   - Seeded with mock conversations matching the active requests
     already displayed in both dashboards
   - localStorage-backed so messages persist across page reloads
   - Auto-reply simulation from the "other" party (2-4s delay)
   - Thread locking when request status is completed / cancelled
   - Works with no backend — drop-in replacement for showComingSoon
   ================================================================ */

const RBMessaging = (() => {

  /* ── Seed conversations (tied to request IDs shown in dashboards) ── */
  const SEED = {
    'req-001': {
      requestId: 'req-001',
      requestLabel: 'Flat Tire Replacement',
      requestLocation: 'Limketkai Dr., Brgy. Carmen, Cagayan de Oro City',
      requestStatus: 'in-progress',
      motorist:  { name: 'Maria Reyes',           initials: 'MR' },
      provider:  { name: 'Juan Santos · AutoFix',  initials: 'JS' },
      messages: [
        { id: 'm1-001', sender: 'provider', text: 'Hello Maria! I received your request. I\'m on my way now — estimated 8 minutes.', ts: Date.now() - 14 * 60000, read: true },
        { id: 'm2-001', sender: 'motorist', text: 'Thank you! I\'m parked on the right shoulder near the Limketkai junction.', ts: Date.now() - 13 * 60000, read: true },
        { id: 'm3-001', sender: 'provider', text: 'Got it! I can see your location on the map. I\'ll be there shortly. 👍', ts: Date.now() - 12 * 60000, read: true },
        { id: 'm4-001', sender: 'motorist', text: 'Okay, I\'ll turn on my hazard lights so you can spot me easily.', ts: Date.now() - 10 * 60000, read: true },
        { id: 'm5-001', sender: 'provider', text: 'Perfect. I\'m 2 minutes away now.', ts: Date.now() - 3 * 60000, read: false },
      ]
    },
    'req-002': {
      requestId: 'req-002',
      requestLabel: 'Battery Jump Start',
      requestLocation: 'Kauswagan Road, Cagayan de Oro City',
      requestStatus: 'in-progress',
      motorist:  { name: 'Roberto Garcia',        initials: 'RG' },
      provider:  { name: 'Juan Santos · AutoFix', initials: 'JS' },
      messages: [
        { id: 'm1-002', sender: 'provider', text: 'Hi Roberto, I\'ve accepted your job. I\'ll arrive in around 12 minutes.', ts: Date.now() - 20 * 60000, read: true },
        { id: 'm2-002', sender: 'motorist', text: 'Thank you! The car is completely dead — nothing starts at all.', ts: Date.now() - 18 * 60000, read: true },
        { id: 'm3-002', sender: 'provider', text: 'No worries, I have jumper cables and a portable pack. We\'ll get you moving.', ts: Date.now() - 17 * 60000, read: false },
      ]
    }
  };

  /* ── Auto-reply pools ── */
  const REPLIES = {
    provider: [
      'Noted! I\'m on my way.',
      'Understood, I\'ll bring the necessary equipment.',
      'Copy that! ETA about 5 minutes.',
      'Received. I\'ll update you once I arrive.',
      'Okay, please stay safe inside your vehicle.',
      'Got it! See you shortly. 👍'
    ],
    motorist: [
      'Thank you for the update!',
      'I\'ll wait here. Please be careful on the road.',
      'Got it, appreciated!',
      'Okay, I can see you approaching!',
      'Perfect, hazard lights are on.',
      'Great, standing by!'
    ]
  };

  /* ── State ── */
  let store = {};
  let activeThreadId = null;
  let activeRole = 'motorist'; // 'motorist' | 'provider' | 'admin'
  let replyTimer = null;

  /* ── Init: load from localStorage or use seed ── */
  function init() {
    try {
      const saved = localStorage.getItem('rb_messages_v1');
      store = saved ? JSON.parse(saved) : deepClone(SEED);
    } catch (e) {
      store = deepClone(SEED);
    }
    // Always make sure seed threads exist (fresh install safety)
    for (const id in SEED) {
      if (!store[id]) store[id] = deepClone(SEED[id]);
    }
    persist();
  }

  function persist() {
    try { localStorage.setItem('rb_messages_v1', JSON.stringify(store)); } catch(e) {}
  }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  /* ── Count unread messages (for sidebar badge) ── */
  function getUnreadCount(role) {
    let count = 0;
    for (const id in store) {
      const thread = store[id];
      thread.messages.forEach(m => {
        if (!m.read && m.sender !== role) count++;
      });
    }
    return count;
  }

  /* ── Update sidebar unread badge ── */
  function refreshBadge() {
    const badge = document.getElementById('msgUnreadBadge');
    if (!badge) return;
    const count = getUnreadCount(activeRole || 'motorist');
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* ── Open a thread ── */
  function openThread(requestId, role) {
    const thread = store[requestId];
    if (!thread) { window.showToast && showToast('Thread not found.', 'error'); return; }

    activeThreadId = requestId;
    activeRole = role || 'motorist';

    // Mark incoming messages as read
    thread.messages.forEach(m => {
      if (m.sender !== activeRole) m.read = true;
    });
    persist();
    refreshBadge();

    // Build panel header
    const other = (role === 'motorist') ? thread.provider : thread.motorist;
    setText('msgPanelInitials', other.initials);
    setText('msgPanelName', other.name);
    setText('msgPanelLabel', thread.requestLabel);
    setText('msgPanelLocation', thread.requestLocation);

    // Status badge
    const badge = document.getElementById('msgStatusBadge');
    if (badge) {
      badge.textContent = formatStatus(thread.requestStatus);
      badge.className = 'msg-context-badge msg-context-badge--' + thread.requestStatus.replace('-', '_');
    }

    // Render messages
    renderMessages(thread);

    // Locked / open state
    const locked = thread.requestStatus === 'completed' || thread.requestStatus === 'cancelled';
    const footer = document.getElementById('msgFooter');
    const lockedBar = document.getElementById('msgLocked');
    if (footer)    footer.style.display    = locked ? 'none' : 'flex';
    if (lockedBar) lockedBar.style.display = locked ? 'flex' : 'none';

    // Show overlay + panel
    document.getElementById('msgOverlay').classList.add('active');
    document.getElementById('msgPanel').classList.add('active');
    document.body.style.overflow = 'hidden';

    if (!locked) {
      setTimeout(() => {
        const inp = document.getElementById('msgInput');
        if (inp) inp.focus();
      }, 320);
    }
  }

  /* ── Close ── */
  function closeThread() {
    const overlay = document.getElementById('msgOverlay');
    const panel   = document.getElementById('msgPanel');
    if (overlay) overlay.classList.remove('active');
    if (panel)   panel.classList.remove('active');
    document.body.style.overflow = '';
    activeThreadId = null;
    if (replyTimer) { clearTimeout(replyTimer); replyTimer = null; }
  }

  /* ── Send a message ── */
  function send(text) {
    if (!activeThreadId || !text.trim()) return;
    const thread = store[activeThreadId];
    const msg = {
      id: 'msg-' + Date.now(),
      sender: activeRole,
      text: text.trim(),
      ts: Date.now(),
      read: false
    };
    thread.messages.push(msg);
    persist();
    renderMessages(thread);
    scheduleAutoReply(thread);
  }

  /* ── Auto-reply ── */
  function scheduleAutoReply(thread) {
    if (replyTimer) return;
    const replySender = (activeRole === 'motorist') ? 'provider' : 'motorist';
    const pool = REPLIES[replySender];
    const delay = 2200 + Math.random() * 2000;

    replyTimer = setTimeout(() => {
      const reply = {
        id: 'msg-' + Date.now(),
        sender: replySender,
        text: pool[Math.floor(Math.random() * pool.length)],
        ts: Date.now(),
        read: true
      };
      thread.messages.push(reply);
      persist();
      if (activeThreadId === thread.requestId) {
        renderMessages(thread);
        // Gentle "typing" feel — add a small bounce toast
        showToast && showToast('New message from ' + (replySender === 'provider' ? thread.provider.name : thread.motorist.name), 'info');
      }
      replyTimer = null;
    }, delay);
  }

  /* ── Render message bubbles ── */
  function renderMessages(thread) {
    const body = document.getElementById('msgBody');
    if (!body) return;

    const isAdmin = (activeRole === 'admin');

    body.innerHTML = thread.messages.map((m, i) => {
      const isSelf = !isAdmin && (m.sender === activeRole);
      const showDate = (i === 0) || !sameDay(thread.messages[i - 1].ts, m.ts);
      const senderObj = (m.sender === 'provider') ? thread.provider : thread.motorist;

      let html = '';
      if (showDate) {
        html += `<div class="msg-date-divider">${formatDate(m.ts)}</div>`;
      }

      if (isAdmin) {
        // Admin sees both sides labelled, all left-aligned
        html += `
          <div class="msg-bubble-row">
            <div class="msg-bubble-avatar">${senderObj.initials}</div>
            <div class="msg-bubble msg-bubble--other">
              <div class="msg-bubble__sender">${capitalize(m.sender)} · ${senderObj.name}</div>
              <div class="msg-bubble__text">${escHtml(m.text)}</div>
              <div class="msg-bubble__meta">${formatTime(m.ts)}</div>
            </div>
          </div>`;
      } else {
        html += `
          <div class="msg-bubble-row ${isSelf ? 'msg-bubble-row--self' : ''}">
            ${!isSelf ? `<div class="msg-bubble-avatar">${senderObj.initials}</div>` : ''}
            <div class="msg-bubble ${isSelf ? 'msg-bubble--self' : 'msg-bubble--other'}">
              <div class="msg-bubble__text">${escHtml(m.text)}</div>
              <div class="msg-bubble__meta">
                ${formatTime(m.ts)}
                ${isSelf ? `<span class="msg-read-receipt ${m.read ? 'msg-read-receipt--read' : ''}"><i class="fas fa-check-double"></i></span>` : ''}
              </div>
            </div>
          </div>`;
      }
      return html;
    }).join('');

    // Scroll to latest
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  /* ── Admin: get all threads as list ── */
  function getAllThreads() {
    return Object.values(store).map(t => ({
      ...t,
      unread: t.messages.filter(m => !m.read).length,
      last: t.messages[t.messages.length - 1] || null
    }));
  }

  /* ── Helpers ── */
  function formatStatus(s) {
    return { 'in-progress': 'En Route', 'completed': 'Completed', 'cancelled': 'Cancelled', 'pending': 'Pending' }[s] || s;
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ts) {
    const d = new Date(ts), now = new Date();
    if (sameDay(ts, now.getTime())) return 'Today';
    if (sameDay(ts, now.getTime() - 86400000)) return 'Yesterday';
    return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function sameDay(a, b) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  init();

  return { openThread, closeThread, send, getAllThreads, getUnreadCount, refreshBadge };
})();

/* ── Global wrappers called from HTML onclick attributes ── */
function openThread(requestId, role)  { RBMessaging.openThread(requestId, role); }
function closeThread()                { RBMessaging.closeThread(); }

function sendCurrentMessage() {
  const inp = document.getElementById('msgInput');
  if (!inp || !inp.value.trim()) return;
  RBMessaging.send(inp.value);
  inp.value = '';
  inp.style.height = 'auto';
}

function handleMsgKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendCurrentMessage();
  }
}

/* ── Admin: render message log into the admin section ── */
function renderAdminMessageLog() {
  const container = document.getElementById('adminMsgList');
  if (!container) return;

  const threads = RBMessaging.getAllThreads();
  if (!threads.length) {
    container.innerHTML = `<div class="admin-placeholder-content"><i class="fas fa-comments"></i><div>No conversations yet.</div></div>`;
    return;
  }

  container.innerHTML = threads.map(t => {
    const statusClass = { 'in-progress': 'admin-status-badge--active', 'completed': 'admin-status-badge--suspended', 'cancelled': 'admin-status-badge--suspended', 'pending': 'admin-status-badge--pending' }[t.requestStatus] || '';
    const statusLabel = { 'in-progress': 'En Route', 'completed': 'Completed', 'cancelled': 'Cancelled', 'pending': 'Pending' }[t.requestStatus] || t.requestStatus;
    const last = t.last;
    const preview = last ? last.text.substring(0, 80) + (last.text.length > 80 ? '...' : '') : 'No messages';
    const time = last ? new Date(last.ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '';

    return `
      <div class="admin-msg-thread" onclick="adminOpenThread('${t.requestId}')">
        <div class="admin-msg-thread__avatars">
          <div class="admin-table-avatar" style="font-size:0.75rem;">${t.motorist.initials}</div>
          <div class="admin-table-avatar" style="font-size:0.75rem; background:var(--accent-100); color:var(--accent-600); margin-top:-0.5rem; margin-left:-0.5rem;">${t.provider.initials}</div>
        </div>
        <div class="admin-msg-thread__info">
          <div class="admin-msg-thread__parties">
            <strong>${t.motorist.name}</strong> &amp; <strong>${t.provider.name}</strong>
            ${t.unread > 0 ? `<span class="admin-msg-unread-badge">${t.unread} unread</span>` : ''}
          </div>
          <div class="admin-msg-thread__label">
            <i class="fas fa-wrench" style="font-size:0.625rem; color:var(--gray-400);"></i>
            ${t.requestLabel} · <span class="admin-location"><i class="fas fa-location-dot"></i> ${t.requestLocation}</span>
          </div>
          <div class="admin-msg-thread__preview">${preview}</div>
        </div>
        <div class="admin-msg-thread__meta">
          <span class="admin-status-badge ${statusClass}" style="font-size:0.625rem; padding: 0.1875rem 0.5rem;">${statusLabel}</span>
          <span class="admin-msg-thread__time">${time}</span>
          <span class="admin-msg-thread__count"><i class="fas fa-comment"></i> ${t.messages.length}</span>
        </div>
      </div>`;
  }).join('');
}

function adminOpenThread(requestId) {
  // Highlight selected row
  document.querySelectorAll('.admin-msg-thread').forEach(el => el.classList.remove('admin-msg-thread--active'));
  const row = document.querySelector(`[onclick="adminOpenThread('${requestId}')"]`);
  if (row) row.classList.add('admin-msg-thread--active');

  // Open as admin read-only
  RBMessaging.openThread(requestId, 'admin');

  // Admin panel: hide footer (read-only), override header
  setTimeout(() => {
    const footer = document.getElementById('msgFooter');
    const locked = document.getElementById('msgLocked');
    if (footer) footer.style.display = 'none';
    if (locked) {
      locked.style.display = 'flex';
      locked.innerHTML = '<i class="fas fa-eye"></i><span>Admin view — read-only. Both sides visible.</span>';
    }
  }, 50);
}
