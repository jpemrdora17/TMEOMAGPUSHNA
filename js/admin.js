/* ==============================================
   admin.js — Admin Dashboard Logic
   Handles all pages: dashboard, violations,
   enforcers, violation types, reports, users
   ============================================== */

let currentSession = null;
let editingUserId = null;
let editingVtCode = null;
let currentViolationId = null;

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Protect page — must be Admin
  currentSession = requireAuth('Admin');
  if (!currentSession) return;

  // Populate topbar
  populateTopbarUser(currentSession);

  // Load default page
  showPage('dashboard');
  seedDefaultAccounts();
});

/* ===== PAGE NAVIGATION ===== */
function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');

  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page
  const page = document.getElementById('page-' + pageId);
  if (page) page.style.display = 'block';

  // Activate nav item
  const navItem = document.querySelector(`[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');

  // Load page data
  switch (pageId) {
    case 'dashboard':      loadDashboard();      break;
    case 'violations':     loadViolations();     break;
    case 'gis-map':        loadGISData();        break;
    case 'gps-tracking':   loadGPSTracking();    break;
    case 'enforcers':      loadEnforcers();      break;
    case 'violation-types':loadViolationTypes(); break;
    case 'reports':        loadReports();        break;
    case 'user-management':loadUsers();          break;
  }

  // Close mobile sidebar
  closeSidebar();
}

/* ===== SIDEBAR TOGGLE (Mobile) ===== */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function loadDashboard() {
  const violations = Storage.getViolations();
  const users = Storage.getUsers();
  const today = todayStr();

  const totalViolations  = violations.length;
  const todayViolations  = violations.filter(v => v.date === today).length;
  const pending          = violations.filter(v => v.status === 'Pending').length;
  const approved         = violations.filter(v => v.status === 'Approved').length;
  const enforcers        = users.filter(u => u.role === 'Enforcer').length;

  // Render stat cards
  const statsEl = document.getElementById('dashboardStats');
  statsEl.innerHTML = `
    ${statCard('Total Violations Recorded', totalViolations, '📋', 'icon-blue')}
    ${statCard('Violations Today',           todayViolations,  '🚨', 'icon-red')}
    ${statCard('Pending Assessments',        pending,          '⏳', 'icon-yellow')}
    ${statCard('Approved Violations',        approved,         '✅', 'icon-green')}
    ${statCard('Active Traffic Enforcers',   enforcers,        '👮', 'icon-purple')}
  `;

  // Bar charts
  renderViolationTypeChart(violations);
  renderTrendChart(violations);

  // Hotspot data
  renderHotspots(violations);

  // Collection summary
  renderCollectionSummary(violations);
}

function statCard(label, value, icon, iconClass) {
  return `
    <div class="stat-card">
      <div class="stat-card-top">
        <div>
          <div class="stat-card-label">${label}</div>
        </div>
        <div class="stat-card-icon ${iconClass}">${icon}</div>
      </div>
      <div class="stat-card-value">${value}</div>
    </div>
  `;
}

function renderViolationTypeChart(violations) {
  const typeCounts = {};
  violations.forEach(v => {
    typeCounts[v.violationType] = (typeCounts[v.violationType] || 0) + 1;
  });

  const sorted = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max = sorted.length ? Math.max(...sorted.map(e=>e[1])) : 1;

  const chartEl = document.getElementById('violationTypeChart');
  if (!sorted.length) {
    chartEl.innerHTML = '<div style="color:var(--text-light);font-size:12px;margin:auto;">No data yet</div>';
    return;
  }

  chartEl.innerHTML = sorted.map(([type, count]) => {
    const pct = Math.max(8, Math.round((count / max) * 140));
    const shortLabel = type.length > 10 ? type.substring(0,10)+'…' : type;
    return `
      <div class="bar-item">
        <div class="bar-fill" style="height:${pct}px;" data-value="${count}" title="${type}: ${count}"></div>
        <div class="bar-label">${shortLabel}</div>
      </div>
    `;
  }).join('');
}

function renderTrendChart(violations) {
  const months = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleString('en-PH', { month: 'short' })
    });
  }

  const counts = months.map(m => ({
    label: m.label,
    count: violations.filter(v => v.date && v.date.startsWith(m.key)).length
  }));

  const max = Math.max(...counts.map(c=>c.count), 1);
  const chartEl = document.getElementById('violationTrendChart');
  chartEl.innerHTML = counts.map(c => {
    const pct = Math.max(4, Math.round((c.count / max) * 140));
    return `
      <div class="bar-item">
        <div class="bar-fill" style="height:${pct}px;background:var(--primary-light);" data-value="${c.count}"></div>
        <div class="bar-label">${c.label}</div>
      </div>
    `;
  }).join('');
}

function renderHotspots(violations) {
  const locationCounts = {};
  violations.forEach(v => {
    if (v.location) locationCounts[v.location] = (locationCounts[v.location] || 0) + 1;
  });
  const sorted = Object.entries(locationCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const el = document.getElementById('hotspotList');
  if (!sorted.length) return;
  el.innerHTML = sorted.map(([loc, cnt]) =>
    `<div class="bottom-card-row"><span>${loc}</span><span>${cnt} violations</span></div>`
  ).join('');
}

function renderCollectionSummary(violations) {
  const paid    = violations.filter(v => v.status === 'Paid');
  const pending = violations.filter(v => v.status === 'Pending' || v.status === 'Approved');
  const totalCollected = paid.reduce((s,v) => s + (parseFloat(v.penalty)||0), 0);
  const totalPending   = pending.reduce((s,v) => s + (parseFloat(v.penalty)||0), 0);
  const rate = violations.length ? Math.round((paid.length / violations.length) * 100) : 0;

  document.getElementById('collectionSummary').innerHTML = `
    <div class="bottom-card-row"><span>Total Collected</span><span>${formatPeso(totalCollected)}</span></div>
    <div class="bottom-card-row"><span>Pending Payments</span><span>${formatPeso(totalPending)}</span></div>
    <div class="bottom-card-row"><span>Collection Rate</span><span>${rate}%</span></div>
  `;
}

/* ============================================================
   VIOLATION RECORDS
   ============================================================ */
function loadViolations() {
  // Populate filter dropdowns
  const types = Storage.getViolationTypes();
  const typeFilter = document.getElementById('filterViolationType');
  typeFilter.innerHTML = '<option value="">All Types</option>' +
    types.map(t => `<option value="${t.name}">${t.name}</option>`).join('');

  filterViolations();
}

function filterViolations() {
  const search = (document.getElementById('violationSearch')?.value || '').toLowerCase();
  const type   = document.getElementById('filterViolationType')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const date   = document.getElementById('filterDate')?.value || '';

  let violations = Storage.getViolations();

  if (search) violations = violations.filter(v =>
    v.violatorName?.toLowerCase().includes(search) ||
    v.plateNumber?.toLowerCase().includes(search) ||
    v.id?.toLowerCase().includes(search)
  );
  if (type)   violations = violations.filter(v => v.violationType === type);
  if (status) violations = violations.filter(v => v.status === status);
  if (date)   violations = violations.filter(v => v.date === date);

  document.getElementById('violationCount').textContent =
    `Showing ${violations.length} of ${Storage.getViolations().length} violation records`;

  renderViolationsTable(violations);
}

function renderViolationsTable(violations) {
  const tbody = document.getElementById('violationsTableBody');
  if (!violations.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text-light);">No violation records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = violations.map(v => `
    <tr>
      <td><span style="font-weight:600;color:var(--primary);">${v.id}</span></td>
      <td>${v.violatorName}</td>
      <td>${v.licenseNo}</td>
      <td><span style="font-weight:600;">${v.plateNumber}</span></td>
      <td>${v.vehicleType}</td>
      <td>${v.violationType}</td>
      <td>${v.date}</td>
      <td>${v.time}</td>
      <td>${v.location}</td>
      <td>${v.enforcerName || v.enforcer}</td>
      <td>${statusBadge(v.status)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="viewViolation('${v.id}')">View</button>
          <button class="btn btn-outline btn-sm" onclick="changeViolationStatus('${v.id}')">Status</button>
          <button class="btn btn-danger btn-sm" onclick="deleteViolation('${v.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function statusBadge(status) {
  const map = {
    'Pending':   'badge-warning',
    'Approved':  'badge-info',
    'Paid':      'badge-success',
    'Dismissed': 'badge-gray'
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}

function viewViolation(id) {
  const v = Storage.getViolationById(id);
  if (!v) return;
  currentViolationId = id;

  document.getElementById('violationDetailContent').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div><div class="form-label">Violation ID</div><div style="font-weight:600;color:var(--primary);">${v.id}</div></div>
      <div><div class="form-label">Status</div>${statusBadge(v.status)}</div>
      <div><div class="form-label">Violator Name</div><div>${v.violatorName}</div></div>
      <div><div class="form-label">License Number</div><div>${v.licenseNo}</div></div>
      <div><div class="form-label">Plate Number</div><div style="font-weight:600;">${v.plateNumber}</div></div>
      <div><div class="form-label">Vehicle Type</div><div>${v.vehicleType}</div></div>
      <div><div class="form-label">Violation Type</div><div>${v.violationType}</div></div>
      <div><div class="form-label">Penalty</div><div style="font-weight:700;color:var(--danger);">${formatPeso(v.penalty)}</div></div>
      <div><div class="form-label">Date</div><div>${v.date}</div></div>
      <div><div class="form-label">Time</div><div>${v.time}</div></div>
      <div style="grid-column:span 2;"><div class="form-label">Location</div><div>${v.location}</div></div>
      <div style="grid-column:span 2;"><div class="form-label">Enforcer</div><div>${v.enforcerName || v.enforcer}</div></div>
      ${v.notes ? `<div style="grid-column:span 2;"><div class="form-label">Notes</div><div>${v.notes}</div></div>` : ''}
    </div>
  `;

  openModal('violationDetailModal');
}

function changeViolationStatus(id) {
  const v = Storage.getViolationById(id);
  if (!v) return;
  const statuses = ['Pending', 'Approved', 'Paid', 'Dismissed'];
  const nextIdx  = (statuses.indexOf(v.status) + 1) % statuses.length;
  v.status = statuses[nextIdx];
  Storage.updateViolation(v);
  filterViolations();
  showToast(`Status changed to: ${v.status}`, 'info');
}

function deleteViolation(id) {
  if (!confirm('Delete this violation record?')) return;
  Storage.deleteViolation(id);
  filterViolations();
  showToast('Violation deleted.', 'info');
}

function printCurrentReceipt() {
  if (!currentViolationId) return;
  const v = Storage.getViolationById(currentViolationId);
  printReceipt(v);
}

function exportViolationsCSV() {
  const violations = Storage.getViolations();
  const headers = ['Violation ID','Violator','License No','Plate','Vehicle','Violation','Date','Time','Location','Enforcer','Status','Penalty'];
  const rows = violations.map(v => [
    v.id, v.violatorName, v.licenseNo, v.plateNumber, v.vehicleType,
    v.violationType, v.date, v.time, v.location, v.enforcerName||v.enforcer,
    v.status, v.penalty
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  downloadFile('violations.csv', csv, 'text/csv');
  showToast('Exported to CSV!', 'success');
}

/* ============================================================
   GIS MAP
   ============================================================ */
function loadGISData() {
  const violations = Storage.getViolations();
  const types = Storage.getViolationTypes();

  const gisTypeEl = document.getElementById('gisTypeFilter');
  if (gisTypeEl) {
    gisTypeEl.innerHTML = '<option value="">All Types</option>' +
      types.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
  }

  const countEl = document.getElementById('gisViolationCount');
  if (countEl) countEl.textContent = `${violations.length} violations shown`;

  // Recent violations table
  const tbody = document.getElementById('gisRecentBody');
  if (tbody) {
    const recent = [...violations].reverse().slice(0, 10);
    tbody.innerHTML = recent.length ? recent.map(v => `
      <tr>
        <td>${v.violationType}</td>
        <td>${v.violatorName}</td>
        <td>${v.plateNumber}</td>
        <td>${v.location}</td>
        <td>${v.date} ${v.time}</td>
        <td>${v.enforcerName || v.enforcer}</td>
      </tr>
    `).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-light);">No violations found.</td></tr>`;
  }
}

/* ============================================================
   GPS TRACKING
   ============================================================ */
function loadGPSTracking() {
  const users = Storage.getUsers();
  const enforcers = users.filter(u => u.role === 'Enforcer');
  const violations = Storage.getViolations();
  const today = todayStr();
  const todayTickets = violations.filter(v => v.date === today).length;

  document.getElementById('gpsTotal').textContent   = enforcers.length;
  document.getElementById('gpsActive').textContent  = enforcers.filter(u => u.status === 'Active').length;
  document.getElementById('gpsTickets').textContent = todayTickets;
  document.getElementById('gpsCoverage').textContent = enforcers.length > 0 ? enforcers.length * 2 + ' km²' : '0';

  const statusList = document.getElementById('enforcerStatusList');
  if (!enforcers.length) {
    statusList.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:24px;">No enforcers registered yet.</div>';
    return;
  }

  statusList.innerHTML = enforcers.map(e => {
    const ticketCount = violations.filter(v => v.enforcer === e.id && v.date === today).length;
    return `
      <div class="enforcer-card">
        <div class="enforcer-card-info">
          <h4>${e.name}</h4>
          <p>${e.badgeNumber} • Location: Lucena City • Last seen: just now</p>
        </div>
        <div style="text-align:right;">
          <div class="${e.status === 'Active' ? 'status-pill status-active' : 'status-pill status-offline'}">${e.status}</div>
          <div style="font-size:11px;color:var(--text-light);margin-top:4px;">No. of Tickets: ${ticketCount}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   MANAGE ENFORCERS
   ============================================================ */
function loadEnforcers() {
  const users = Storage.getUsers();
  const enforcers = users.filter(u => u.role === 'Enforcer');
  const active   = enforcers.filter(u => u.status === 'Active').length;
  const onBreak  = 0; // simulated
  const inactive = enforcers.filter(u => u.status === 'Inactive').length;

  document.getElementById('enforcerStats').innerHTML = `
    ${statCard('Total Enforcers', enforcers.length, '👮', 'icon-blue')}
    ${statCard('Active',          active,           '🟢', 'icon-green')}
    ${statCard('On Break',        onBreak,          '⏸',  'icon-yellow')}
    ${statCard('Inactive',        inactive,         '🔴', 'icon-red')}
  `;

  document.getElementById('enforcerTableCount').textContent =
    `Showing ${enforcers.length} of ${enforcers.length} officers`;

  renderEnforcersTable(enforcers);
}

function filterEnforcers() {
  const search = document.getElementById('enforcerSearch')?.value.toLowerCase() || '';
  const enforcers = Storage.getUsers().filter(u => u.role === 'Enforcer').filter(e =>
    e.name.toLowerCase().includes(search) ||
    e.badgeNumber?.toLowerCase().includes(search)
  );
  renderEnforcersTable(enforcers);
}

function renderEnforcersTable(enforcers) {
  const tbody = document.getElementById('enforcersTableBody');
  if (!enforcers.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-light);">No enforcers found.</td></tr>`;
    return;
  }
  tbody.innerHTML = enforcers.map(e => `
    <tr>
      <td>${e.id}</td>
      <td style="font-weight:600;">${e.name}</td>
      <td>${e.badgeNumber}</td>
      <td>Lucena City</td>
      <td>${e.phone}</td>
      <td>${formatDate(e.createdAt)}</td>
      <td>${statusBadge(e.status)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editUser('${e.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUserById('${e.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddEnforcerModal() {
  editingUserId = null;
  document.getElementById('userModalTitle').textContent = 'Add Enforcer';
  document.getElementById('modalUserRole').value = 'Enforcer';
  clearUserModal();
  openModal('userModal');
}

/* ============================================================
   VIOLATION TYPES
   ============================================================ */
function loadViolationTypes() {
  const types = Storage.getViolationTypes();
  const safety  = types.filter(t => t.category === 'Safety').length;
  const traffic = types.filter(t => t.category === 'Traffic').length;
  const avgPenalty = types.length
    ? Math.round(types.reduce((s,t) => s + parseFloat(t.penalty||0), 0) / types.length)
    : 0;

  document.getElementById('vtStats').innerHTML = `
    ${statCard('Total Types',      types.length, '📋', 'icon-blue')}
    ${statCard('Safety Violations', safety,       '🦺', 'icon-yellow')}
    ${statCard('Traffic Violations',traffic,      '🚦', 'icon-red')}
    ${statCard('Average Penalty',   '₱'+avgPenalty,'💰', 'icon-green')}
  `;

  filterViolationTypes();
}

function filterViolationTypes() {
  const search   = document.getElementById('vtSearch')?.value.toLowerCase() || '';
  const category = document.getElementById('vtCategoryFilter')?.value || '';
  let types = Storage.getViolationTypes();
  if (search)   types = types.filter(t => t.name.toLowerCase().includes(search) || t.code.toLowerCase().includes(search));
  if (category) types = types.filter(t => t.category === category);
  document.getElementById('vtTableCount').textContent = `Showing ${types.length} of ${Storage.getViolationTypes().length} violation types`;
  renderViolationTypesTable(types);
}

function renderViolationTypesTable(types) {
  const tbody = document.getElementById('vtTableBody');
  if (!types.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-light);">No violation types found.</td></tr>`;
    return;
  }
  tbody.innerHTML = types.map(t => `
    <tr>
      <td><span style="font-weight:600;color:var(--primary);">${t.code}</span></td>
      <td style="font-weight:600;">${t.name}</td>
      <td>${t.description}</td>
      <td><span class="badge ${t.category==='Safety'?'badge-warning':'badge-info'}">${t.category}</span></td>
      <td style="font-weight:700;color:var(--danger);">${formatPeso(t.penalty)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editViolationType('${t.code}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteViolationTypeByCode('${t.code}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddViolationTypeModal() {
  editingVtCode = null;
  document.getElementById('vtModalTitle').textContent = 'Add Violation Type';
  document.getElementById('vtCode').value = '';
  document.getElementById('vtName').value = '';
  document.getElementById('vtDescription').value = '';
  document.getElementById('vtCategory').value = 'Traffic';
  document.getElementById('vtPenalty').value = '';
  document.getElementById('vtCode').disabled = false;
  openModal('vtModal');
}

function editViolationType(code) {
  const type = Storage.getViolationTypes().find(t => t.code === code);
  if (!type) return;
  editingVtCode = code;
  document.getElementById('vtModalTitle').textContent = 'Edit Violation Type';
  document.getElementById('vtCode').value = type.code;
  document.getElementById('vtCode').disabled = true;
  document.getElementById('vtName').value = type.name;
  document.getElementById('vtDescription').value = type.description;
  document.getElementById('vtCategory').value = type.category;
  document.getElementById('vtPenalty').value = type.penalty;
  openModal('vtModal');
}

function saveViolationType() {
  const code  = document.getElementById('vtCode').value.trim();
  const name  = document.getElementById('vtName').value.trim();
  const desc  = document.getElementById('vtDescription').value.trim();
  const cat   = document.getElementById('vtCategory').value;
  const pen   = parseFloat(document.getElementById('vtPenalty').value) || 0;

  if (!name || !pen) {
    showToast('Please fill in all required fields.', 'error'); return;
  }

  const typeObj = { code: code || 'VT-' + Date.now(), name, description: desc, category: cat, penalty: pen };

  if (editingVtCode) {
    Storage.updateViolationType(typeObj);
    showToast('Violation type updated!', 'success');
  } else {
    if (Storage.getViolationTypes().find(t => t.code === code)) {
      showToast('Code already exists.', 'error'); return;
    }
    Storage.addViolationType(typeObj);
    showToast('Violation type added!', 'success');
  }
  closeModal('vtModal');
  loadViolationTypes();
}

function deleteViolationTypeByCode(code) {
  if (!confirm('Delete this violation type?')) return;
  Storage.deleteViolationType(code);
  loadViolationTypes();
  showToast('Violation type deleted.', 'info');
}

/* ============================================================
   REPORTS
   ============================================================ */
function loadReports() {
  // Set default date range (this month)
  const from = document.getElementById('reportDateFrom');
  const to   = document.getElementById('reportDateTo');
  if (from && !from.value) {
    const d = new Date();
    from.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    to.value   = todayStr();
  }
}

function generateReport(type) {
  const from = document.getElementById('reportDateFrom')?.value;
  const to   = document.getElementById('reportDateTo')?.value;
  let violations = Storage.getViolations();

  if (from) violations = violations.filter(v => v.date >= from);
  if (to)   violations = violations.filter(v => v.date <= to);

  let html = '';
  const periodLabel = from && to ? `${from} to ${to}` : 'All Time';

  if (type === 'daily' || type === 'monthly') {
    html = `
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:700;">
        ${type === 'daily' ? 'Daily' : 'Monthly'} Violations Report
      </h3>
      <p style="color:var(--text-light);font-size:13px;margin-bottom:20px;">Period: ${periodLabel}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
        <div class="stat-card"><div class="stat-card-label">Total</div><div class="stat-card-value">${violations.length}</div></div>
        <div class="stat-card"><div class="stat-card-label">Pending</div><div class="stat-card-value">${violations.filter(v=>v.status==='Pending').length}</div></div>
        <div class="stat-card"><div class="stat-card-label">Approved</div><div class="stat-card-value">${violations.filter(v=>v.status==='Approved').length}</div></div>
        <div class="stat-card"><div class="stat-card-label">Paid</div><div class="stat-card-value">${violations.filter(v=>v.status==='Paid').length}</div></div>
      </div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>Violator</th><th>Plate</th><th>Violation</th><th>Date</th><th>Status</th><th>Penalty</th></tr></thead>
        <tbody>${violations.map(v=>`
          <tr>
            <td>${v.id}</td><td>${v.violatorName}</td><td>${v.plateNumber}</td>
            <td>${v.violationType}</td><td>${v.date}</td>
            <td>${statusBadge(v.status)}</td>
            <td style="font-weight:600;">${formatPeso(v.penalty)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  } else if (type === 'byType') {
    const typeCounts = {};
    violations.forEach(v => {
      if (!typeCounts[v.violationType]) typeCounts[v.violationType] = { count: 0, total: 0 };
      typeCounts[v.violationType].count++;
      typeCounts[v.violationType].total += parseFloat(v.penalty) || 0;
    });
    html = `
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:700;">Violations by Type Report</h3>
      <p style="color:var(--text-light);font-size:13px;margin-bottom:20px;">Period: ${periodLabel}</p>
      <table class="data-table">
        <thead><tr><th>Violation Type</th><th>Count</th><th>Total Penalty</th></tr></thead>
        <tbody>${Object.entries(typeCounts).sort((a,b)=>b[1].count-a[1].count).map(([type,data])=>`
          <tr><td style="font-weight:600;">${type}</td><td>${data.count}</td><td>${formatPeso(data.total)}</td></tr>
        `).join('')}</tbody>
      </table>
    `;
  } else if (type === 'enforcer') {
    const enforcerCounts = {};
    violations.forEach(v => {
      const key = v.enforcerName || v.enforcer;
      if (!enforcerCounts[key]) enforcerCounts[key] = { count: 0, total: 0 };
      enforcerCounts[key].count++;
      enforcerCounts[key].total += parseFloat(v.penalty) || 0;
    });
    html = `
      <h3 style="margin-bottom:16px;font-size:18px;font-weight:700;">Enforcer Activity Report</h3>
      <p style="color:var(--text-light);font-size:13px;margin-bottom:20px;">Period: ${periodLabel}</p>
      <table class="data-table">
        <thead><tr><th>Enforcer</th><th>Tickets Issued</th><th>Total Collections</th></tr></thead>
        <tbody>${Object.entries(enforcerCounts).sort((a,b)=>b[1].count-a[1].count).map(([name,data])=>`
          <tr><td style="font-weight:600;">${name}</td><td>${data.count}</td><td>${formatPeso(data.total)}</td></tr>
        `).join('')}</tbody>
      </table>
    `;
  }

  document.getElementById('reportContent').innerHTML = html;
  document.getElementById('reportOutput').style.display = 'block';
  document.getElementById('reportPlaceholder').style.display = 'none';
}

function printReport() {
  const content = document.getElementById('reportContent').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>TMEO Report</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#f0f2f5;}</style>
    </head><body><h2>Traffic Enforcement Management System - Lucena City</h2>${content}</body></html>
  `);
  w.print();
}

/* ============================================================
   USER MANAGEMENT
   ============================================================ */
function loadUsers() {
  const users = Storage.getUsers();
  const admins   = users.filter(u => u.role === 'Admin').length;
  const staff    = users.filter(u => u.role === 'Staff').length;
  const enforcers= users.filter(u => u.role === 'Enforcer').length;

  document.getElementById('userStats').innerHTML = `
    ${statCard('Total Users',       users.length, '👤', 'icon-blue')}
    ${statCard('Total Enforcers',   enforcers,    '👮', 'icon-green')}
    ${statCard('Assessment Staff',  staff,        '📋', 'icon-yellow')}
    ${statCard('Administrators',    admins,       '⚙️',  'icon-purple')}
  `;

  filterUsers();
}

function filterUsers() {
  const search = document.getElementById('userSearch')?.value.toLowerCase() || '';
  const role   = document.getElementById('userRoleFilter')?.value || '';
  let users = Storage.getUsers();
  if (search) users = users.filter(u =>
    u.name.toLowerCase().includes(search) ||
    u.email?.toLowerCase().includes(search) ||
    u.phone?.includes(search)
  );
  if (role) users = users.filter(u => u.role === role);
  renderUsersTable(users);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-light);">No users found.</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-weight:600;">${u.name}</td>
      <td>${u.email || '—'}</td>
      <td>${u.phone || '—'}</td>
      <td><span class="badge ${u.role==='Admin'?'badge-info':u.role==='Staff'?'badge-warning':'badge-success'}">${u.role}</span></td>
      <td>${u.badgeNumber || '—'}</td>
      <td>${statusBadge(u.status)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editUser('${u.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUserById('${u.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddUserModal() {
  editingUserId = null;
  document.getElementById('userModalTitle').textContent = 'Add User';
  clearUserModal();
  document.getElementById('modalUserId').disabled = false;
  openModal('userModal');
}

function editUser(id) {
  const user = Storage.getUserById(id);
  if (!user) return;
  editingUserId = id;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('modalUserName').value = user.name;
  document.getElementById('modalUserId').value   = user.id;
  document.getElementById('modalUserId').disabled = true;
  document.getElementById('modalUserEmail').value  = user.email || '';
  document.getElementById('modalUserPhone').value  = user.phone || '';
  document.getElementById('modalUserRole').value   = user.role;
  document.getElementById('modalUserPassword').value = '';
  document.getElementById('modalUserStatus').value = user.status;
  openModal('userModal');
}

function saveUser() {
  const name     = document.getElementById('modalUserName').value.trim();
  const id       = document.getElementById('modalUserId').value.trim();
  const email    = document.getElementById('modalUserEmail').value.trim();
  const phone    = document.getElementById('modalUserPhone').value.trim();
  const role     = document.getElementById('modalUserRole').value;
  const password = document.getElementById('modalUserPassword').value;
  const status   = document.getElementById('modalUserStatus').value;

  if (!name || !id) { showToast('Name and ID are required.', 'error'); return; }

  if (editingUserId) {
    const existing = Storage.getUserById(editingUserId);
    const updated = {
      ...existing,
      name, email, phone, role, status,
      password: password || existing.password
    };
    Storage.updateUser(updated);
    showToast('User updated!', 'success');
  } else {
    if (Storage.getUserById(id)) { showToast('ID already exists.', 'error'); return; }
    Storage.addUser({
      id, name, email, phone, role, status,
      password: password || '123456',
      badgeNumber: generateBadge(role),
      createdAt: new Date().toISOString()
    });
    showToast('User added!', 'success');
  }
  closeModal('userModal');
  loadUsers();
  loadEnforcers();
}

function deleteUserById(id) {
  if (id === currentSession?.id) { showToast('Cannot delete your own account!', 'error'); return; }
  if (!confirm('Delete this user?')) return;
  Storage.deleteUser(id);
  loadUsers();
  loadEnforcers();
  showToast('User deleted.', 'info');
}

function clearUserModal() {
  ['modalUserName','modalUserId','modalUserEmail','modalUserPhone','modalUserPassword'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('modalUserRole').value   = 'Enforcer';
  document.getElementById('modalUserStatus').value = 'Active';
}

/* ============================================================
   RECEIPT PRINTER
   ============================================================ */
function printReceipt(v) {
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>E-Receipt – ${v.id}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 32px; max-width: 600px; margin: auto; }
        .header { text-align: center; border-bottom: 2px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 20px; }
        .logo-circle { width: 70px; height: 70px; background: #FFB800; border-radius: 50%; margin: auto 0 10px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
        h1 { font-size: 16px; font-weight: 700; color: #1a1a2e; }
        h2 { font-size: 14px; color: #444; margin-top: 4px; }
        .receipt-id { font-size: 20px; font-weight: 800; color: #2d4a8a; margin: 10px 0; }
        .field-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        .field-label { color: #666; font-weight: 600; }
        .field-value { font-weight: 700; text-align: right; }
        .penalty-row { background: #fff8e1; padding: 12px 0; border-radius: 6px; text-align: center; margin: 16px 0; }
        .penalty-amount { font-size: 28px; font-weight: 900; color: #d97706; }
        .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #999; border-top: 1px dashed #ccc; padding-top: 16px; }
        @media print { body { padding: 16px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-circle">🚦</div>
        <h1>Traffic Management & Enforcement Office</h1>
        <h2>Lucena City — Official E-Receipt</h2>
        <div class="receipt-id">${v.id}</div>
      </div>

      <div class="field-row"><span class="field-label">Violator Name</span><span class="field-value">${v.violatorName}</span></div>
      <div class="field-row"><span class="field-label">License Number</span><span class="field-value">${v.licenseNo}</span></div>
      <div class="field-row"><span class="field-label">Plate Number</span><span class="field-value">${v.plateNumber}</span></div>
      <div class="field-row"><span class="field-label">Vehicle Type</span><span class="field-value">${v.vehicleType}</span></div>
      <div class="field-row"><span class="field-label">Violation</span><span class="field-value">${v.violationType}</span></div>
      <div class="field-row"><span class="field-label">Date & Time</span><span class="field-value">${v.date} ${v.time}</span></div>
      <div class="field-row"><span class="field-label">Location</span><span class="field-value">${v.location}</span></div>
      <div class="field-row"><span class="field-label">Enforcer</span><span class="field-value">${v.enforcerName || v.enforcer}</span></div>
      <div class="field-row"><span class="field-label">Status</span><span class="field-value">${v.status}</span></div>

      <div class="penalty-row">
        <div style="font-size:12px;color:#888;margin-bottom:4px;">PENALTY AMOUNT</div>
        <div class="penalty-amount">₱${parseFloat(v.penalty||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
      </div>

      <div class="footer">
        This is an official receipt of the Traffic Management and Enforcement Office, Lucena City.<br/>
        Date Issued: ${new Date().toLocaleDateString('en-PH')} | TMEO E-Receipt System
      </div>

      <script>window.print();</script>
    </body>
    </html>
  `);
  w.document.close();
}

/* ============================================================
   UTILITIES
   ============================================================ */
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   CHANGE 2: Admin GPS Map — read enforcer locations from
   tmeo_gps_log (written by enforcer "Send Location" button)
   ============================================================ */
function adminRefreshGPS() {
  const tbody = document.getElementById('adminGPSBody');
  if (!tbody) return;

  const log = JSON.parse(localStorage.getItem('tmeo_gps_log') || '[]');

  if (log.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px 16px;">No GPS data yet — enforcers must tap "Send My Location" from their dashboard.</td></tr>';
    return;
  }

  // Update stats
  const activeEl = document.getElementById('gpsActive');
  if (activeEl) activeEl.textContent = log.length;
  const totalEl = document.getElementById('gpsTotal');
  const users = Storage.getUsers();
  const enforcerCount = users.filter(u => u.role === 'Enforcer').length;
  if (totalEl) totalEl.textContent = enforcerCount;

  tbody.innerHTML = log.map(entry => {
    const ts = entry.timestamp ? new Date(entry.timestamp) : null;
    const ageMs = ts ? Date.now() - ts.getTime() : Infinity;
    const isRecent = ageMs < 15 * 60 * 1000; // within 15 min = active
    const timeStr = ts ? ts.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' }) + ' ' +
                         ts.toLocaleDateString('en-PH', { month:'short', day:'numeric' }) : '—';
    const statusBadge = isRecent
      ? '<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">● Active</span>'
      : '<span style="background:#f1f5f9;color:#94a3b8;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Offline</span>';

    return `<tr>
      <td><strong>${entry.enforcerName || '—'}</strong><br/><span style="font-size:11px;color:#94a3b8;">${entry.enforcerId || ''}</span></td>
      <td style="font-family:monospace;">${entry.lat}</td>
      <td style="font-family:monospace;">${entry.lng}</td>
      <td>${entry.accuracy || '—'}</td>
      <td>${timeStr}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');

  // Update map to show first enforcer's location
  const first = log[log.length - 1];
  const mapFrame = document.getElementById('adminMapFrame');
  if (mapFrame && first) {
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lng);
    const d   = 0.03;
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-d},${lat-d},${lng+d},${lat+d}&layer=mapnik&marker=${lat},${lng}`;
  }
}

// Auto-refresh GPS when the GPS page is shown
const _origShowPage = window.showPage;
window.showPage = function(page) {
  if (_origShowPage) _origShowPage(page);
  if (page === 'gps-tracking') {
    adminRefreshGPS();
  }
};
