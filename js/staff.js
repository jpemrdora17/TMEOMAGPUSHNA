/* staff.js — Staff Dashboard Logic */
let currentSession = null;

document.addEventListener('DOMContentLoaded', () => {
  currentSession = requireAuth('Staff');
  if (!currentSession) return;
  populateTopbarUser(currentSession);
  showPage('dashboard');
  seedDefaultAccounts();
});

function showPage(pageId) {
  document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.style.display = 'block';
  const navItem = document.querySelector(`[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');
  switch (pageId) {
    case 'dashboard':  loadStaffDashboard(); break;
    case 'encode':     initEncodeForm();     break;
    case 'violations': loadStaffViolations();break;
    case 'receipts':   loadReceipts();       break;
  }
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

function loadStaffDashboard() {
  const violations = Storage.getViolations();
  const today = todayStr();
  const mine  = violations.filter(v => v.encodedBy === currentSession.id);

  document.getElementById('staffStats').innerHTML = `
    <div class="stat-card"><div class="stat-card-top"><div><div class="stat-card-label">Total Violations (All)</div></div><div class="stat-card-icon icon-blue">📋</div></div><div class="stat-card-value">${violations.length}</div></div>
    <div class="stat-card"><div class="stat-card-top"><div><div class="stat-card-label">Encoded Today</div></div><div class="stat-card-icon icon-red">📝</div></div><div class="stat-card-value">${violations.filter(v=>v.date===today).length}</div></div>
    <div class="stat-card"><div class="stat-card-top"><div><div class="stat-card-label">Pending</div></div><div class="stat-card-icon icon-yellow">⏳</div></div><div class="stat-card-value">${violations.filter(v=>v.status==='Pending').length}</div></div>
    <div class="stat-card"><div class="stat-card-top"><div><div class="stat-card-label">Paid</div></div><div class="stat-card-icon icon-green">✅</div></div><div class="stat-card-value">${violations.filter(v=>v.status==='Paid').length}</div></div>
  `;

  const recent = violations.filter(v => v.date === today).reverse().slice(0, 10);
  const tbody  = document.getElementById('staffRecentBody');
  tbody.innerHTML = recent.length ? recent.map(v => `
    <tr>
      <td style="font-weight:600;color:var(--primary);">${v.id}</td>
      <td>${v.violatorName}</td>
      <td>${v.plateNumber}</td>
      <td>${v.violationType}</td>
      <td>${v.date}</td>
      <td><span class="badge ${v.status==='Pending'?'badge-warning':v.status==='Paid'?'badge-success':'badge-info'}">${v.status}</span></td>
      <td><button class="btn btn-primary btn-sm" onclick="printViolationReceipt('${v.id}')">🖨 Receipt</button></td>
    </tr>
  `).join('') : `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-light);">No violations today.</td></tr>`;
}

function initEncodeForm() {
  // Populate violation types
  const types = Storage.getViolationTypes();
  const typeEl = document.getElementById('evType');
  typeEl.innerHTML = types.map(t => `<option value="${t.name}" data-penalty="${t.penalty}">${t.name} – ₱${t.penalty}</option>`).join('');
  autoFillPenalty();

  // Populate enforcers
  const enforcers = Storage.getUsers().filter(u => u.role === 'Enforcer');
  document.getElementById('evEnforcer').innerHTML =
    enforcers.map(e => `<option value="${e.id}">${e.name} (${e.badgeNumber})</option>`).join('');

  // Default date/time
  document.getElementById('evDate').value = todayStr();
  document.getElementById('evTime').value = currentTime();
}

function autoFillPenalty() {
  const typeEl = document.getElementById('evType');
  if (!typeEl) return;
  const selected = typeEl.selectedOptions[0];
  const penalty  = selected?.dataset.penalty || '';
  document.getElementById('evPenalty').value = penalty;
}

function encodeViolation() {
  const name    = document.getElementById('evName').value.trim();
  const license = document.getElementById('evLicense').value.trim();
  const plate   = document.getElementById('evPlate').value.trim();
  const vehicle = document.getElementById('evVehicle').value;
  const type    = document.getElementById('evType').value;
  const penalty = parseFloat(document.getElementById('evPenalty').value) || 0;
  const date    = document.getElementById('evDate').value;
  const time    = document.getElementById('evTime').value;
  const location= document.getElementById('evLocation').value.trim();
  const enforcer= document.getElementById('evEnforcer').value;
  const notes   = document.getElementById('evNotes').value.trim();
  const errorEl = document.getElementById('encodeError');

  errorEl.style.display = 'none';

  if (!name || !license || !plate || !date || !location) {
    errorEl.textContent = 'Please fill in all required fields (*).';
    errorEl.style.display = 'block';
    return;
  }

  const enforcerUser = Storage.getUserById(enforcer);
  const violation = {
    id: generateViolationId(),
    violatorName: name,
    licenseNo: license,
    plateNumber: plate,
    vehicleType: vehicle,
    violationType: type,
    penalty,
    date, time, location,
    enforcer: enforcer,
    enforcerName: enforcerUser?.name || enforcer,
    notes,
    status: 'Pending',
    encodedBy: currentSession.id,
    createdAt: new Date().toISOString()
  };

  Storage.addViolation(violation);
  showToast('Violation encoded successfully!', 'success');
  clearEncodeForm();

  // Simulate SMS/Email notification
  console.log('[SMS SIMULATION] Sent to:', enforcerUser?.phone || 'Unknown');
  console.log('[EMAIL SIMULATION] Sent to:', enforcerUser?.email || 'Unknown');
  alert(`✅ Violation encoded!\n\n📱 SMS Notification sent (simulated) to Enforcer: ${enforcerUser?.name || 'Unknown'}\n📧 Email sent (simulated) to: ${enforcerUser?.email || 'N/A'}`);
}

