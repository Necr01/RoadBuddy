/* ================================================================
   RoadBuddy — Phase 4: Ratings & Reviews Engine
   File: js/ratings.js
   ----------------------------------------------------------------
   - localStorage-backed with seeded reviews
   - Motorist: "Mark as Complete" triggers animated timeline
     update then opens star-rating modal
   - Provider: "Latest Reviews" wired to real stored data
   - Admin: Reviews section renders all reviews with flag action
   - Admin: Verification cards enhanced with document viewer
   - ID upload (register.html): FileReader → base64 → localStorage
   ================================================================ */

const RBRatings = (() => {

  const KEY      = 'rb_reviews_v1';
  const DOCS_KEY = 'rb_pending_docs_v1';

  /* ── Seeded reviews (tied to provider IDs used in map.js) ── */
  const SEED_REVIEWS = [
    { id: 'rev-1', providerId: 'p1', providerName: 'AutoFix Repair Shop',
      motoristName: 'Angela Cruz', rating: 5,
      comment: 'Napakabilis dumating, very professional. Highly recommended!',
      requestLabel: 'Flat Tire Replacement', date: Date.now() - 2 * 86400000, flagged: false },
    { id: 'rev-2', providerId: 'p1', providerName: 'AutoFix Repair Shop',
      motoristName: 'Mark Tan', rating: 4,
      comment: 'Great service, tire was fixed in under 20 minutes. Will use again.',
      requestLabel: 'Flat Tire Replacement', date: Date.now() - 3 * 86400000, flagged: false },
    { id: 'rev-3', providerId: 'p1', providerName: 'AutoFix Repair Shop',
      motoristName: 'Lisa Gomez', rating: 5,
      comment: 'Nagulat ako sa bilis. Sobrang helpful ng messaging feature.',
      requestLabel: 'Engine Repair', date: Date.now() - 5 * 86400000, flagged: false },
    { id: 'rev-4', providerId: 'p2', providerName: 'QuickTow Express',
      motoristName: 'Ana Reyes', rating: 5,
      comment: 'Very professional and fast. Will definitely use again.',
      requestLabel: 'Towing Service', date: Date.now() - 7 * 86400000, flagged: false },
    { id: 'rev-5', providerId: 'p3', providerName: 'PowerStart Battery',
      motoristName: 'Carlo Mendoza', rating: 4,
      comment: 'Quick response, battery replacement done in 10 minutes.',
      requestLabel: 'Battery Replacement', date: Date.now() - 9 * 86400000, flagged: false },
  ];

  /* ── State ── */
  let store = { reviews: [], nextId: 6 };
  let currentRating   = 0;
  let currentRequest  = null;
  let requestComplete = false;

  /* ── Init ── */
  function init() {
    try {
      const saved = localStorage.getItem(KEY);
      store = saved ? JSON.parse(saved) : { reviews: deepClone(SEED_REVIEWS), nextId: 6 };
    } catch (e) {
      store = { reviews: deepClone(SEED_REVIEWS), nextId: 6 };
    }
    // Ensure seeds always exist for fresh browsers
    if (!store.reviews.length) {
      store.reviews = deepClone(SEED_REVIEWS);
      store.nextId = 6;
    }
    persist();
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch(e) {}
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── Submit a new review ── */
  function submitReview({ providerId, providerName, motoristName, rating, comment, requestLabel }) {
    const rev = {
      id: 'rev-' + store.nextId++,
      providerId, providerName, motoristName,
      rating, comment: comment.trim(),
      requestLabel: requestLabel || 'Roadside Assistance',
      date: Date.now(), flagged: false
    };
    store.reviews.unshift(rev);
    persist();
    return rev;
  }

  /* ── Queries ── */
  function getAllReviews()            { return [...store.reviews].sort((a,b) => b.date - a.date); }
  function getProviderReviews(pid)   { return store.reviews.filter(r => r.providerId === pid).sort((a,b) => b.date - a.date); }
  function getProviderAverage(pid)   {
    const list = store.reviews.filter(r => r.providerId === pid);
    if (!list.length) return { avg: 0, count: 0 };
    return { avg: +(list.reduce((s,r) => s+r.rating,0) / list.length).toFixed(1), count: list.length };
  }

  function flagReview(id) {
    const r = store.reviews.find(r => r.id === id);
    if (r) { r.flagged = !r.flagged; persist(); }
  }

  /* ── Rating label per star value ── */
  function ratingLabel(v) {
    return ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][v] || '';
  }

  /* ── Build star HTML (read-only display) ── */
  function starsHtml(rating, small) {
    const sz = small ? 'font-size:0.6875rem;' : 'font-size:0.875rem;';
    let html = `<span style="color:var(--accent-400);${sz}display:inline-flex;gap:0.125rem;">`;
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating))       html += '<i class="fas fa-star"></i>';
      else if (i - rating < 1 && i - rating > 0) html += '<i class="fas fa-star-half-stroke"></i>';
      else                                html += '<i class="far fa-star"></i>';
    }
    html += '</span>';
    return html;
  }

  /* ── Format relative date ── */
  function relDate(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60)         return 'Just now';
    if (diff < 3600)       return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)      return Math.floor(diff/3600) + 'h ago';
    if (diff < 7 * 86400)  return Math.floor(diff/86400) + 'd ago';
    return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MOTORIST: Complete + Rate flow
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  function completeRequest() {
    if (requestComplete) return;
    requestComplete = true;

    // 1. Update timeline step 4 → completed
    const step4Node = document.getElementById('timelineStep4');
    if (step4Node) {
      step4Node.innerHTML = `
        <div style="width:1.5rem;height:1.5rem;border-radius:50%;background:var(--success-500);
          color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.625rem;flex-shrink:0;">
          <i class="fas fa-check"></i></div>
        <div>
          <div style="font-size:0.8125rem;font-weight:600;color:var(--success-600);">Service Completed</div>
          <div style="font-size:0.75rem;color:var(--gray-400);">Just now</div>
        </div>`;
    }

    // 2. Change status badge
    const badge = document.getElementById('requestStatusBadge');
    if (badge) {
      badge.className = 'status--completed';
      badge.style.cssText = 'padding:0.25rem 0.75rem;border-radius:var(--radius-full);font-size:0.75rem;font-weight:600;';
      badge.textContent = 'Completed';
    }

    // 3. Lock the messaging thread
    if (typeof RBMessaging !== 'undefined') {
      try {
        const s = JSON.parse(localStorage.getItem('rb_messages_v1') || '{}');
        if (s['req-001']) { s['req-001'].requestStatus = 'completed'; localStorage.setItem('rb_messages_v1', JSON.stringify(s)); }
      } catch(e) {}
    }

    // 4. Swap Complete button text
    const btn = document.getElementById('completeBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check-circle"></i> Completed'; btn.style.opacity = '0.6'; }

    showToast && showToast('Service marked as complete!', 'success');

    // 5. Open rating modal after 1.5s
    setTimeout(() => openRatingModal('req-001'), 1500);
  }

  function openRatingModal(requestId) {
    currentRequest = requestId;
    currentRating  = 0;

    // Reset star UI
    document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('star-btn--selected', 'star-btn--hover'));
    const lbl = document.getElementById('ratingLabel');
    if (lbl) lbl.textContent = 'Tap a star to rate';
    const comment = document.getElementById('ratingComment');
    if (comment) comment.value = '';
    const submitBtn = document.getElementById('submitRatingBtn');
    if (submitBtn) submitBtn.disabled = true;

    document.getElementById('ratingOverlay').classList.add('active');
    document.getElementById('ratingModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeRatingModal() {
    document.getElementById('ratingOverlay').classList.remove('active');
    document.getElementById('ratingModal').classList.remove('active');
    document.body.style.overflow = '';
  }

  function setRating(value) {
    currentRating = value;
    document.querySelectorAll('.star-btn').forEach(b => {
      const v = parseInt(b.dataset.value);
      b.classList.toggle('star-btn--selected', v <= value);
    });
    const lbl = document.getElementById('ratingLabel');
    if (lbl) { lbl.textContent = ratingLabel(value); lbl.className = `rating-label rating-label--${value >= 4 ? 'good' : value >= 3 ? 'ok' : 'low'}`; }
    const submitBtn = document.getElementById('submitRatingBtn');
    if (submitBtn) submitBtn.disabled = false;
  }

  function hoverRating(value) {
    document.querySelectorAll('.star-btn').forEach(b => {
      b.classList.toggle('star-btn--hover', parseInt(b.dataset.value) <= value);
    });
  }

  function resetHover() {
    document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('star-btn--hover'));
  }

  function doSubmitRating() {
    if (!currentRating) return;
    const comment = document.getElementById('ratingComment')?.value || '';
    submitReview({
      providerId:   'p1',
      providerName: 'AutoFix Repair Shop',
      motoristName: 'Maria Reyes',
      rating:       currentRating,
      comment,
      requestLabel: 'Flat Tire Replacement'
    });
    closeRatingModal();
    showToast && showToast('Review submitted — thank you!', 'success');

    // Refresh provider reviews widget if visible
    const widget = document.getElementById('motoristRecentReviews');
    if (widget) renderMotoristRecentReview(widget);
  }

  function renderMotoristRecentReview(container) {
    const rev = getAllReviews().find(r => r.motoristName === 'Maria Reyes');
    if (!rev || !container) return;
    container.innerHTML = `
      <div class="review-thanks">
        ${starsHtml(rev.rating)}
        <div class="review-thanks__text">"${rev.comment || 'No comment left.'}"</div>
        <div class="review-thanks__meta">${relDate(rev.date)}</div>
      </div>`;
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PROVIDER: Latest Reviews
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  function renderProviderReviews() {
    const container = document.getElementById('providerReviewsList');
    if (!container) return;
    const reviews = getProviderReviews('p1').slice(0, 5);
    const avg     = getProviderAverage('p1');

    // Update average display
    const avgEl = document.getElementById('providerAvgRating');
    if (avgEl) avgEl.textContent = avg.avg;
    const cntEl = document.getElementById('providerReviewCount');
    if (cntEl) cntEl.textContent = avg.count + ' reviews';

    container.innerHTML = reviews.map((r, i) => `
      <div class="review-item ${i < reviews.length - 1 ? 'review-item--border' : ''}">
        <div class="review-item__header">
          ${starsHtml(r.rating, true)}
          <span class="review-item__date">${relDate(r.date)}</span>
        </div>
        ${r.comment ? `<p class="review-item__comment">"${r.comment}"</p>` : ''}
        <div class="review-item__author">${r.motoristName} · ${r.requestLabel}</div>
      </div>`).join('');
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ADMIN: All Reviews section
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  function renderAdminReviews() {
    const container = document.getElementById('adminReviewsList');
    if (!container) return;

    const reviews = getAllReviews();
    const totalAvg = reviews.length
      ? (reviews.reduce((s,r) => s+r.rating, 0) / reviews.length).toFixed(1)
      : '—';

    const el = id => document.getElementById(id);
    const setText = (id, v) => { if (el(id)) el(id).textContent = v; };
    setText('adminRevTotal',   reviews.length);
    setText('adminRevAvg',     totalAvg);
    setText('adminRevFlagged', reviews.filter(r => r.flagged).length);

    if (!reviews.length) {
      container.innerHTML = '<div class="admin-placeholder-content"><i class="fas fa-star"></i><div>No reviews yet.</div></div>';
      return;
    }

    container.innerHTML = reviews.map(r => `
      <div class="admin-review-row ${r.flagged ? 'admin-review-row--flagged' : ''}" id="arev-${r.id}">
        <div class="admin-review-row__rating">
          ${starsHtml(r.rating)}
          <span class="admin-review-row__score">${r.rating}/5</span>
        </div>
        <div class="admin-review-row__body">
          <div class="admin-review-row__parties">
            <strong>${r.motoristName}</strong>
            <span style="color:var(--gray-400);">→</span>
            <strong>${r.providerName}</strong>
            <span class="admin-review-row__label">${r.requestLabel}</span>
          </div>
          ${r.comment ? `<p class="admin-review-row__comment">"${r.comment}"</p>` : '<p class="admin-review-row__comment" style="color:var(--gray-300);">No comment left.</p>'}
        </div>
        <div class="admin-review-row__meta">
          <span class="admin-review-row__date">${relDate(r.date)}</span>
          <button class="btn btn--ghost btn--sm admin-review-flag-btn ${r.flagged ? 'admin-review-flag-btn--active' : ''}"
            onclick="adminFlagReview('${r.id}')" title="${r.flagged ? 'Unflag' : 'Flag for review'}">
            <i class="fas fa-flag"></i> ${r.flagged ? 'Flagged' : 'Flag'}
          </button>
        </div>
      </div>`).join('');
  }

  function adminFlagReview(id) {
    flagReview(id);
    renderAdminReviews();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ADMIN: Verification document viewer
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  function toggleDocuments(cardId) {
    const panel = document.getElementById('docs-' + cardId);
    if (!panel) return;
    const isOpen = panel.classList.toggle('docs-panel--open');
    const btn = document.getElementById('viewdocs-' + cardId);
    if (btn) btn.innerHTML = isOpen
      ? '<i class="fas fa-chevron-up"></i> Hide Documents'
      : '<i class="fas fa-folder-open"></i> View Documents';

    if (isOpen && !panel.dataset.loaded) {
      panel.dataset.loaded = '1';
      loadDocuments(panel, cardId);
    }
  }

  function loadDocuments(panel, cardId) {
    let docs = {};
    try { docs = JSON.parse(localStorage.getItem(DOCS_KEY) || '{}'); } catch(e) {}

    const cardDocs = docs[cardId] || {};
    const idSrc    = cardDocs.id_photo || null;
    const selfieSrc = cardDocs.selfie  || null;

    panel.innerHTML = `
      <div class="docs-panel__grid">
        <div class="docs-panel__doc">
          <div class="docs-panel__doc-label"><i class="fas fa-id-card"></i> Government-Issued ID</div>
          ${idSrc
            ? `<img src="${idSrc}" class="docs-panel__img" alt="ID Photo">`
            : `<div class="docs-panel__placeholder"><i class="fas fa-id-card"></i><span>No ID uploaded yet<br><small>Applicant must upload via registration form</small></span></div>`
          }
        </div>
        <div class="docs-panel__doc">
          <div class="docs-panel__doc-label"><i class="fas fa-camera"></i> Selfie with ID</div>
          ${selfieSrc
            ? `<img src="${selfieSrc}" class="docs-panel__img" alt="Selfie">`
            : `<div class="docs-panel__placeholder"><i class="fas fa-camera"></i><span>No selfie uploaded yet<br><small>Applicant must upload via registration form</small></span></div>`
          }
        </div>
      </div>
      <p class="docs-panel__note"><i class="fas fa-info-circle"></i> Documents are submitted by the provider during registration. Approve only after verifying authenticity.</p>`;
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     REGISTER: ID upload helpers
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  function handleIdUpload(type, input, cardId) {
    const file = input.files[0];
    if (!file) return;

    // Validate
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!allowed.includes(file.type)) {
      showToast && showToast('Invalid file type. Please upload an image or PDF.', 'error');
      return;
    }
    if (file.size > maxSize) {
      showToast && showToast('File too large. Maximum 5MB allowed.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target.result;

      // Show preview
      const preview = document.getElementById(type + 'Preview');
      const img     = document.getElementById(type + 'Img');
      const name    = document.getElementById(type + 'Name');
      const zone    = document.getElementById(type + 'Zone');
      if (preview) preview.style.display = 'flex';
      if (img && file.type.startsWith('image/')) img.src = b64;
      else if (img) img.src = ''; // PDF: no image preview
      if (name) name.textContent = `${file.name} (${(file.size/1024).toFixed(0)} KB)`;
      if (zone) zone.classList.add('upload-zone--done');

      // Save to localStorage so admin can view (keyed to a session ID)
      try {
        const sessionId = localStorage.getItem('rb_reg_session') || ('sess_' + Date.now());
        localStorage.setItem('rb_reg_session', sessionId);
        const docs = JSON.parse(localStorage.getItem(DOCS_KEY) || '{}');
        if (!docs[sessionId]) docs[sessionId] = {};
        docs[sessionId][type] = b64;
        localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
      } catch(e) {}

      showToast && showToast('Document uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  }

  init();

  return {
    submitReview, getAllReviews, getProviderReviews, getProviderAverage,
    flagReview, starsHtml, relDate,
    // Controllers
    completeRequest, openRatingModal, closeRatingModal,
    setRating, hoverRating, resetHover, doSubmitRating,
    renderProviderReviews, renderAdminReviews, adminFlagReview,
    toggleDocuments, handleIdUpload, renderMotoristRecentReview
  };
})();

/* ── Global wrappers (called from onclick in HTML) ── */
function completeRequest()        { RBRatings.completeRequest(); }
function openRatingModal(id)      { RBRatings.openRatingModal(id); }
function closeRatingModal()       { RBRatings.closeRatingModal(); }
function setRating(v)             { RBRatings.setRating(v); }
function hoverRating(v)           { RBRatings.hoverRating(v); }
function resetHover()             { RBRatings.resetHover(); }
function submitRating()           { RBRatings.doSubmitRating(); }
function adminFlagReview(id)      { RBRatings.adminFlagReview(id); }
function toggleDocuments(cardId)  { RBRatings.toggleDocuments(cardId); }
function handleIdUpload(type, el) { RBRatings.handleIdUpload(type, el); }
function triggerUpload(inputId)   { document.getElementById(inputId)?.click(); }

function renderAdminReviews()   { RBRatings.renderAdminReviews(); }
function renderProviderReviews(){ RBRatings.renderProviderReviews(); }

/* ── Auto-init on load ── */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('providerReviewsList'))   renderProviderReviews();
  if (document.getElementById('adminReviewsList'))      renderAdminReviews();
  if (document.getElementById('motoristRecentReviews')) {
    const w = document.getElementById('motoristRecentReviews');
    RBRatings.renderMotoristRecentReview(w);
  }
});

/* ── Admin section hook: re-render when section becomes visible ── */
(function patchShowSection() {
  if (typeof window._ratingsPatchDone !== 'undefined') return;
  window._ratingsPatchDone = true;
  const orig = window.showSection;
  window.showSection = function(sectionId, linkEl) {
    orig && orig(sectionId, linkEl);
    if (sectionId === 'reviews')       setTimeout(renderAdminReviews, 60);
    if (sectionId === 'verification')  { /* doc panels load on click */ }
  };
})();
