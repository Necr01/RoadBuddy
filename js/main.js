/* ============================================
   ROAD BUDDY - Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initRoleToggle();
  initMobileNav();
  initSidebarToggle();
  initBillingToggle();
  initScrollAnimations();
});

/* --- Navbar Scroll Effect --- */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('navbar--scrolled');
    } else {
      navbar.classList.remove('navbar--scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check
}

/* --- Mobile Nav --- */
function initMobileNav() {
  const toggle = document.getElementById('mobileToggle');
  const mobileNav = document.getElementById('mobileNav');
  const closeBtn = document.getElementById('mobileClose');

  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => {
    mobileNav.classList.add('show');
    document.body.style.overflow = 'hidden';
  });

  const closeMobileNav = () => {
    mobileNav.classList.remove('show');
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeMobileNav);
  mobileNav.addEventListener('click', (e) => {
    if (e.target === mobileNav) closeMobileNav();
  });

  // Close on link click
  mobileNav.querySelectorAll('.mobile-nav__link').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });
}

/* --- Role Toggle (Login/Register) --- */
function initRoleToggle() {
  const toggleContainer = document.getElementById('roleToggle');
  if (!toggleContainer) return;

  const options = toggleContainer.querySelectorAll('.role-toggle__option');
  const providerFields = document.getElementById('providerFields');
  const motoristFields = document.getElementById('motoristFields');

  options.forEach(option => {
    option.addEventListener('click', () => {
      // Update active state
      options.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');

      const role = option.dataset.role;

      // Toggle provider-specific fields in registration
      if (providerFields) {
        if (role === 'provider') {
          providerFields.classList.add('show');
          // Make provider fields required
          providerFields.querySelectorAll('input, select').forEach(field => {
            if (field.id !== 'businessAddress') field.setAttribute('required', '');
          });
        } else {
          providerFields.classList.remove('show');
          providerFields.querySelectorAll('input, select').forEach(field => {
            field.removeAttribute('required');
          });
        }
      }

      // Toggle motorist fields
      if (motoristFields) {
        motoristFields.style.display = role === 'motorist' ? 'block' : 'none';
      }
    });
  });
}

/* --- Sidebar Toggle (Dashboard) --- */
function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  if (!toggle || !sidebar) return;

  // Show toggle on mobile
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

  // Close sidebar when clicking the overlay backdrop (pseudo ::after)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
      const sidebarRect = sidebar.getBoundingClientRect();
      if (e.clientX > sidebarRect.right) {
        sidebar.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });

  // Close sidebar on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

/* --- Password Visibility Toggle --- */
function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  const icon = button.querySelector('i');

  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

/* --- Password Strength Checker --- */
function checkPasswordStrength(password) {
  const bars = [
    document.getElementById('str1'),
    document.getElementById('str2'),
    document.getElementById('str3'),
    document.getElementById('str4')
  ];

  if (!bars[0]) return;

  let strength = 0;

  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) strength++;

  bars.forEach((bar, i) => {
    bar.classList.remove('active', 'medium', 'strong');
    if (i < strength) {
      bar.classList.add('active');
      if (strength === 2 || strength === 3) bar.classList.add('medium');
      if (strength === 4) bar.classList.add('strong');
    }
  });
}

/* --- Login Handler (Mock) --- */
/* ================================================================
   Phase 6 — Real API handlers (with offline fallback)
   ================================================================ */

async function handleLogin(event) {
  event.preventDefault();

  const email    = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value;
  const role     = document.querySelector('.role-toggle__option.active')?.dataset?.role || 'motorist';
  const btn      = document.getElementById('loginBtn');
  const toast    = document.getElementById('loginToast');

  if (!email || !password) {
    showToast('Please enter your email and password.', 'error');
    return false;
  }

  if (btn) {
    btn.disabled   = true;
    btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> Signing in…';
    btn.style.opacity = '0.7';
  }

  /* ── Try real backend ── */
  if (typeof RBApi !== 'undefined') {
    const online = await RBApi.isOnline();

    if (online) {
      const result = await RBApi.auth.login(email, password, role);

      if (btn) {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
        btn.style.opacity = '1';
      }

      if (result.ok) {
        if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
        const dest = result.data.user.role === 'provider' ? 'dashboard-provider.html' : 'dashboard-motorist.html';
        setTimeout(() => { window.location.href = dest; }, 1200);
      } else {
        showToast(result.message || 'Login failed. Please check your credentials.', 'error');
      }
      return false;
    }
  }

  /* ── Offline fallback (demo mode) ── */
  showToast('Backend offline — running in demo mode.', 'info');
  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In'; btn.style.opacity = '1'; }
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
    const dest = role === 'provider' ? 'dashboard-provider.html' : 'dashboard-motorist.html';
    setTimeout(() => { window.location.href = dest; }, 1200);
  }, 900);
  return false;
}

