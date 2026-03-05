const API = "/.netlify/functions";
let token = localStorage.getItem("dashboard_token");
let customers = [];

// --- Auth ---

function showDashboard() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  loadCustomers();
}

function showLogin() {
  document.getElementById("login-screen").hidden = false;
  document.getElementById("dashboard").hidden = true;
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;

  try {
    const res = await fetch(`${API}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (res.ok) {
      token = data.token;
      localStorage.setItem("dashboard_token", token);
      showDashboard();
    } else {
      errorEl.textContent = data.error || "Login failed";
      errorEl.hidden = false;
    }
  } catch {
    errorEl.textContent = "Connection error";
    errorEl.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  token = null;
  localStorage.removeItem("dashboard_token");
  showLogin();
});

// --- API helpers ---

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${API}/${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });

  if (res.status === 401) {
    token = null;
    localStorage.removeItem("dashboard_token");
    showLogin();
    return null;
  }

  return res.json();
}

// --- Tabs ---

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => {
      c.hidden = true;
      c.classList.remove("active");
    });
    tab.classList.add("active");
    const section = document.getElementById(`tab-${tab.dataset.tab}`);
    section.hidden = false;
    section.classList.add("active");

    if (tab.dataset.tab === "send") loadRecipients();
    if (tab.dataset.tab === "transcriptions") loadTranscriptions();
  });
});

// --- Customers ---

async function loadCustomers() {
  const list = document.getElementById("customers-list");
  list.innerHTML = '<p class="loading">Loading customers...</p>';

  const data = await api("get-customers");
  if (!data) return;

  customers = data;
  renderCustomers();
}

function renderCustomers() {
  const list = document.getElementById("customers-list");

  if (customers.length === 0) {
    list.innerHTML = '<p class="empty">No customers yet. Add your first one above.</p>';
    return;
  }

  list.innerHTML = customers
    .map(
      (c) => `
    <div class="card" data-id="${c.id}">
      <div class="card-info">
        <div class="name">${esc(c.name)}</div>
        <div class="phone">${esc(c.phone)}</div>
      </div>
      <div class="card-actions">
        <button class="btn-small" onclick="editCustomer('${c.id}')">Edit</button>
        <button class="btn-small" onclick="sendToCustomer('${c.phone}')">Message</button>
        <button class="btn-small" onclick="viewTranscriptions('${c.phone}')">Transcriptions</button>
        <button class="btn-danger" onclick="deleteCustomer('${c.id}', '${esc(c.name)}')">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

// Add customer
document.getElementById("add-customer-btn").addEventListener("click", () => {
  document.getElementById("add-customer-form").hidden = false;
  document.getElementById("new-customer-name").focus();
});

document.getElementById("cancel-customer-btn").addEventListener("click", () => {
  document.getElementById("add-customer-form").hidden = true;
  document.getElementById("new-customer-name").value = "";
  document.getElementById("new-customer-phone").value = "";
});

document.getElementById("save-customer-btn").addEventListener("click", async () => {
  const name = document.getElementById("new-customer-name").value.trim();
  const phone = document.getElementById("new-customer-phone").value.trim();
  if (!name || !phone) return;

  const btn = document.getElementById("save-customer-btn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  await api("add-customer", {
    method: "POST",
    body: JSON.stringify({ name, phone }),
  });

  btn.disabled = false;
  btn.textContent = "Save";
  document.getElementById("add-customer-form").hidden = true;
  document.getElementById("new-customer-name").value = "";
  document.getElementById("new-customer-phone").value = "";
  loadCustomers();
});

// Edit customer
function editCustomer(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  document.getElementById("edit-customer-id").value = c.id;
  document.getElementById("edit-customer-name").value = c.name;
  // Show phone without whatsapp: prefix for easier editing
  document.getElementById("edit-customer-phone").value = c.phone.replace("whatsapp:", "");
  document.getElementById("edit-modal").hidden = false;
}

document.getElementById("edit-cancel-btn").addEventListener("click", () => {
  document.getElementById("edit-modal").hidden = true;
});

document.getElementById("edit-save-btn").addEventListener("click", async () => {
  const id = document.getElementById("edit-customer-id").value;
  const name = document.getElementById("edit-customer-name").value.trim();
  const phone = document.getElementById("edit-customer-phone").value.trim();
  if (!name || !phone) return;

  const btn = document.getElementById("edit-save-btn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  await api("update-customer", {
    method: "PUT",
    body: JSON.stringify({ id, name, phone }),
  });

  btn.disabled = false;
  btn.textContent = "Save";
  document.getElementById("edit-modal").hidden = true;
  loadCustomers();
});

// Delete customer
async function deleteCustomer(id, name) {
  if (!confirm(`Delete ${name}?`)) return;

  await api("delete-customer", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });

  loadCustomers();
}

