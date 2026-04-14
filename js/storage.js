/* ==============================================
   storage.js — localStorage Helper Functions
   All data is stored/retrieved through these
   ============================================== */

const Storage = {

  // ===== USERS =====
  getUsers() {
    return JSON.parse(localStorage.getItem('tmeo_users') || '[]');
  },
  saveUsers(users) {
    localStorage.setItem('tmeo_users', JSON.stringify(users));
  },
  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },
  getUserById(id) {
    return this.getUsers().find(u => u.id === id);
  },
  updateUser(updatedUser) {
    const users = this.getUsers().map(u =>
      u.id === updatedUser.id ? updatedUser : u
    );
    this.saveUsers(users);
  },
  deleteUser(id) {
    const users = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(users);
  },

  // ===== SESSION (logged-in user) =====
  setSession(user) {
    localStorage.setItem('tmeo_session', JSON.stringify(user));
  },
  getSession() {
    return JSON.parse(localStorage.getItem('tmeo_session') || 'null');
  },
  clearSession() {
    localStorage.removeItem('tmeo_session');
  },

  // ===== VIOLATIONS =====
  getViolations() {
    return JSON.parse(localStorage.getItem('tmeo_violations') || '[]');
  },
  saveViolations(violations) {
    localStorage.setItem('tmeo_violations', JSON.stringify(violations));
  },
  addViolation(violation) {
    const violations = this.getViolations();
    violations.push(violation);
    this.saveViolations(violations);
    return violation;
  },
  getViolationById(id) {
    return this.getViolations().find(v => v.id === id);
  },
  updateViolation(updated) {
    const violations = this.getViolations().map(v =>
      v.id === updated.id ? updated : v
    );
    this.saveViolations(violations);
  },
  deleteViolation(id) {
    const violations = this.getViolations().filter(v => v.id !== id);
    this.saveViolations(violations);
  },

  // ===== VIOLATION TYPES =====
  getViolationTypes() {
    return JSON.parse(localStorage.getItem('tmeo_violation_types') || '[]');
  },
  saveViolationTypes(types) {
    localStorage.setItem('tmeo_violation_types', JSON.stringify(types));
  },
  addViolationType(type) {
    const types = this.getViolationTypes();
    types.push(type);
    this.saveViolationTypes(types);
  },
  updateViolationType(updated) {
    const types = this.getViolationTypes().map(t =>
      t.code === updated.code ? updated : t
    );
    this.saveViolationTypes(types);
  },
  deleteViolationType(code) {
    const types = this.getViolationTypes().filter(t => t.code !== code);
    this.saveViolationTypes(types);
  },

  // ===== CAPTURES (photos from camera) =====
  getCaptures() {
    return JSON.parse(localStorage.getItem('tmeo_captures') || '[]');
  },
  addCapture(capture) {
    const captures = this.getCaptures();
    captures.push(capture);
    localStorage.setItem('tmeo_captures', JSON.stringify(captures));
  },

  // ===== COUNTER (auto-increment IDs) =====
  getNextId(key) {
    const current = parseInt(localStorage.getItem(`tmeo_counter_${key}`) || '0');
    const next = current + 1;
    localStorage.setItem(`tmeo_counter_${key}`, next.toString());
    return next;
  },

  // ===== CLEAR ALL (for dev/reset) =====
  clearAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('tmeo_'));
    keys.forEach(k => localStorage.removeItem(k));
  }
};

/* ==============================================
   Seed default accounts for testing
   ============================================== */