/* --- Register Handler (Phase 6 — real API + offline fallback) --- */
async function handleRegister(event) {
  event.preventDefault();

  const password        = document.getElementById('regPassword')?.value;
  const confirmPassword = document.getElementById('confirmPassword')?.value;

  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return false;
  }

  const role = document.querySelector('.role-toggle__option.active')?.dataset?.role || 'motorist';
  const btn   = document.getElementById('registerBtn');
  const toast = document.getElementById('registerToast');

  const payload = {
    email:     document.getElementById('regEmail')?.value?.trim(),
    password,
    role,
    firstName: document.getElementById('firstName')?.value?.trim(),
    lastName:  document.getElementById('lastName')?.value?.trim(),
    phone:     document.getElementById('phone')?.value?.trim(),
    vehicleType:     document.getElementById('vehicleType')?.value,
    businessName:    document.getElementById('businessName')?.value?.trim(),
    serviceType:     document.getElementById('serviceType')?.value,
    businessAddress: document.getElementById('businessAddress')?.value?.trim(),
  };

  if (!payload.email || !payload.firstName || !payload.lastName) {
    showToast('Please fill in all required fields.', 'error');
    return false;
  }

  if (btn) {
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…';
    btn.style.opacity = '0.7';
  }

  /* ── Try real backend ── */
  if (typeof RBApi !== 'undefined') {
    const online = await RBApi.isOnline();

    if (online) {
      const result = await RBApi.auth.register(payload);

      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'; btn.style.opacity = '1'; }

      if (result.ok) {
        if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
        const dest = role === 'provider' ? 'dashboard-provider.html' : 'dashboard-motorist.html';
        setTimeout(() => { window.location.href = dest; }, 1400);
      } else {
        showToast(result.message || 'Registration failed. Please try again.', 'error');
      }
      return false;
    }
  }

  /* ── Offline fallback ── */
  showToast('Backend offline — running in demo mode.', 'info');
  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'; btn.style.opacity = '1'; }
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
    const dest = role === 'provider' ? 'dashboard-provider.html' : 'dashboard-motorist.html';
    setTimeout(() => { window.location.href = dest; }, 1400);
  }, 1000);
  return false;
}

/* --- Toast Notification --- */
function showToast(message, type = 'success') {
  const iconMap = { success: 'check', error: 'exclamation-triangle', info: 'bell' };
  const icon = iconMap[type] || 'check';
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <div class="toast__icon"><i class="fas fa-${icon}"></i></div>
    <div class="toast__text">${message}</div>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  });
}

/* --- Coming Soon Handler ---
   Used on any nav link, button, or card action that isn't wired to a
   real feature yet. Call this instead of leaving href="#" silently
   doing nothing — an honest "not built yet" beats a dead click. */
function showComingSoon(featureName, event) {
  if (event) event.preventDefault();
  const label = featureName || 'This feature';
  showToast(`${label} is coming soon — still in development.`, 'info');
  return false;
}

/* --- FAQ Toggle --- */
function toggleFaq(element) {
  const answer = element.querySelector('.faq-answer');
  const icon = element.querySelector('.faq-icon');

  if (!answer) return;

  const isOpen = answer.style.display !== 'none';

  if (isOpen) {
    answer.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(0deg)';
  } else {
    answer.style.display = 'block';
    if (icon) icon.style.transform = 'rotate(180deg)';
  }
}

