/* ==============================================
   auth.js — Login, Register, Logout Logic
   ============================================== */

/* ===== HANDLE LOGIN ===== */
function handleLogin() {
  // Get selected role
  const roleInputs = document.querySelectorAll('input[name="loginRole"]');
  let selectedRole = 'Admin';
  roleInputs.forEach(r => { if (r.checked) selectedRole = r.value; });

  const idNumber  = document.getElementById('loginId').value.trim();
  const password  = document.getElementById('loginPassword').value.trim();
  const errorEl   = document.getElementById('loginError');

  // Validation
  if (!idNumber || !password) {
    showAuthError(errorEl, 'Please enter your ID Number and Password.');
    return;
  }

  // Find user in localStorage
  const users = Storage.getUsers();
  const user = users.find(u =>
    u.id === idNumber &&
    u.password === password &&
    u.role === selectedRole
  );

  if (!user) {
    showAuthError(errorEl, 'Invalid ID Number, Password, or Role. Please try again.');
    return;
  }

  if (user.status === 'Inactive') {
    showAuthError(errorEl, 'Your account is inactive. Please contact the administrator.');
    return;
  }

  // Save session
  Storage.setSession(user);

  // Redirect based on role
  if (user.role === 'Admin')    window.location.href = 'admin.html';
  else if (user.role === 'Staff')    window.location.href = 'staff.html';
  else if (user.role === 'Enforcer') window.location.href = 'enforcer.html';
}

/* ===== HANDLE REGISTER ===== */
function handleRegister() {
  const roleInputs = document.querySelectorAll('input[name="registerRole"]');
  let selectedRole = 'Admin';
  roleInputs.forEach(r => { if (r.checked) selectedRole = r.value; });

  const idNumber  = document.getElementById('regId').value.trim();
  const fullName  = document.getElementById('regName').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const phone     = document.getElementById('regPhone').value.trim();
  const password  = document.getElementById('regPassword').value;
  const confirm   = document.getElementById('regConfirm').value;
  const errorEl   = document.getElementById('registerError');
  const successEl = document.getElementById('registerSuccess');

  // Hide previous messages
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  // Validation
  if (!idNumber || !fullName || !email || !phone || !password || !confirm) {
    showAuthError(errorEl, 'Please fill in all fields.');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthError(errorEl, 'Please enter a valid email address.');
    return;
  }

  if (password.length < 6) {
    showAuthError(errorEl, 'Password must be at least 6 characters.');
    return;
  }

  if (password !== confirm) {
    showAuthError(errorEl, 'Passwords do not match.');
    return;
  }

  // Check if ID already exists
  const existing = Storage.getUserById(idNumber);
  if (existing) {
    showAuthError(errorEl, 'An account with this ID Number already exists.');
    return;
  }

  // Create user object
  const newUser = {
    id: idNumber,
    name: fullName,
    email: email,
    phone: phone,
    role: selectedRole,
    password: password,
    badgeNumber: generateBadge(selectedRole),
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  Storage.addUser(newUser);

  // Show success
  successEl.textContent = 'Account created successfully! Redirecting to login...';
  successEl.style.display = 'block';

  setTimeout(() => {
    window.location.href = 'login.html';
  }, 2000);
}

/* ===== HANDLE LOGOUT ===== */
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    Storage.clearSession();
    window.location.href = 'login.html';
  }
}

/* ===== REQUIRE AUTH (call on dashboard pages) ===== */
function requireAuth(expectedRole) {
  const session = Storage.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  if (expectedRole && session.role !== expectedRole) {
    // Wrong role — redirect to their correct page
    if (session.role === 'Admin')    window.location.href = 'admin.html';
    else if (session.role === 'Staff')    window.location.href = 'staff.html';
    else if (session.role === 'Enforcer') window.location.href = 'enforcer.html';
    return null;
  }

  return session;
}

/* ===== POPULATE USER INFO in Topbar ===== */
function populateTopbarUser(session) {
  const nameEl   = document.getElementById('topbarUserName');
  const dateEl   = document.getElementById('topbarUserDate');
  const avatarEl = document.getElementById('topbarAvatar');

  if (nameEl)   nameEl.textContent   = session.name;
  if (dateEl)   dateEl.textContent   = formatFullDate();
  if (avatarEl) avatarEl.textContent = getInitials(session.name);
}

/* ===== HELPERS ===== */
function showAuthError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function generateBadge(role) {
  const prefix = role === 'Admin' ? 'ADM' : role === 'Staff' ? 'STF' : 'TE';
  const num = String(Math.floor(Math.random() * 900) + 100);
  return prefix + '-' + num;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function formatFullDate() {
  return new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* ===== Allow Enter key to submit login ===== */
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
  }
});
