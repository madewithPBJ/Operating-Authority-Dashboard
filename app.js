const API = "/.netlify/functions";
let token = localStorage.getItem("dashboard_token");
let customers = [];
let allPrompts = [];
let currentCustomerPhone = null;

// ============================================================
// AUTH
// ============================================================

function showDashboard() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  showView("customers");
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

// ============================================================
// API HELPERS
// ============================================================

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
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
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`API ${path} returned non-JSON:`, text);
    return null;
  }
}

// ============================================================
// VIEW NAVIGATION
// ============================================================

function showView(viewName) {
  document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.hidden = false;

  // Update nav buttons
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === viewName);
  });

  if (viewName === "customers") loadCustomerOverview();
  if (viewName === "transcriptions") loadTranscriptions();
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// ============================================================
// CUSTOMER OVERVIEW
// ============================================================

async function loadCustomerOverview() {
  const list = document.getElementById("customers-list");
  list.innerHTML = '<p class="loading">Loading...</p>';

  let custData, promptData;
  try {
    [custData, promptData] = await Promise.all([
      api("get-customers"),
      api("get-prompts").catch(() => []),
    ]);
  } catch {
    list.innerHTML = '<p class="empty">Failed to load customers.</p>';
    return;
  }

  if (!custData) return;
  customers = Array.isArray(custData) ? custData : [];
  allPrompts = Array.isArray(promptData) ? promptData : [];

  if (customers.length === 0) {
    list.innerHTML = '<p class="empty">No customers yet. Add your first one above.</p>';
    return;
  }

  list.innerHTML = customers
    .map((c) => {
      const customerPrompts = allPrompts.filter((p) => p.customer_phone === c.phone);
      const latest = customerPrompts[0]; // already sorted by sent_at desc
      let statusHtml = '<span class="badge badge-gray">No prompts</span>';
      let lastDate = "";

      if (latest) {
        const totalQ = latest.questions.length;
        const answered = (latest.transcriptions || []).length;
        lastDate = new Date(latest.sent_at).toLocaleDateString();

        if (answered >= totalQ) {
          statusHtml = `<span class="badge badge-green">${totalQ} of ${totalQ} answered</span>`;
        } else if (answered > 0) {
          statusHtml = `<span class="badge badge-gold">${answered} of ${totalQ} answered</span>`;
        } else {
          statusHtml = `<span class="badge badge-gray">0 of ${totalQ} answered</span>`;
        }
      }

      return `
        <div class="card card-clickable" onclick="openCustomerDetail('${c.phone}')">
          <div class="card-info">
            <div class="name">${esc(c.name)}</div>
            <div class="phone">${esc(c.phone.replace("whatsapp:", ""))}</div>
          </div>
          <div class="card-status">
            ${statusHtml}
            ${lastDate ? `<span class="text-faint">${lastDate}</span>` : ""}
          </div>
        </div>
      `;
    })
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

  try {
    await api("add-customer", { method: "POST", body: JSON.stringify({ name, phone }) });
    document.getElementById("add-customer-form").hidden = true;
    document.getElementById("new-customer-name").value = "";
    document.getElementById("new-customer-phone").value = "";
    loadCustomerOverview();
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
});

// ============================================================
// CUSTOMER DETAIL
// ============================================================

function openCustomerDetail(phone) {
  currentCustomerPhone = phone;
  document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
  document.getElementById("view-detail").hidden = false;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  loadCustomerDetail();
}