/* --- Billing Toggle (Pricing Page) --- */
function initBillingToggle() {
  const toggle = document.getElementById('billingToggle');
  if (!toggle) return;

  const options = toggle.querySelectorAll('.role-toggle__option');

  const prices = {
    monthly: {
      pro: '499',
      ent: '1,299',
      proPeriod: 'per month',
      entPeriod: 'per month'
    },
    annual: {
      pro: '4,499',
      ent: '11,699',
      proPeriod: 'per year (save 25%)',
      entPeriod: 'per year (save 25%)'
    }
  };

  options.forEach(option => {
    option.addEventListener('click', () => {
      options.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');

      const billing = option.dataset.billing;
      const priceData = prices[billing];

      const proPrice = document.getElementById('proPrice');
      const entPrice = document.getElementById('entPrice');
      const proPeriod = document.getElementById('proPeriod');
      const entPeriod = document.getElementById('entPeriod');

      if (proPrice) proPrice.innerHTML = `<span class="currency">₱</span>${priceData.pro}`;
      if (entPrice) entPrice.innerHTML = `<span class="currency">₱</span>${priceData.ent}`;
      if (proPeriod) proPeriod.textContent = priceData.proPeriod;
      if (entPeriod) entPeriod.textContent = priceData.entPeriod;
    });
  });
}