function seedDefaultAccounts() {
  const users = Storage.getUsers();

  // Only seed if no users exist yet
  if (users.length === 0) {
    const defaultUsers = [
      {
        id: 'ADMIN-001',
        name: 'System Administrator',
        email: 'admin@tmeo.gov.ph',
        phone: '09000000001',
        role: 'Admin',
        password: 'admin123',
        badgeNumber: 'ADM-001',
        status: 'Active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'STAFF-001',
        name: 'Maria Santos',
        email: 'staff@tmeo.gov.ph',
        phone: '09000000002',
        role: 'Staff',
        password: 'staff123',
        badgeNumber: 'STF-001',
        status: 'Active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ENF-001',
        name: 'Juan dela Cruz',
        email: 'enforcer@tmeo.gov.ph',
        phone: '09000000003',
        role: 'Enforcer',
        password: 'enforcer123',
        badgeNumber: 'TE-001',
        status: 'Active',
        createdAt: new Date().toISOString()
      }
    ];
    Storage.saveUsers(defaultUsers);
  }

  // Seed violation types if empty
  if (Storage.getViolationTypes().length === 0) {
    const defaultTypes = [
      { code: 'VT-001', name: 'No Helmet',           category: 'Safety',  penalty: 500,  description: 'Riding without helmet' },
      { code: 'VT-002', name: 'Illegal Parking',      category: 'Traffic', penalty: 1000, description: 'Parking in prohibited areas' },
      { code: 'VT-003', name: 'Beating Red Light',    category: 'Traffic', penalty: 1500, description: 'Disobeying traffic signals' },
      { code: 'VT-004', name: 'Illegal Overtaking',   category: 'Traffic', penalty: 1000, description: 'Overtaking in no-overtaking zones' },
      { code: 'VT-005', name: 'Obstruction',          category: 'Traffic', penalty: 1000, description: 'Blocking traffic flow' },
      { code: 'VT-006', name: 'Speeding',             category: 'Safety',  penalty: 2000, description: 'Exceeding speed limit' },
      { code: 'VT-007', name: 'No Seatbelt',          category: 'Safety',  penalty: 500,  description: 'Not wearing seatbelt' },
      { code: 'VT-008', name: 'Colorum',              category: 'Traffic', penalty: 5000, description: 'Operating without franchise' },
      { code: 'VT-009', name: 'Drunk Driving',        category: 'Safety',  penalty: 5000, description: 'Driving under influence of alcohol' },
      { code: 'VT-010', name: 'Overloading',          category: 'Safety',  penalty: 2000, description: 'Vehicle passenger/cargo overloading' }
    ];
    Storage.saveViolationTypes(defaultTypes);
  }

  // Seed sample violations if empty
  if (Storage.getViolations().length === 0) {
    const sampleViolations = [
      {
        id: 'VL-001234',
        violatorName: 'Juan Dela Cruz',
        licenseNo: '23456789',
        plateNumber: 'ABC 1234',
        vehicleType: 'Motorcycle',
        violationType: 'No Helmet',
        violationCode: 'VT-001',
        penalty: 500,
        date: '2026-03-09',
        time: '08:30',
        location: 'Pacific Mall Area',
        enforcer: 'ENF-001',
        enforcerName: 'Juan dela Cruz',
        status: 'Pending',
        notes: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'VL-001235',
        violatorName: 'Maria Clara Santos',
        licenseNo: '3456789',
        plateNumber: 'XYZ 5678',
        vehicleType: 'Sedan',
        violationType: 'Illegal Parking',
        violationCode: 'VT-002',
        penalty: 1000,
        date: '2026-03-09',
        time: '10:50',
        location: 'Quezon Avenue Market',
        enforcer: 'ENF-001',
        enforcerName: 'Juan dela Cruz',
        status: 'Approved',
        notes: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'VL-001236',
        violatorName: 'Pedro Martinez',
        licenseNo: '4567890',
        plateNumber: 'DEF 9012',
        vehicleType: 'Tricycle',
        violationType: 'Obstruction',
        violationCode: 'VT-005',
        penalty: 1000,
        date: '2026-03-09',
        time: '11:15',
        location: 'Maharlika Highway',
        enforcer: 'ENF-001',
        enforcerName: 'Juan dela Cruz',
        status: 'Pending',
        notes: '',
        createdAt: new Date().toISOString()
      }
    ];
    Storage.saveViolations(sampleViolations);
  }
}

/* Helper: Format date */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* Helper: Format currency */
function formatPeso(amount) {
  return '₱' + parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

/* Helper: Generate violation ID */
function generateViolationId() {
  const num = Storage.getNextId('violation');
  return 'VL-' + String(num + 1239).padStart(6, '0');
}

/* Helper: Get today's date string YYYY-MM-DD */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/* Helper: Get current time HH:MM */
function currentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
}