function clearEncodeForm() {
  ['evName','evLicense','evPlate','evNotes','evLocation'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('evDate').value = todayStr();
  document.getElementById('evTime').value = currentTime();
  document.getElementById('encodeError').style.display = 'none';
  autoFillPenalty();
}

function loadStaffViolations() {
  const search = document.getElementById('staffViolationSearch')?.value.toLowerCase() || '';
  let violations = Storage.getViolations();
  if (search) violations = violations.filter(v =>
    v.violatorName?.toLowerCase().includes(search) ||
    v.plateNumber?.toLowerCase().includes(search) ||
    v.id?.toLowerCase().includes(search)
  );

  const tbody = document.getElementById('staffViolationsBody');
  tbody.innerHTML = violations.length ? violations.reverse().map(v => `
    <tr>
      <td style="font-weight:600;color:var(--primary);">${v.id}</td>
      <td>${v.violatorName}</td>
      <td>${v.plateNumber}</td>
      <td>${v.violationType}</td>
      <td style="font-weight:700;color:var(--danger);">${formatPeso(v.penalty)}</td>
      <td>${v.date}</td>
      <td><span class="badge ${v.status==='Pending'?'badge-warning':v.status==='Paid'?'badge-success':'badge-info'}">${v.status}</span></td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="printViolationReceipt('${v.id}')">🖨 Receipt</button>
        <button class="btn btn-outline btn-sm" onclick="markPaid('${v.id}')">Mark Paid</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-light);">No violations found.</td></tr>`;
}

function loadReceipts() {
  const violations = Storage.getViolations();
  const tbody = document.getElementById('receiptsBody');
  tbody.innerHTML = violations.length ? violations.reverse().map(v => `
    <tr>
      <td style="font-weight:600;color:var(--primary);">${v.id}</td>
      <td>${v.violatorName}</td>
      <td>${v.violationType}</td>
      <td style="font-weight:700;color:var(--danger);">${formatPeso(v.penalty)}</td>
      <td>${v.date}</td>
      <td><span class="badge ${v.status==='Pending'?'badge-warning':v.status==='Paid'?'badge-success':'badge-info'}">${v.status}</span></td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="printViolationReceipt('${v.id}')">🖨 Print</button>
        <button class="btn btn-outline btn-sm" onclick="sendSMS('${v.id}')">📱 SMS</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-light);">No receipts yet.</td></tr>`;
}

function markPaid(id) {
  const v = Storage.getViolationById(id);
  if (!v) return;
  v.status = 'Paid';
  Storage.updateViolation(v);
  loadStaffViolations();
  showToast('Marked as Paid!', 'success');
}

function sendSMS(id) {
  const v = Storage.getViolationById(id);
  if (!v) return;
  console.log(`[SMS SIMULATION] Violation ${v.id} receipt sent to violator`);
  alert(`📱 SMS Notification Sent (Simulated)\n\nTo: ${v.violatorName}\nViolation: ${v.violationType}\nPenalty: ${formatPeso(v.penalty)}\nDate: ${v.date}\n\nNote: Please pay at TMEO Office, Lucena City.`);
  showToast('SMS sent (simulated)!', 'success');
}

function printViolationReceipt(id) {
  const v = Storage.getViolationById(id);
  if (!v) return;
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html><html><head><title>E-Receipt ${v.id}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:32px;max-width:600px;margin:auto;}.header{text-align:center;border-bottom:2px solid #1a1a2e;padding-bottom:16px;margin-bottom:20px;}h1{font-size:16px;font-weight:700;color:#1a1a2e;}h2{font-size:13px;color:#555;margin-top:4px;}.receipt-id{font-size:20px;font-weight:900;color:#2d4a8a;margin:10px 0;}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;}.label{color:#666;font-weight:600;}.val{font-weight:700;}.penalty{background:#fff8e1;padding:16px;border-radius:8px;text-align:center;margin:16px 0;}.p-amount{font-size:28px;font-weight:900;color:#d97706;}.footer{text-align:center;margin-top:24px;font-size:11px;color:#aaa;border-top:1px dashed #ddd;padding-top:16px;}</style>
    </head><body>
    <div class="header">
      <div style="font-size:40px;margin-bottom:8px;">🚦</div>
      <h1>Traffic Management & Enforcement Office</h1>
      <h2>Lucena City — Official E-Receipt</h2>
      <div class="receipt-id">${v.id}</div>
    </div>
    <div class="row"><span class="label">Violator Name</span><span class="val">${v.violatorName}</span></div>
    <div class="row"><span class="label">License No.</span><span class="val">${v.licenseNo}</span></div>
    <div class="row"><span class="label">Plate Number</span><span class="val">${v.plateNumber}</span></div>
    <div class="row"><span class="label">Vehicle Type</span><span class="val">${v.vehicleType}</span></div>
    <div class="row"><span class="label">Violation</span><span class="val">${v.violationType}</span></div>
    <div class="row"><span class="label">Date & Time</span><span class="val">${v.date} ${v.time}</span></div>
    <div class="row"><span class="label">Location</span><span class="val">${v.location}</span></div>
    <div class="row"><span class="label">Enforcer</span><span class="val">${v.enforcerName||v.enforcer}</span></div>
    <div class="row"><span class="label">Status</span><span class="val">${v.status}</span></div>
    <div class="penalty">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">PENALTY AMOUNT</div>
      <div class="p-amount">₱${parseFloat(v.penalty||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
    </div>
    <div class="footer">Official receipt of TMEO Lucena City<br/>Issued: ${new Date().toLocaleDateString('en-PH')}</div>
    <script>window.print();<\/script>
    </body></html>
  `);
  w.document.close();
}

function showToast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