// --- Send Message ---

function loadRecipients() {
  const list = document.getElementById("recipient-list");

  if (customers.length === 0) {
    list.innerHTML = '<p class="empty">No customers. Add some first.</p>';
    return;
  }

  list.innerHTML = customers
    .map(
      (c) => `
    <label>
      <input type="checkbox" class="recipient-checkbox" value="${esc(c.phone)}">
      ${esc(c.name)} <span style="color: var(--text-muted); font-size: 0.8rem;">${esc(c.phone)}</span>
    </label>
  `
    )
    .join("");
}

document.getElementById("select-all").addEventListener("change", (e) => {
  document.querySelectorAll(".recipient-checkbox").forEach((cb) => {
    cb.checked = e.target.checked;
  });
});

document.getElementById("send-btn").addEventListener("click", async () => {
  const checked = document.querySelectorAll(".recipient-checkbox:checked");
  const recipients = Array.from(checked).map((cb) => cb.value);
  const message = document.getElementById("message-text").value.trim();

  if (recipients.length === 0) return alert("Select at least one recipient.");
  if (!message) return alert("Enter a message.");

  const btn = document.getElementById("send-btn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  const data = await api("send-message", {
    method: "POST",
    body: JSON.stringify({ recipients, message }),
  });

  btn.disabled = false;
  btn.textContent = "Send Message";

  if (data && data.results) {
    const statusEl = document.getElementById("send-status");
    statusEl.hidden = false;
    statusEl.innerHTML = data.results
      .map((r) => {
        const name = customers.find((c) => c.phone === r.to)?.name || r.to;
        if (r.success) {
          return `<div class="result-success">${esc(name)} — Sent</div>`;
        }
        return `<div class="result-fail">${esc(name)} — Failed: ${esc(r.error || "Unknown error")}</div>`;
      })
      .join("");
  }
});

// Quick send from customer card
function sendToCustomer(phone) {
  // Switch to send tab
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => {
    c.hidden = true;
    c.classList.remove("active");
  });
  document.querySelector('[data-tab="send"]').classList.add("active");
  document.getElementById("tab-send").hidden = false;
  document.getElementById("tab-send").classList.add("active");

  loadRecipients();

  // Pre-check the right customer
  setTimeout(() => {
    document.querySelectorAll(".recipient-checkbox").forEach((cb) => {
      cb.checked = cb.value === phone;
    });
  }, 50);
}

// --- Transcriptions ---

async function loadTranscriptions() {
  const list = document.getElementById("transcriptions-list");
  list.innerHTML = '<p class="loading">Loading transcriptions...</p>';

  // Populate filter dropdown
  const filter = document.getElementById("filter-customer");
  const currentValue = filter.value;
  filter.innerHTML = '<option value="">All Customers</option>';
  customers.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.phone;
    opt.textContent = c.name;
    filter.appendChild(opt);
  });
  filter.value = currentValue;

  let url = "get-transcriptions";
  if (filter.value) url += `?phone=${encodeURIComponent(filter.value)}`;

  const data = await api(url);
  if (!data) return;

  if (data.length === 0) {
    list.innerHTML = '<p class="empty">No transcriptions yet.</p>';
    return;
  }

  list.innerHTML = data
    .map((t) => {
      const name = customers.find((c) => c.phone === t.customer_phone)?.name || t.customer_phone;
      const date = new Date(t.created_at).toLocaleString();
      return `
      <div class="transcription-card">
        <div class="transcription-meta">
          <span>${esc(name)}</span>
          <span>${date}</span>
        </div>
        <div class="transcription-text">${esc(t.transcription)}</div>
      </div>
    `;
    })
    .join("");
}

document.getElementById("filter-customer").addEventListener("change", loadTranscriptions);

// Quick view transcriptions from customer card
function viewTranscriptions(phone) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => {
    c.hidden = true;
    c.classList.remove("active");
  });
  document.querySelector('[data-tab="transcriptions"]').classList.add("active");
  document.getElementById("tab-transcriptions").hidden = false;
  document.getElementById("tab-transcriptions").classList.add("active");

  document.getElementById("filter-customer").value = phone;
  loadTranscriptions();
}

// --- Utilities ---

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// --- Init ---

if (token) {
  showDashboard();
} else {
  showLogin();
}
