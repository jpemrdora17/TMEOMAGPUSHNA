/* ==============================================
   enforcer.js — Enforcer Dashboard Logic
   ============================================== */

let currentSession = null;
let cameraStream   = null;
let gpsWatcher     = null;
let lastGPSCoords  = null;

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  currentSession = requireAuth('Enforcer');
  if (!currentSession) return;
  populateTopbarUser(currentSession);
  document.getElementById('topbarUserDate').textContent = formatFullDate();
  loadViolationTypes();
  loadDashboardStats();
  loadTodayViolations();
  loadMyViolations();
  prefillDateTime();
  showPage('dashboard');
});

/* ===== PAGE NAVIGATION ===== */
function showPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.style.display = 'block';

  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  closeSidebar();

  // Refresh photos when submit page is shown
  if (page === 'submit') loadCapturedPhotos();
}

/* ===== SIDEBAR TOGGLE ===== */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

/* ===== DASHBOARD STATS ===== */
function loadDashboardStats() {
  const violations = Storage.getViolations();
  const mine = violations.filter(v => v.enforcerId === currentSession.id);
  const today = new Date().toISOString().split('T')[0];
  const todayMine = mine.filter(v => v.date === today);

  const container = document.getElementById('enforcerDashStats');
  if (!container) return;
  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">My Reports Today</div>
      <div class="stat-card-value">${todayMine.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Total My Reports</div>
      <div class="stat-card-value">${mine.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Pending</div>
      <div class="stat-card-value">${mine.filter(v => v.status === 'Pending').length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Resolved</div>
      <div class="stat-card-value">${mine.filter(v => v.status === 'Paid' || v.status === 'Resolved').length}</div>
    </div>
  `;
}

/* ===== TODAY'S VIOLATIONS TABLE ===== */
function loadTodayViolations() {
  const today = new Date().toISOString().split('T')[0];
  const violations = Storage.getViolations().filter(v =>
    v.enforcerId === currentSession.id && v.date === today
  );
  const tbody = document.getElementById('enforcerTodayBody');
  if (!tbody) return;
  if (violations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">No violations recorded today.</td></tr>';
    return;
  }
  tbody.innerHTML = violations.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${v.name}</td>
      <td>${v.plate || '—'}</td>
      <td>${v.type || '—'}</td>
      <td>${v.time || '—'}</td>
      <td><span class="badge badge-${(v.status||'Pending').toLowerCase()}">${v.status || 'Pending'}</span></td>
    </tr>
  `).join('');
}

/* ===== MY ALL VIOLATIONS ===== */
function loadMyViolations() {
  const violations = Storage.getViolations().filter(v => v.enforcerId === currentSession.id);
  const tbody = document.getElementById('myViolationsBody');
  if (!tbody) return;
  if (violations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">No reports submitted yet.</td></tr>';
    return;
  }
  tbody.innerHTML = [...violations].reverse().map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${v.name}</td>
      <td>${v.plate || '—'}</td>
      <td>${v.type || '—'}</td>
      <td>${v.date || '—'}</td>
      <td><span class="badge badge-${(v.status||'Pending').toLowerCase()}">${v.status || 'Pending'}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="viewMyTicket('${v.id}')">View</button></td>
    </tr>
  `).join('');
}

function viewMyTicket(id) {
  const v = Storage.getViolationById(id);
  if (!v) return;
  showPage('submit');
  // Pre-fill form with existing data for viewing
  setTimeout(() => {
    document.getElementById('srName').value    = v.name    || '';
    document.getElementById('srLicense').value = v.license || '';
    document.getElementById('srPlate').value   = v.plate   || '';
    document.getElementById('srNotes').value   = v.notes   || '';
    document.getElementById('srLocation').value= v.location|| '';
    document.getElementById('srDate').value    = v.date    || '';
    document.getElementById('srTime').value    = v.time    || '';
    // Generate tickets for view
    generateTickets(v, currentSession);
  }, 100);
}

/* ===== VIOLATION TYPES ===== */
function loadViolationTypes() {
  const types = Storage.getViolationTypes();
  const select = document.getElementById('srType');
  if (!select) return;
  select.innerHTML = '';
  if (types.length === 0) {
    // Default types if none configured
    const defaults = [
      { code:'NO-HELMET', name:'No Helmet', penalty:500 },
      { code:'NO-REG',    name:'No Registration', penalty:500 },
      { code:'ILLEGAL-PARK', name:'Illegal Parking', penalty:500 },
      { code:'BEATING-RED', name:'Beating Red Light', penalty:1000 },
      { code:'RECKLESS',  name:'Reckless Driving', penalty:2000 },
      { code:'NO-LICENSE', name:'No Driver\'s License', penalty:3000 },
      { code:'OVERLOADING', name:'Overloading', penalty:1000 },
      { code:'COUNTER-FLOW', name:'Counter Flow', penalty:1000 },
    ];
    defaults.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.code;
      opt.textContent = t.name;
      opt.dataset.penalty = t.penalty;
      select.appendChild(opt);
    });
  } else {
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.code;
      opt.textContent = t.name;
      opt.dataset.penalty = t.penalty || 0;
      select.appendChild(opt);
    });
  }
  srAutoFillPenalty();
}

function srAutoFillPenalty() {
  const select = document.getElementById('srType');
  const penaltyEl = document.getElementById('srPenalty');
  if (!select || !penaltyEl) return;
  const selected = select.options[select.selectedIndex];
  if (selected && selected.dataset.penalty) {
    penaltyEl.value = selected.dataset.penalty;
  }
}

/* ===== SUBMIT REPORT ===== */
function prefillDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('srDate');
  const timeEl = document.getElementById('srTime');
  if (dateEl) dateEl.value = now.toISOString().split('T')[0];
  if (timeEl) timeEl.value = now.toTimeString().slice(0,5);
}

function submitReport() {
  const name     = document.getElementById('srName').value.trim();
  const license  = document.getElementById('srLicense').value.trim();
  const plate    = document.getElementById('srPlate').value.trim();
  const vehicle  = document.getElementById('srVehicle').value;
  const typeEl   = document.getElementById('srType');
  const type     = typeEl.options[typeEl.selectedIndex]?.text || '';
  const typeCode = typeEl.value;
  const penalty  = document.getElementById('srPenalty').value;
  const date     = document.getElementById('srDate').value;
  const time     = document.getElementById('srTime').value;
  const location = document.getElementById('srLocation').value.trim();
  const notes    = document.getElementById('srNotes').value.trim();
  const errorEl  = document.getElementById('submitError');

  errorEl.style.display = 'none';

  if (!name || !plate || !location) {
    errorEl.textContent = 'Please fill in: Violator Name, Plate Number, and Location.';
    errorEl.style.display = 'block';
    return;
  }

  const photos = Storage.getCaptures ? Storage.getCaptures().map(c => c.dataUrl) : [];

  const violation = {
    id:          'V-' + Date.now(),
    name, license, plate, vehicle,
    type, typeCode, penalty,
    date, time, location, notes,
    photos,
    enforcerId:   currentSession.id,
    enforcerName: currentSession.name,
    status:       'Pending',
    createdAt:    new Date().toISOString()
  };

  Storage.addViolation(violation);

  showToast('✅ Violation report submitted successfully!', 'success');
  loadDashboardStats();
  loadTodayViolations();
  loadMyViolations();

  // Ticket generation is handled inline in enforcer.html
  // generateTickets() is called by the patched submitReport wrapper
}

function clearSubmitForm() {
  ['srName','srLicense','srPlate','srLocation','srNotes','srPenalty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  prefillDateTime();
  document.getElementById('submitError').style.display = 'none';
  const wrap = document.getElementById('ticketPreviewWrap');
  if (wrap) wrap.classList.remove('visible');
  srAutoFillPenalty();
}

/* ===== USE GPS IN SUBMIT FORM ===== */
function useGPSLocation() {
  if (!navigator.geolocation) {
    showToast('GPS not supported on this device.', 'error');
    return;
  }
  showToast('📡 Getting location...', 'info');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lng = pos.coords.longitude.toFixed(5);
      document.getElementById('srLocation').value = `${lat}, ${lng}`;
      lastGPSCoords = { lat, lng };
    },
    err => showToast('Could not get GPS: ' + err.message, 'error'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ===== CAMERA FUNCTIONS ===== */
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('cameraPreview').srcObject = cameraStream;
    document.getElementById('captureBtn').disabled = false;
    document.getElementById('cameraStatus').textContent = '📷 Camera active';
  } catch (err) {
    document.getElementById('cameraStatus').textContent = '❌ Camera error: ' + err.message;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
    document.getElementById('cameraPreview').srcObject = null;
    document.getElementById('captureBtn').disabled = true;
    document.getElementById('cameraStatus').textContent = 'Camera stopped.';
  }
}

function capturePhoto() {
  const video  = document.getElementById('cameraPreview');
  const canvas = document.getElementById('captureCanvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  const capture = { id: 'CAP-' + Date.now(), dataUrl, timestamp: new Date().toISOString() };
  const captures = Storage.getCaptures ? Storage.getCaptures() : [];
  captures.push(capture);
  if (Storage.saveCaptures) Storage.saveCaptures(captures);
  else localStorage.setItem('tmeo_captures', JSON.stringify(captures));

  renderCapturedPhotos([capture], true);
  showToast('📸 Photo captured!', 'success');
}

function loadCapturedPhotos() {
  const captures = JSON.parse(localStorage.getItem('tmeo_captures') || '[]');
  renderCapturedPhotos(captures, false);

  const photoList = document.getElementById('srPhotoList');
  if (photoList && captures.length > 0) {
    photoList.innerHTML = captures.slice(-3).map(c =>
      `<img src="${c.dataUrl}" class="capture-thumb" title="Evidence photo"/>`
    ).join('');
  }
}

function renderCapturedPhotos(captures, append) {
  const container = document.getElementById('capturedPhotos');
  if (!container) return;
  if (!append) container.innerHTML = '';
  if (captures.length === 0 && !append) {
    container.innerHTML = '<div style="color:var(--text-light);font-size:13px;">No photos captured yet.</div>';
    return;
  }
  captures.forEach(c => {
    const img = document.createElement('img');
    img.src       = c.dataUrl;
    img.className = 'capture-thumb';
    img.title     = 'Captured at ' + new Date(c.timestamp).toLocaleTimeString('en-PH');
    container.appendChild(img);
  });
}

/* ===== TOAST ===== */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