/* --- Scroll Animations (Intersection Observer) --- */
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe feature cards, steps, pricing cards, and testimonials
  const animateElements = document.querySelectorAll(
    '.feature-card, .step, .pricing-card, .testimonial-card, .comparison-table, .faq-item'
  );

  animateElements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.5s ease ${index * 0.05}s, transform 0.5s ease ${index * 0.05}s`;
    observer.observe(el);
  });
}

/* --- Smooth Scroll for Nav Links --- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const navbarHeight = 80;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }
  });
});


/* ============================================================
   ROAD BUDDY — Admin Extension
   Admin-specific JavaScript. Appended to main.js.
   Covers: login-admin.html, register-admin.html,
           dashboard-admin.html
   ============================================================ */

/* ---- Auto-init on admin pages ---- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.querySelector('.admin-sidebar, .admin-auth')) {
    initAdminSidebarToggle();
    initAdminSectionNav();
  }
});

/* ---- Admin Sidebar Toggle (overrides initSidebarToggle for dark sidebar) ---- */
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

/* ---- Section Navigation (SPA-style for admin dashboard) ---- */
const adminSectionTitles = {
  overview:      { title: 'Admin Dashboard',           subtitle: 'RoadBuddy Control Panel · Super Admin' },
  analytics:     { title: 'Analytics',                 subtitle: 'Platform performance metrics' },
  motorists:     { title: 'Motorist Accounts',         subtitle: 'All registered motorists on the platform' },
  providers:     { title: 'Service Providers',         subtitle: 'Manage provider accounts and status' },
  verification:  { title: 'Verification Queue',        subtitle: '7 providers awaiting approval' },
  requests:      { title: 'All Assistance Requests',   subtitle: 'Complete platform request log' },
  subscriptions: { title: 'Subscriptions & Billing',   subtitle: 'Provider subscription management' },
  reports:       { title: 'Reports & Disputes',        subtitle: 'Active disputes requiring attention' },
  reviews:       { title: 'Review Moderation',         subtitle: 'Monitor and manage user reviews' },
  admins:        { title: 'Admin Accounts',            subtitle: 'Admin user management' },
  audit:         { title: 'Audit Log',                 subtitle: 'Full history of admin actions' },
  settings:      { title: 'System Settings',           subtitle: 'Platform configuration' },
};

function initAdminSectionNav() {
  // Highlight correct active link on initial load
  const activeLink = document.querySelector('.admin-sidebar__link.active');
  if (activeLink) {
    const match = (activeLink.getAttribute('onclick') || '').match(/showSection\('(\w+)'/);
    if (match) updateAdminPageHeader(match[1]);
  }
}

function showSection(sectionId, clickedEl) {
  // Hide all admin sections
  document.querySelectorAll('.admin-section').forEach(el => {
    el.style.display = 'none';
  });

  // Show the target section
  const target = document.getElementById('section-' + sectionId);
  if (target) {
    target.style.display = 'block';
    const main = document.querySelector('.dashboard__main');
    if (main) main.scrollTop = 0;
  }

  // Update sidebar active state
  document.querySelectorAll('.admin-sidebar__link').forEach(link => {
    link.classList.remove('active');
  });

  if (clickedEl) {
    clickedEl.classList.add('active');
  } else {
    // Find the matching link by parsing its onclick attribute
    document.querySelectorAll('.admin-sidebar__link').forEach(link => {
      if ((link.getAttribute('onclick') || '').includes("'" + sectionId + "'")) {
        link.classList.add('active');
      }
    });
  }

  updateAdminPageHeader(sectionId);

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 1024) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  return false; // prevent default anchor behaviour
}

function updateAdminPageHeader(sectionId) {
  const titleEl    = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');
  const info       = adminSectionTitles[sectionId];
  if (info && titleEl)    titleEl.textContent    = info.title;
  if (info && subtitleEl) subtitleEl.textContent = info.subtitle;
}

/* ---- Provider Approve / Reject — Quick List (Overview) ---- */
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
      showToast(name + ' has been approved successfully.', 'success');
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
      showToast('Provider application has been rejected.', 'error');
    }, 300);
  }, 700);
}

/* ---- Provider Approve / Reject — Verification Queue Cards ---- */
function approveProviderCard(cardId, name) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const btn = card.querySelector('.admin-btn-approve');
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...'; btn.disabled = true; }
  setTimeout(() => {
    card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.97)';
    setTimeout(() => {
      card.style.overflow  = 'hidden';
      card.style.maxHeight = '0';
      card.style.margin    = '0';
      card.style.padding   = '0';
      setTimeout(() => {
        card.remove();
        showToast(name + ' has been approved and is now active on the platform.', 'success');
      }, 400);
    }, 400);
  }, 800);
}

function rejectProviderCard(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const rejectBtn = card.querySelector('[onclick*="rejectProviderCard"]');
  if (rejectBtn) { rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting...'; rejectBtn.disabled = true; }
  setTimeout(() => {
    card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.97)';
    setTimeout(() => {
      card.remove();
      showToast('Provider application rejected. The applicant will be notified.', 'error');
    }, 400);
  }, 800);
}

/* ---- Alert Panel Bell ---- */
function toggleAlertPanel() {
  showToast('3 unresolved disputes and 7 pending verifications need attention.', 'warning');
}

/* ---- Admin Login Handler ---- */
/* --- Admin Login Handler (Phase 6) --- */
async function handleAdminLogin(event) {
  event.preventDefault();
  const email    = document.getElementById('adminEmail')?.value?.trim();
  const password = document.getElementById('adminPassword')?.value;
  const btn      = document.getElementById('adminLoginBtn');
  const toast    = document.getElementById('adminLoginToast');

  if (!email || !password) { showToast('Please enter your admin email and password.', 'error'); return false; }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating…'; btn.style.opacity = '0.75'; }

  /* ── Try real backend ── */
  if (typeof RBApi !== 'undefined') {
    const online = await RBApi.isOnline();
    if (online) {
      const result = await RBApi.auth.adminLogin(email, password);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-shield-halved"></i> Sign In to Admin Panel'; btn.style.opacity = '1'; }
      if (result.ok) {
        if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3500); }
        setTimeout(() => { window.location.href = 'dashboard-admin.html'; }, 1500);
      } else {
        showToast(result.message || 'Admin login failed.', 'error');
      }
      return false;
    }
  }

  /* ── Offline fallback ── */
  showToast('Backend offline — running in demo mode.', 'info');
  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-shield-halved"></i> Sign In to Admin Panel'; btn.style.opacity = '1'; }
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3500); }
    setTimeout(() => { window.location.href = 'dashboard-admin.html'; }, 1800);
  }, 1000);
  return false;
}

/* ---- Admin Register Handler (Phase 6) ---- */
async function handleAdminRegister(event) {
  event.preventDefault();
  const password        = document.getElementById('adminRegPassword')?.value;
  const confirmPassword = document.getElementById('adminConfirmPassword')?.value;

  if (password !== confirmPassword) { showToast('Passwords do not match. Please try again.', 'error'); return false; }

  const inviteCode = document.getElementById('inviteCode')?.value || '';
  if (inviteCode.replace(/-/g,'').length < 12) { showToast('Please enter and verify your invitation code.', 'error'); return false; }

  const btn   = document.getElementById('adminRegisterBtn');
  const toast = document.getElementById('adminRegisterToast');

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…'; btn.style.opacity = '0.75'; }

  /* ── Try real backend ── */
  if (typeof RBApi !== 'undefined') {
    const online = await RBApi.isOnline();
    if (online) {
      const result = await RBApi.auth.adminRegister({
        inviteCode,
        email:      document.getElementById('adminRegEmail')?.value?.trim(),
        password,
        firstName:  document.getElementById('adminFirstName')?.value?.trim(),
        lastName:   document.getElementById('adminLastName')?.value?.trim(),
        phone:      document.getElementById('adminPhone')?.value?.trim(),
        adminRole:  document.getElementById('adminRole')?.value,
        department: document.getElementById('adminDept')?.value?.trim(),
      });
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-shield"></i> Create Admin Account'; btn.style.opacity = '1'; }
      if (result.ok) {
        if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 4000); }
        setTimeout(() => { window.location.href = 'login-admin.html'; }, 2000);
      } else {
        showToast(result.message || 'Registration failed.', 'error');
      }
      return false;
    }
  }

  /* ── Offline fallback ── */
  showToast('Backend offline — running in demo mode.', 'info');
  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-shield"></i> Create Admin Account'; btn.style.opacity = '1'; }
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 4000); }
    setTimeout(() => { window.location.href = 'login-admin.html'; }, 2000);
  }, 1000);
  return false;
}

/* ---- Invite Code Formatter (XXXX-XXXX-XXXX) ---- */
function formatInviteCode(input) {
  let val = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (val.length > 4)  val = val.slice(0, 4)  + '-' + val.slice(4);
  if (val.length > 9)  val = val.slice(0, 9)  + '-' + val.slice(9);
  if (val.length > 14) val = val.slice(0, 14);
  input.value = val;
  // Reset status when user types
  const status = document.getElementById('inviteCodeStatus');
  if (status) { status.textContent = ''; status.className = 'admin-code-status'; }
}

/* ---- Invite Code Verifier (Phase 6 — real API + offline fallback) ---- */
async function verifyInviteCode() {
  const input  = document.getElementById('inviteCode');
  const status = document.getElementById('inviteCodeStatus');
  const btn    = document.getElementById('verifyCodeBtn');
  if (!input || !status) return;

  const code = input.value.trim();
  if (code.replace(/-/g,'').length < 12) {
    status.innerHTML = '⚠ Please enter a complete 12-character code.';
    status.className = 'admin-code-status invalid';
    return;
  }

  if (btn) { btn.textContent = '…'; btn.disabled = true; }

  const reset = () => { if (btn) { btn.textContent = 'Verify'; btn.disabled = false; } };

  /* ── Try real backend ── */
  if (typeof RBApi !== 'undefined') {
    const online = await RBApi.isOnline();
    if (online) {
      const result = await RBApi.auth.verifyInviteCode(code);
      reset();
      if (result.ok && result.data.valid) {
        status.innerHTML = `<i class="fas fa-check-circle"></i> Valid code — ${result.data.role} role assigned.`;
        status.className = 'admin-code-status valid';
        input.style.borderColor = 'var(--success-500)';
        const roleEl = document.getElementById('adminRole');
        if (roleEl && result.data.role) roleEl.value = result.data.role;
      } else {
        status.innerHTML = `<i class="fas fa-times-circle"></i> ${result.data?.message || result.message || 'Invalid invitation code.'}`;
        status.className = 'admin-code-status invalid';
      }
      return;
    }
  }

  /* ── Offline fallback ── */
  setTimeout(() => {
    reset();
    if (code === 'ROAD-BUDD-YADM') {
      status.innerHTML = '<i class="fas fa-check-circle"></i> Valid invitation code (demo mode). You may proceed.';
      status.className = 'admin-code-status valid';
      input.style.borderColor = 'var(--success-500)';
    } else {
      status.innerHTML = '<i class="fas fa-times-circle"></i> Invalid code. Backend offline — only demo code accepted.';
      status.className = 'admin-code-status invalid';
    }
  }, 700);
}

/* ---- Extended showToast — adds 'warning' type support ---- */
/* The original showToast in main.js only handles success/error.
   This override adds 'warning' and 'info' without breaking existing calls. */
(function () {
  const _orig = typeof showToast === 'function' ? showToast : null;

  window.showToast = function (message, type) {
    type = type || 'success';

    // For types the original already handles perfectly, delegate
    if ((type === 'success' || type === 'error') && _orig) {
      return _orig(message, type);
    }

    // Extended: warning, info
    const iconMap = { warning: 'triangle-exclamation', info: 'info-circle' };
    const toast   = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = type === 'warning'
      ? 'background:#fffbeb;border:1px solid #f59e0b;'
      : 'background:#eef2ff;border:1px solid #4338ca;';
    toast.innerHTML =
      '<div class="toast__icon" style="background:' + (type === 'warning' ? '#fef3c7;color:#d97706' : '#e0e7ff;color:#4338ca') + ';">' +
      '<i class="fas fa-' + (iconMap[type] || 'info-circle') + '"></i></div>' +
      '<div class="toast__text">' + message + '</div>';
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

/* END ADMIN EXTENSION */
