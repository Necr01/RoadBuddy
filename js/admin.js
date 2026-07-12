/* ================================================================
   RoadBuddy — Admin JavaScript
   File: js/admin.js
   ----------------------------------------------------------------
   All admin-specific JS: sidebar navigation, section switching,
   provider approve/reject, invite code handling, toast extensions.
   Loaded only on admin pages (after main.js).
   ================================================================ */

/* ── Auto-init on admin pages ── */
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.admin-sidebar, .admin-auth')) {
    initAdminSidebarToggle();
    initAdminSectionNav();
  }
});

/* ── Admin Sidebar Toggle (mobile) ── */
function initAdminSidebarToggle() {
  const toggle  = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;

  const checkMobile = () => {
    if (window.innerWidth <= 1024) {
      toggle.style.display = 'flex';
      sidebar.classList.remove('open');
    } else {
      toggle.style.display = 'none';
      sidebar.classList.remove('open');
    }
  };
  window.addEventListener('resize', checkMobile);
  checkMobile();

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
      const rect = sidebar.getBoundingClientRect();
      if (e.clientX > rect.right) {
        sidebar.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

/* ── Section titles for admin SPA ── */
const adminSectionTitles = {
  overview:      { title: 'Admin Dashboard',          subtitle: 'RoadBuddy Control Panel · Super Admin' },
  analytics:     { title: 'Analytics',                subtitle: 'Platform performance metrics' },
  motorists:     { title: 'Motorist Accounts',        subtitle: 'All registered motorists on the platform' },
  providers:     { title: 'Service Providers',        subtitle: 'Manage provider accounts and status' },
  verification:  { title: 'Verification Queue',       subtitle: 'Providers awaiting approval' },
  messages:      { title: 'Message Log',              subtitle: 'All in-app conversations' },
  requests:      { title: 'All Assistance Requests',  subtitle: 'Complete platform request log' },
  subscriptions: { title: 'Subscriptions & Billing',  subtitle: 'Provider subscription management' },
  reports:       { title: 'Reports & Disputes',       subtitle: 'Active disputes requiring attention' },
  reviews:       { title: 'Review Moderation',        subtitle: 'Monitor and manage user reviews' },
  admins:        { title: 'Admin Accounts',           subtitle: 'Admin user management' },
  audit:         { title: 'Audit Log',                subtitle: 'Full history of admin actions' },
  settings:      { title: 'System Settings',          subtitle: 'Platform configuration' },
};

function initAdminSectionNav() {
  const activeLink = document.querySelector('.admin-sidebar__link.active');
  if (activeLink) {
    const match = (activeLink.getAttribute('onclick') || '').match(/showSection\('(\w+)'/);
    if (match) updateAdminPageHeader(match[1]);
  }
}

function showSection(sectionId, clickedEl) {
  /* Hide all sections */
  document.querySelectorAll('.admin-section').forEach(el => {
    el.style.display = 'none';
  });

  /* Show target */
  const target = document.getElementById('section-' + sectionId);
  if (target) {
    target.style.display = 'block';
    const main = document.querySelector('.dashboard__main');
    if (main) main.scrollTop = 0;
  }

  /* Update sidebar active link */
  document.querySelectorAll('.admin-sidebar__link').forEach(link => link.classList.remove('active'));
  if (clickedEl) {
    clickedEl.classList.add('active');
  } else {
    document.querySelectorAll('.admin-sidebar__link').forEach(link => {
      if ((link.getAttribute('onclick') || '').includes("'" + sectionId + "'")) {
        link.classList.add('active');
      }
    });
  }

  updateAdminPageHeader(sectionId);

  /* Close sidebar on mobile */
  if (window.innerWidth <= 1024) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) { sidebar.classList.remove('open'); document.body.style.overflow = ''; }
  }

  return false;
}

function updateAdminPageHeader(sectionId) {
  const titleEl    = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');
  const info       = adminSectionTitles[sectionId];
  if (info && titleEl)    titleEl.textContent    = info.title;
  if (info && subtitleEl) subtitleEl.textContent = info.subtitle;
}

/* ── Provider Approve / Reject — Quick List (Overview) ── */
function approveProvider(btn, name) {
  const item = btn.closest('.admin-verify-item');
  if (!item) return;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled  = true;
  setTimeout(() => {
    item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    item.style.opacity    = '0';
    item.style.transform  = 'translateX(20px)';
    setTimeout(() => {
      item.remove();
      showToast && showToast(name + ' has been approved successfully.', 'success');
    }, 300);
  }, 700);
}

function rejectProvider(btn) {
  const item = btn.closest('.admin-verify-item');
  if (!item) return;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled  = true;
  setTimeout(() => {
    item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    item.style.opacity    = '0';
    item.style.transform  = 'translateX(-20px)';
    setTimeout(() => {
      item.remove();
      showToast && showToast('Provider application has been rejected.', 'error');
    }, 300);
  }, 700);
}

/* ── Provider Approve / Reject — Verification Queue Cards ── */
function approveProviderCard(cardId, name) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const btn = card.querySelector('.admin-btn-approve');
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving…'; btn.disabled = true; }
  setTimeout(() => {
    card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.97)';
    setTimeout(() => {
      card.style.overflow = 'hidden';
      card.style.maxHeight = '0';
      card.style.margin = '0';
      card.style.padding = '0';
      setTimeout(() => {
        card.remove();
        showToast && showToast(name + ' has been approved and is now active on the platform.', 'success');
      }, 400);
    }, 400);
  }, 800);
}

function rejectProviderCard(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const rejectBtn = card.querySelector('[onclick*="rejectProviderCard"]');
  if (rejectBtn) { rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting…'; rejectBtn.disabled = true; }
  setTimeout(() => {
    card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.97)';
    setTimeout(() => {
      card.remove();
      showToast && showToast('Provider application rejected. The applicant will be notified.', 'error');
    }, 400);
  }, 800);
}

/* ── Alert Panel Bell ── */
function toggleAlertPanel() {
  showToast && showToast('3 unresolved disputes and 7 pending verifications need attention.', 'warning');
}

/* ── Invite Code Formatter (XXXX-XXXX-XXXX) ── */
function formatInviteCode(input) {
  let val = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (val.length > 4)  val = val.slice(0,4)  + '-' + val.slice(4);
  if (val.length > 9)  val = val.slice(0,9)  + '-' + val.slice(9);
  if (val.length > 14) val = val.slice(0,14);
  input.value = val;
  const status = document.getElementById('inviteCodeStatus');
  if (status) { status.textContent = ''; status.className = 'admin-code-status'; }
}

/* ── Extended showToast — adds warning + info support ── */
(function () {
  const _orig = typeof showToast === 'function' ? showToast : null;
  window.showToast = function (message, type) {
    type = type || 'success';
    if ((type === 'success' || type === 'error') && _orig) return _orig(message, type);

    const iconMap = { warning: 'triangle-exclamation', info: 'info-circle' };
    const colors  = {
      warning: { bg: '#fffbeb', border: '#f59e0b', icon: '#fef3c7', iconColor: '#d97706' },
      info:    { bg: '#eef2ff', border: '#4338ca', icon: '#e0e7ff', iconColor: '#4338ca' },
    };
    const c = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `background:${c.bg};border:1px solid ${c.border};`;
    toast.innerHTML = `<div class="toast__icon" style="background:${c.icon};color:${c.iconColor};">
      <i class="fas fa-${iconMap[type]||'info-circle'}"></i></div>
      <div class="toast__text">${message}</div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    });
  };
})();