async function loadCustomerDetail() {
  const customer = customers.find((c) => c.phone === currentCustomerPhone);
  if (!customer) return;

  document.getElementById("detail-name").textContent = customer.name;
  document.getElementById("detail-phone").textContent = customer.phone.replace("whatsapp:", "");

  const history = document.getElementById("prompt-history");
  history.innerHTML = '<p class="loading">Loading prompts...</p>';

  const prompts = allPrompts.filter((p) => p.customer_phone === currentCustomerPhone);

  if (prompts.length === 0) {
    history.innerHTML = '<p class="empty">No prompts sent yet.</p>';
    return;
  }

  history.innerHTML = prompts
    .map((prompt) => {
      const responses = (prompt.transcriptions || []).sort(
        (a, b) => (a.question_index || 0) - (b.question_index || 0)
      );
      const date = new Date(prompt.sent_at).toLocaleDateString();
      const answered = responses.length;
      const total = prompt.questions.length;

      const questionsHtml = prompt.questions
        .map((q, i) => {
          const response = responses.find((r) => r.question_index === i);
          if (response) {
            const rDate = new Date(response.created_at).toLocaleString();
            return `
              <div class="qa-pair">
                <div class="qa-question"><span class="qa-num">${i + 1}.</span> ${esc(q)}</div>
                <div class="qa-response">
                  <div class="qa-response-text">${esc(response.transcription)}</div>
                  <div class="qa-response-meta">
                    <span>${rDate}</span>
                    <button class="btn-link" onclick="openReassign('${response.id}', '${prompt.id}', ${total})">Reassign</button>
                  </div>
                </div>
              </div>
            `;
          }
          return `
            <div class="qa-pair">
              <div class="qa-question"><span class="qa-num">${i + 1}.</span> ${esc(q)}</div>
              <div class="qa-awaiting"><span class="dot-gold"></span> Awaiting response</div>
            </div>
          `;
        })
        .join("");

      // Show extra responses (question_index >= total questions)
      const extras = responses.filter((r) => r.question_index >= total);
      const extrasHtml = extras
        .map((r) => {
          const rDate = new Date(r.created_at).toLocaleString();
          return `
            <div class="qa-pair">
              <div class="qa-question"><span class="qa-num">Extra</span></div>
              <div class="qa-response">
                <div class="qa-response-text">${esc(r.transcription)}</div>
                <div class="qa-response-meta">
                  <span>${rDate}</span>
                  <button class="btn-link" onclick="openReassign('${r.id}', '${prompt.id}', ${total})">Reassign</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      let statusBadge;
      if (answered >= total) {
        statusBadge = `<span class="badge badge-green">${total}/${total}</span>`;
      } else if (answered > 0) {
        statusBadge = `<span class="badge badge-gold">${answered}/${total}</span>`;
      } else {
        statusBadge = `<span class="badge badge-gray">0/${total}</span>`;
      }

      return `
        <div class="prompt-card">
          <div class="prompt-header" onclick="this.parentElement.classList.toggle('expanded')">
            <div>
              <span class="prompt-date">${date}</span>
              ${statusBadge}
            </div>
            <span class="prompt-toggle">&#9660;</span>
          </div>
          <div class="prompt-body">
            ${questionsHtml}
            ${extrasHtml}
          </div>
        </div>
      `;
    })
    .join("");
}

document.getElementById("back-to-customers").addEventListener("click", () => showView("customers"));

// Edit from detail
document.getElementById("detail-edit-btn").addEventListener("click", () => {
  const c = customers.find((x) => x.phone === currentCustomerPhone);
  if (!c) return;
  document.getElementById("edit-customer-id").value = c.id;
  document.getElementById("edit-customer-name").value = c.name;
  document.getElementById("edit-customer-phone").value = c.phone.replace("whatsapp:", "");
  document.getElementById("edit-modal").hidden = false;
});

// Delete from detail
document.getElementById("detail-delete-btn").addEventListener("click", async () => {
  const c = customers.find((x) => x.phone === currentCustomerPhone);
  if (!c || !confirm(`Delete ${c.name}?`)) return;
  await api("delete-customer", { method: "DELETE", body: JSON.stringify({ id: c.id }) });
  showView("customers");
});

// ============================================================
// EDIT CUSTOMER MODAL
// ============================================================

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

  try {
    await api("update-customer", { method: "PUT", body: JSON.stringify({ id, name, phone }) });
    document.getElementById("edit-modal").hidden = true;
    // Refresh wherever we are
    const custData = await api("get-customers");
    if (custData) customers = custData;
    if (!document.getElementById("view-detail").hidden) loadCustomerDetail();
    else loadCustomerOverview();
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
});

// ============================================================
// PROMPT COMPOSER
// ============================================================

document.getElementById("new-prompt-btn").addEventListener("click", () => {
  const c = customers.find((x) => x.phone === currentCustomerPhone);
  if (!c) return;
  document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
  document.getElementById("view-composer").hidden = false;
  document.getElementById("composer-recipient").textContent = `To: ${c.name} (${c.phone.replace("whatsapp:", "")})`;
  document.getElementById("composer-questions").value = "";
  document.getElementById("composer-preview").hidden = true;
  document.getElementById("composer-status").hidden = true;
});

document.getElementById("back-to-detail").addEventListener("click", () => {
  document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
  document.getElementById("view-detail").hidden = false;
});

function parseQuestions(text) {
  return text
    .split(/^\d+\.\s*/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function composeMessage() {
  const intro = document.getElementById("composer-intro").value.trim();
  const outro = document.getElementById("composer-outro").value.trim();
  const questions = parseQuestions(document.getElementById("composer-questions").value);
  const numbered = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  let msg = "";
  if (intro) msg += intro + "\n\n";
  msg += numbered;
  if (outro) msg += "\n\n" + outro;
  return { questions, message: msg };
}

document.getElementById("composer-preview-btn").addEventListener("click", () => {
  const { questions, message } = composeMessage();
  if (questions.length === 0) return alert("Paste some numbered questions first.");
  document.getElementById("preview-content").textContent = message;
  document.getElementById("composer-preview").hidden = false;
});

document.getElementById("composer-send-btn").addEventListener("click", async () => {
  const { questions, message } = composeMessage();
  if (questions.length === 0) return alert("Paste some numbered questions first.");

  const btn = document.getElementById("composer-send-btn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const data = await api("send-prompt", {
      method: "POST",
      body: JSON.stringify({
        recipients: [currentCustomerPhone],
        questions,
        message,
      }),
    });

    const statusEl = document.getElementById("composer-status");
    statusEl.hidden = false;

    if (data && data.results) {
      const r = data.results[0];
      if (r.success) {
        statusEl.innerHTML = '<div class="result-success">Prompt sent successfully!</div>';
        // Refresh prompts and go back to detail after a moment
        const promptData = await api("get-prompts");
        if (promptData) allPrompts = promptData;
        setTimeout(() => {
          document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
          document.getElementById("view-detail").hidden = false;
          loadCustomerDetail();
        }, 1500);
      } else {
        statusEl.innerHTML = `<div class="result-fail">Failed: ${esc(r.error || "Unknown error")}</div>`;
      }
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Send Prompt";
  }
});

// ============================================================
// REASSIGN MODAL
// ============================================================

function openReassign(transcriptionId, promptId, totalQuestions) {
  document.getElementById("reassign-transcription-id").value = transcriptionId;
  const select = document.getElementById("reassign-question-select");
  select.innerHTML = "";
  for (let i = 0; i < totalQuestions; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Question ${i + 1}`;
    select.appendChild(opt);
  }
  document.getElementById("reassign-modal").hidden = false;
}

document.getElementById("reassign-cancel-btn").addEventListener("click", () => {
  document.getElementById("reassign-modal").hidden = true;
});

document.getElementById("reassign-save-btn").addEventListener("click", async () => {
  const transcriptionId = document.getElementById("reassign-transcription-id").value;
  const questionIndex = parseInt(document.getElementById("reassign-question-select").value, 10);

  const btn = document.getElementById("reassign-save-btn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    await api("assign-response", {
      method: "POST",
      body: JSON.stringify({ transcription_id: transcriptionId, question_index: questionIndex }),
    });
    document.getElementById("reassign-modal").hidden = true;
    // Refresh
    const promptData = await api("get-prompts");
    if (promptData) allPrompts = promptData;
    loadCustomerDetail();
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
});

// ============================================================
// RAW TRANSCRIPTIONS
// ============================================================

async function loadTranscriptions() {
  const list = document.getElementById("transcriptions-list");
  list.innerHTML = '<p class="loading">Loading transcriptions...</p>';

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
      const linked = t.prompt_id
        ? `<span class="badge badge-green">Q${(t.question_index || 0) + 1}</span>`
        : '<span class="badge badge-gray">Unlinked</span>';
      return `
        <div class="transcription-card">
          <div class="transcription-meta">
            <span>${esc(name)}</span>
            <span>${linked} ${date}</span>
          </div>
          <div class="transcription-text">${esc(t.transcription)}</div>
        </div>
      `;
    })
    .join("");
}

document.getElementById("filter-customer").addEventListener("change", loadTranscriptions);

// ============================================================
// UTILITIES
// ============================================================

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ============================================================
// INIT
// ============================================================

if (token) {
  showDashboard();
} else {
  showLogin();
}
