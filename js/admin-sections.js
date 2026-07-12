/* ================================================================
   RoadBuddy — Phase 5: Admin Panel Sections Engine
   File: js/admin-sections.js
   ----------------------------------------------------------------
   Renders all 7 remaining admin SPA sections:
     Analytics · Requests Log · Subscriptions · Reports/Disputes
     Admin Accounts · Audit Log · System Settings
   All data is localStorage-backed with seeded mock records.
   ================================================================ */

const RBAdmin = (() => {

  /* ── Mock data ── */
  const MONTHLY = [
    { month: 'Sep', requests: 48,  completed: 42 },
    { month: 'Oct', requests: 62,  completed: 55 },
    { month: 'Nov', requests: 75,  completed: 68 },
    { month: 'Dec', requests: 88,  completed: 80 },
    { month: 'Jan', requests: 105, completed: 97 },
    { month: 'Feb', requests: 124, completed: 112 },
  ];

  const REQ_TYPES = [
    { type: 'Mechanic',  count: 47, color: '#f97316', pct: 38 },
    { type: 'Towing',    count: 27, color: '#6366f1', pct: 22 },
    { type: 'Battery',   count: 22, color: '#10b981', pct: 18 },
    { type: 'Tire',      count: 15, color: '#f59e0b', pct: 12 },
    { type: 'Fuel',      count:  9, color: '#ec4899', pct:  7 },
    { type: 'Other',     count:  4, color: '#8b5cf6', pct:  3 },
  ];

  const ALL_REQUESTS = [
    { id:'REQ-001', motorist:'Maria Reyes',   provider:'AutoFix Repair',    type:'Flat Tire',      location:'Limketkai Dr., CDO',     date:'Feb 14, 10:15', status:'in-progress' },
    { id:'REQ-002', motorist:'Roberto Garcia',provider:'AutoFix Repair',    type:'Battery Jump',   location:'Kauswagan Rd., CDO',     date:'Feb 14, 09:45', status:'in-progress' },
    { id:'REQ-003', motorist:'Angela Cruz',   provider:'QuickTow Express',  type:'Towing',         location:'Brgy. Agusan, CDO',      date:'Feb 13, 14:22', status:'completed'   },
    { id:'REQ-004', motorist:'Mark Tan',      provider:'AutoFix Repair',    type:'Flat Tire',      location:'CM Recto Ave., CDO',     date:'Feb 13, 11:05', status:'completed'   },
    { id:'REQ-005', motorist:'Lisa Gomez',    provider:'AutoFix Repair',    type:'Engine Repair',  location:'Divisoria, CDO',         date:'Feb 12, 16:30', status:'completed'   },
    { id:'REQ-006', motorist:'Carlos Reyes',  provider:'—',                 type:'Fuel Delivery',  location:'Brgy. Iponan, CDO',      date:'Feb 12, 08:15', status:'pending'     },
    { id:'REQ-007', motorist:'Ana Santos',    provider:'TireMaster CDO',    type:'Tire Service',   location:'Brgy. Lapasan, CDO',     date:'Feb 11, 13:40', status:'completed'   },
    { id:'REQ-008', motorist:'Jose Cruz',     provider:'—',                 type:'Mechanic',       location:'Brgy. Nazareth, CDO',    date:'Feb 10, 17:20', status:'cancelled'   },
    { id:'REQ-009', motorist:'Rica Dela Cruz',provider:'PowerStart Battery',type:'Battery Replace',location:'Brgy. Bulua, CDO',       date:'Feb 10, 11:00', status:'completed'   },
    { id:'REQ-010', motorist:'Tony Flores',   provider:'SpeedFix Garage',   type:'Mechanical',     location:'Macabalan, CDO',         date:'Feb 09, 15:55', status:'completed'   },
  ];

  const SUBSCRIPTIONS = [
    { id:'sub-1', provider:'AutoFix Repair Shop',  plan:'professional', status:'active', amount:1299, nextBill:'Mar 14, 2026', served:124 },
    { id:'sub-2', provider:'QuickTow Express',      plan:'basic',        status:'active', amount:499,  nextBill:'Mar 08, 2026', served:62  },
    { id:'sub-3', provider:'PowerStart Battery',    plan:'professional', status:'active', amount:1299, nextBill:'Mar 22, 2026', served:88  },
    { id:'sub-4', provider:'TireMaster CDO',        plan:'basic',        status:'active', amount:499,  nextBill:'Mar 01, 2026', served:45  },
    { id:'sub-5', provider:'FuelFriend Delivery',   plan:'trial',        status:'trial',  amount:0,    nextBill:'Feb 28, 2026', served:12  },
    { id:'sub-6', provider:'MechPro Services',      plan:'trial',        status:'trial',  amount:0,    nextBill:'Feb 25, 2026', served:8   },
    { id:'sub-7', provider:'RoadAssist Central',    plan:'basic',        status:'active', amount:499,  nextBill:'Mar 10, 2026', served:35  },
    { id:'sub-8', provider:'SpeedFix Garage',       plan:'professional', status:'suspended', amount:1299, nextBill:'—',         served:67  },
  ];

  const DISPUTES = [
    { id:'DSP-001', reporter:'Maria Reyes',   reported:'AutoFix Repair',    reason:'Overcharged for service',       status:'open',      date:'Feb 13',
      description:'Provider quoted ₱500 but charged ₱1,200 for a flat tire replacement without prior notice.' },
    { id:'DSP-002', reporter:'Jose Cruz',     reported:'QuickTow Express',  reason:'No-show after accepting job',   status:'open',      date:'Feb 12',
      description:'Provider accepted the request but never arrived. Motorist waited over 90 minutes on a highway.' },
    { id:'DSP-003', reporter:'Ana Santos',    reported:'TireMaster CDO',    reason:'Poor service quality',          status:'resolved',  date:'Feb 10',
      description:'Tire replacement done incorrectly. Motorist had a flat again 2 hours after service. Resolved with refund.' },
    { id:'DSP-004', reporter:'Carlos Reyes',  reported:'FuelFriend Delivery',reason:'Inappropriate behavior',       status:'escalated', date:'Feb 09',
      description:'Provider demanded additional cash payment on arrival and was verbally aggressive when refused.' },
  ];

  const ADMIN_ACCOUNTS = [
    { id:'adm-1', name:'System Admin',     email:'admin@roadbuddy.ph',   role:'super',     dept:'Executive',        status:'active',   lastLogin:'2 hours ago',   initials:'SA', color:'var(--admin-primary)' },
    { id:'adm-2', name:'Ana Villanueva',   email:'ana.v@roadbuddy.ph',   role:'moderator', dept:'Operations',       status:'active',   lastLogin:'Yesterday',     initials:'AV', color:'var(--primary-400)'  },
    { id:'adm-3', name:'Carlo Reyes',      email:'carlo.r@roadbuddy.ph', role:'support',   dept:'Customer Support', status:'active',   lastLogin:'3 days ago',    initials:'CR', color:'var(--primary-600)'  },
  ];

  const AUDIT_LOG = [
    { admin:'System Admin',   action:'approved provider',          target:'AutoFix Repair Shop',   type:'approve', ts: Date.now() - 2*3600000   },
    { admin:'Ana Villanueva', action:'rejected provider',          target:'SpeedFix Towing Co.',   type:'reject',  ts: Date.now() - 5*3600000   },
    { admin:'Carlo Reyes',    action:'resolved dispute',           target:'DSP-003 · TireMaster',  type:'resolve', ts: Date.now() - 86400000    },
    { admin:'System Admin',   action:'updated settings',           target:'Basic plan price → ₱499', type:'settings', ts: Date.now() - 2*86400000 },
    { admin:'Ana Villanueva', action:'suspended provider',         target:'FuelFriend Delivery',   type:'suspend', ts: Date.now() - 3*86400000  },
    { admin:'System Admin',   action:'created admin account',      target:'Carlo Reyes · Support', type:'create',  ts: Date.now() - 5*86400000  },
    { admin:'Carlo Reyes',    action:'flagged review',             target:'Review #rev-5 (spam)',   type:'flag',    ts: Date.now() - 6*86400000  },
    { admin:'System Admin',   action:'approved provider',          target:'QuickTow Express',      type:'approve', ts: Date.now() - 7*86400000  },
    { admin:'Ana Villanueva', action:'requested more info',        target:'MechPro Services',      type:'info',    ts: Date.now() - 8*86400000  },
    { admin:'System Admin',   action:'signed in',                  target:'Admin panel',           type:'login',   ts: Date.now() - 8*3600000   },
    { admin:'Carlo Reyes',    action:'dismissed dispute',          target:'DSP-002 (duplicate)',   type:'resolve', ts: Date.now() - 9*86400000  },
    { admin:'System Admin',   action:'updated platform settings',  target:'Auto-approve → OFF',    type:'settings', ts: Date.now() - 10*86400000},
  ];

  const SETTINGS_KEY = 'rb_settings_v1';
  const DEFAULT_SETTINGS = {
    basicPrice: 499,
    proPrice: 1299,
    trialDays: 30,
    allowRegistrations: true,
    autoApproveProviders: false,
    maintenanceMode: false,
    emailNotifications: true,
    smsNotifications: false,
    platformName: 'RoadBuddy',
    supportEmail: 'support@roadbuddy.ph',
  };

  /* ── Helpers ── */
  const el = id => document.getElementById(id);
  const fmt = { peso: n => `₱${Number(n).toLocaleString()}` };

  function relDate(ts) {
    const s = (Date.now()-ts)/1000;
    if (s < 60)   return 'Just now';
    if (s < 3600) return Math.floor(s/60)+'m ago';
    if (s < 86400)return Math.floor(s/3600)+'h ago';
    if (s < 604800)return Math.floor(s/86400)+'d ago';
    return new Date(ts).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});
  }

  function statusBadge(status) {
    const cfg = {
      'in-progress': ['admin-status-badge--active',   'En Route'],
      'completed':   ['admin-status-badge--approved',  'Completed'],
      'pending':     ['admin-status-badge--pending',   'Pending'],
      'cancelled':   ['admin-status-badge--suspended','Cancelled'],
      'active':      ['admin-status-badge--approved',  'Active'],
      'trial':       ['admin-status-badge--pending',   'Free Trial'],
      'suspended':   ['admin-status-badge--suspended','Suspended'],
      'open':        ['admin-status-badge--active',    'Open'],
      'resolved':    ['admin-status-badge--approved',  'Resolved'],
      'escalated':   ['admin-dispute-badge--review',   'Escalated'],
    }[status] || ['','Unknown'];
    return `<span class="admin-status-badge ${cfg[0]}">${cfg[1]}</span>`;
  }

  function planBadge(plan) {
    const cfg = {
      professional: ['plan-badge plan-badge--pro',   'Professional'],
      basic:        ['plan-badge plan-badge--basic',  'Basic'],
      trial:        ['plan-badge plan-badge--trial',  'Free Trial'],
    }[plan] || ['plan-badge','—'];
    return `<span class="${cfg[0]}">${cfg[1]}</span>`;
  }

  function roleBadge(role) {
    const cfg = {
      super:     ['admin-role-badge admin-role-badge--super',     'Super Admin'],
      moderator: ['admin-role-badge admin-role-badge--moderator', 'Moderator'],
      support:   ['admin-role-badge admin-role-badge--support',   'Support'],
    }[role] || ['admin-role-badge','—'];
    return `<span class="${cfg[0]}">${cfg[1]}</span>`;
  }

  function auditIcon(type) {
    return {
      approve:  { icon:'fa-check',        color:'var(--success-500)' },
      reject:   { icon:'fa-times',        color:'var(--danger-500)'  },
      resolve:  { icon:'fa-flag-checkered',color:'var(--primary-500)'},
      settings: { icon:'fa-gear',          color:'var(--gray-500)'   },
      suspend:  { icon:'fa-ban',           color:'var(--danger-500)' },
      create:   { icon:'fa-user-plus',     color:'var(--accent-500)' },
      flag:     { icon:'fa-flag',          color:'var(--accent-500)' },
      info:     { icon:'fa-circle-info',   color:'var(--primary-400)'},
      login:    { icon:'fa-right-to-bracket',color:'var(--gray-400)' },
    }[type] || { icon:'fa-circle', color:'var(--gray-400)' };
  }

  /* ── Load / save settings ── */
  function loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}') }; }
    catch(e) { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch(e) {}
  }

  /* ================================================================
     1. ANALYTICS
  ================================================================ */
  function renderAnalytics() {
    const c = el('analyticsContent');
    if (!c || c.dataset.loaded) return;
    c.dataset.loaded = '1';

    // Update summary stat cards
    const setText = (id,v) => { const e=el(id); if(e) e.textContent=v; };
    setText('anlTotalRequests', '502');
    setText('anlActiveProviders', '47');
    setText('anlRevenue', '₱24,850');
    setText('anlSatisfaction', '4.7★');

    // Bar chart
    const max = Math.max(...MONTHLY.map(d => d.requests));
    el('analyticsBarChart').innerHTML = MONTHLY.map(d => {
      const h = Math.round((d.requests / max) * 100);
      const hc = Math.round((d.completed / max) * 100);
      return `
        <div class="chart-col">
          <div class="chart-col__bars">
            <div class="chart-bar chart-bar--bg"  style="height:${h}%"  title="${d.requests} total requests">
              <div class="chart-bar chart-bar--fg" style="height:${Math.round(hc/h*100)}%"></div>
            </div>
          </div>
          <div class="chart-col__val">${d.requests}</div>
          <div class="chart-col__label">${d.month}</div>
        </div>`;
    }).join('');

    // Donut chart (SVG)
    const total = REQ_TYPES.reduce((s,t) => s+t.count, 0);
    let offset = 25; // start at top (25 = 90deg offset for stroke-dasharray)
    const radius = 15.9155; // magic number for circumference = 100
    el('analyticsDonut').innerHTML = REQ_TYPES.map(t => {
      const dash = t.pct;
      const gap  = 100 - dash;
      const seg = `<circle
        class="donut-segment"
        cx="21" cy="21" r="${radius}"
        fill="none"
        stroke="${t.color}"
        stroke-width="6"
        stroke-dasharray="${dash} ${gap}"
        stroke-dashoffset="${100 - offset}"
        transform="rotate(-90 21 21)"
      />`;
      offset += dash;
      return seg;
    }).join('');

    // Legend
    el('analyticsLegend').innerHTML = REQ_TYPES.map(t => `
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${t.color};"></span>
        <span class="donut-legend-label">${t.type}</span>
        <span class="donut-legend-pct">${t.pct}%</span>
      </div>`).join('');

    // Top providers (from reviews data if available)
    el('analyticsTopProviders').innerHTML = [
      { name:'AutoFix Repair Shop',  rating:4.8, jobs:124, color:'#f97316' },
      { name:'PowerStart Battery',   rating:4.9, jobs:88,  color:'#10b981' },
      { name:'SpeedFix Garage',      rating:4.6, jobs:67,  color:'#f97316' },
      { name:'QuickTow Express',     rating:4.6, jobs:62,  color:'#6366f1' },
      { name:'TireMaster CDO',       rating:4.5, jobs:45,  color:'#f59e0b' },
    ].map((p,i) => `
      <div class="top-provider-row">
        <span class="top-provider-rank">${i+1}</span>
        <div class="top-provider-dot" style="background:${p.color}22;color:${p.color};border:1.5px solid ${p.color}44;">${p.name.charAt(0)}</div>
        <div class="top-provider-info">
          <div class="top-provider-name">${p.name}</div>
          <div class="top-provider-meta">${p.jobs} jobs completed</div>
        </div>
        <div class="top-provider-rating"><i class="fas fa-star" style="color:var(--accent-400);font-size:0.75rem;"></i> ${p.rating}</div>
      </div>`).join('');
  }

  /* ================================================================
     2. REQUESTS LOG
  ================================================================ */
  let requestFilter = 'all';

  function renderRequests(filter) {
    requestFilter = filter || requestFilter;
    document.querySelectorAll('.req-filter-btn').forEach(b =>
      b.classList.toggle('req-filter-btn--active', b.dataset.filter === requestFilter));

    const list = requestFilter === 'all'
      ? ALL_REQUESTS
      : ALL_REQUESTS.filter(r => r.status === requestFilter);

    const tbody = el('requestsTableBody');
    if (!tbody) return;

    tbody.innerHTML = list.map(r => `
      <tr class="req-row" onclick="toggleReqDetail('${r.id}')">
        <td><span class="req-id">${r.id}</span></td>
        <td>
          <div class="admin-table-cell-main">${r.motorist}</div>
        </td>
        <td><div class="admin-table-cell-main">${r.provider}</div></td>
        <td><span class="req-type-chip">${r.type}</span></td>
        <td class="admin-table-cell-muted">${r.location}</td>
        <td class="admin-table-cell-muted">${r.date}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button class="btn btn--ghost btn--sm" style="font-size:0.75rem;" onclick="event.stopPropagation();showComingSoon('Request detail view')"><i class="fas fa-eye"></i></button></td>
      </tr>`).join('');

    el('requestsCount').textContent = `${list.length} request${list.length!==1?'s':''}`;
  }

  /* ================================================================
     3. SUBSCRIPTIONS
  ================================================================ */
  function renderSubscriptions() {
    const c = el('subsContent');
    if (!c || c.dataset.loaded) return;
    c.dataset.loaded = '1';

    const trial = SUBSCRIPTIONS.filter(s=>s.plan==='trial').length;
    const basic  = SUBSCRIPTIONS.filter(s=>s.plan==='basic').length;
    const pro    = SUBSCRIPTIONS.filter(s=>s.plan==='professional').length;
    const rev    = SUBSCRIPTIONS.filter(s=>s.status==='active').reduce((s,x)=>s+x.amount,0);

    el('subsTrial').textContent = trial;
    el('subsBasic').textContent = basic;
    el('subsPro').textContent   = pro;
    el('subsRevenue').textContent = fmt.peso(rev);

    el('subsTableBody').innerHTML = SUBSCRIPTIONS.map(s => `
      <tr>
        <td><div class="admin-table-cell-main">${s.provider}</div></td>
        <td>${planBadge(s.plan)}</td>
        <td>${statusBadge(s.status)}</td>
        <td class="admin-table-cell-muted">${s.plan==='trial'?'Free':fmt.peso(s.amount)+'/mo'}</td>
        <td class="admin-table-cell-muted">${s.nextBill}</td>
        <td class="admin-table-cell-muted">${s.served} jobs</td>
        <td>
          <button class="btn btn--ghost btn--sm" style="font-size:0.75rem;"
            onclick="showComingSoon('Subscription management')">
            <i class="fas fa-ellipsis"></i>
          </button>
        </td>
      </tr>`).join('');
  }

  /* ================================================================
     4. DISPUTES
  ================================================================ */
  let disputeFilter = 'all';

  function renderDisputes(filter) {
    disputeFilter = filter || disputeFilter;
    document.querySelectorAll('.dispute-filter-btn').forEach(b =>
      b.classList.toggle('req-filter-btn--active', b.dataset.filter === disputeFilter));

    const list = disputeFilter === 'all'
      ? DISPUTES
      : DISPUTES.filter(d => d.status === disputeFilter);

    el('disputesList').innerHTML = list.map(d => `
      <div class="dispute-card">
        <div class="dispute-card__header">
          <div class="dispute-card__id-block">
            <span class="req-id">${d.id}</span>
            <span class="admin-table-cell-muted" style="font-size:0.75rem;">${d.date}</span>
          </div>
          ${statusBadge(d.status)}
        </div>
        <div class="dispute-card__parties">
          <div>
            <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:.04em;color:var(--gray-400);font-weight:600;">Reporter</div>
            <div class="admin-table-cell-main">${d.reporter}</div>
          </div>
          <i class="fas fa-arrow-right" style="color:var(--gray-300);font-size:0.75rem;flex-shrink:0;"></i>
          <div>
            <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:.04em;color:var(--gray-400);font-weight:600;">Reported</div>
            <div class="admin-table-cell-main">${d.reported}</div>
          </div>
        </div>
        <div class="dispute-card__reason"><i class="fas fa-triangle-exclamation" style="color:var(--accent-500);"></i> ${d.reason}</div>
        <p class="dispute-card__desc">${d.description}</p>
        <div class="dispute-card__actions">
          ${d.status === 'open' || d.status === 'escalated' ? `
            <button class="btn btn--sm admin-btn-approve" onclick="resolveDispute('${d.id}')">
              <i class="fas fa-check"></i> Resolve
            </button>
            <button class="btn btn--ghost btn--sm" onclick="showComingSoon('Dispute escalation')">
              <i class="fas fa-arrow-up"></i> Escalate
            </button>
            <button class="btn btn--ghost btn--sm" onclick="showComingSoon('Contact parties')">
              <i class="fas fa-message"></i> Contact
            </button>` : `
            <span style="font-size:0.8125rem;color:var(--gray-400);"><i class="fas fa-circle-check"></i> This dispute has been ${d.status}.</span>`}
        </div>
      </div>`).join('');
  }

  function resolveDispute(id) {
    const d = DISPUTES.find(x => x.id === id);
    if (d) { d.status = 'resolved'; renderDisputes(); showToast && showToast(`Dispute ${id} resolved.`, 'success'); }
  }

  /* ================================================================
     5. ADMIN ACCOUNTS
  ================================================================ */
  function renderAdminAccounts() {
    const c = el('adminAccountsContent');
    if (!c || c.dataset.loaded) return;
    c.dataset.loaded = '1';

    el('adminAccountsTable').innerHTML = ADMIN_ACCOUNTS.map(a => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <div class="admin-table-avatar" style="background:${a.color}22;color:${a.color};">${a.initials}</div>
            <div>
              <div class="admin-table-cell-main">${a.name}</div>
              <div class="admin-table-cell-muted">${a.email}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge(a.role)}</td>
        <td class="admin-table-cell-muted">${a.dept}</td>
        <td>${statusBadge(a.status)}</td>
        <td class="admin-table-cell-muted">${a.lastLogin}</td>
        <td>
          <div style="display:flex;gap:0.375rem;">
            <button class="btn btn--ghost btn--sm" style="font-size:0.75rem;" onclick="showComingSoon('Edit admin')"><i class="fas fa-pen"></i></button>
            ${a.role !== 'super' ? `<button class="btn btn--ghost btn--sm" style="font-size:0.75rem;color:var(--danger-500);" onclick="showComingSoon('Deactivate admin')"><i class="fas fa-ban"></i></button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  }

  /* ================================================================
     6. AUDIT LOG
  ================================================================ */
  function renderAuditLog() {
    const c = el('auditLogContent');
    if (!c || c.dataset.loaded) return;
    c.dataset.loaded = '1';

    el('auditLogList').innerHTML = AUDIT_LOG.map(a => {
      const ic = auditIcon(a.type);
      return `
        <div class="audit-row">
          <div class="audit-row__icon" style="background:${ic.color}18;color:${ic.color}">
            <i class="fas ${ic.icon}"></i>
          </div>
          <div class="audit-row__body">
            <div class="audit-row__action">
              <strong>${a.admin}</strong> ${a.action}
              <span class="audit-row__target">${a.target}</span>
            </div>
            <div class="audit-row__time">${relDate(a.ts)}</div>
          </div>
        </div>`;
    }).join('');
  }

  /* ================================================================
     7. SETTINGS
  ================================================================ */
  function renderSettings() {
    const c = el('settingsContent');
    if (!c || c.dataset.loaded) return;
    c.dataset.loaded = '1';

    const s = loadSettings();

    // Pricing inputs
    if(el('setPriceBasic')) el('setPriceBasic').value = s.basicPrice;
    if(el('setPricePro'))   el('setPricePro').value   = s.proPrice;
    if(el('setTrialDays'))  el('setTrialDays').value  = s.trialDays;

    // Toggles
    ['allowRegistrations','autoApproveProviders','maintenanceMode','emailNotifications','smsNotifications']
      .forEach(key => {
        const t = el('toggle-'+key);
        if (t) { t.checked = s[key]; }
      });
  }

  function saveSettingsForm() {
    const s = loadSettings();
    const getVal = id => { const e = el(id); return e ? e.value : null; };
    const getChk = id => { const e = el(id); return e ? e.checked : false; };

    s.basicPrice = parseInt(getVal('setPriceBasic')) || s.basicPrice;
    s.proPrice   = parseInt(getVal('setPricePro'))   || s.proPrice;
    s.trialDays  = parseInt(getVal('setTrialDays'))  || s.trialDays;
    s.allowRegistrations    = getChk('toggle-allowRegistrations');
    s.autoApproveProviders  = getChk('toggle-autoApproveProviders');
    s.maintenanceMode       = getChk('toggle-maintenanceMode');
    s.emailNotifications    = getChk('toggle-emailNotifications');
    s.smsNotifications      = getChk('toggle-smsNotifications');

    saveSettings(s);

    // Add to audit log
    AUDIT_LOG.unshift({ admin:'System Admin', action:'updated settings', target:'Platform settings', type:'settings', ts: Date.now() });
    const c = el('auditLogContent');
    if (c) { delete c.dataset.loaded; }

    showToast && showToast('Settings saved successfully.', 'success');
  }

  /* ── Public API ── */
  return {
    renderAnalytics, renderRequests, renderSubscriptions,
    renderDisputes, resolveDispute, renderAdminAccounts,
    renderAuditLog, renderSettings, saveSettingsForm
  };
})();

/* ── Global wrappers ── */
function renderAnalytics()           { RBAdmin.renderAnalytics(); }
function filterRequests(f)           { RBAdmin.renderRequests(f); }
function renderSubscriptions()       { RBAdmin.renderSubscriptions(); }
function filterDisputes(f)           { RBAdmin.renderDisputes(f); }
function resolveDispute(id)          { RBAdmin.resolveDispute(id); }
function renderAdminAccounts()       { RBAdmin.renderAdminAccounts(); }
function renderAuditLog()            { RBAdmin.renderAuditLog(); }
function renderSettings()            { RBAdmin.renderSettings(); }
function saveAdminSettings()         { RBAdmin.saveSettingsForm(); }

/* ── Hook into showSection to trigger lazy renders ── */
(function patchShowSectionPhase5() {
  const MAX_WAIT = 2000, TICK = 50;
  let waited = 0;
  const interval = setInterval(() => {
    waited += TICK;
    if (typeof window.showSection === 'function' || waited >= MAX_WAIT) {
      clearInterval(interval);
      const prev = window.showSection || function(){};
      window.showSection = function(sectionId, linkEl) {
        prev(sectionId, linkEl);
        const map = {
          analytics:     renderAnalytics,
          subscriptions: renderSubscriptions,
          admins:        renderAdminAccounts,
          audit:         renderAuditLog,
          settings:      renderSettings,
        };
        if (map[sectionId]) setTimeout(map[sectionId], 60);
        if (sectionId === 'requests')  setTimeout(() => RBAdmin.renderRequests('all'), 60);
        if (sectionId === 'reports')   setTimeout(() => RBAdmin.renderDisputes('all'), 60);
      };
    }
  }, TICK);
})();
