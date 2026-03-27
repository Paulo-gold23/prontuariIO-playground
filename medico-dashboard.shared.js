const WEBHOOK_LISTAR = "https://n8n.srv1181762.hstgr.cloud/webhook/listarPacientes";
const WEBHOOK_HISTORICO = "https://n8n.srv1181762.hstgr.cloud/webhook/consultas_finalizadas";
const DEBUG_DASHBOARD = true; // DEBUG ATIVO — desligar após diagnóstico

let medicoAtivo = JSON.parse(localStorage.getItem("medico_ativo"));
if (!medicoAtivo) window.location.href = "login.html";
else document.getElementById("navbar-doctor-name").innerText = medicoAtivo.nome;

let allPacientes = [];
let activeFilter = "TODOS";
let activeSort = "recent";
let searchDebounce = null;

function normalizeListPayload(payload, listKey) {
  if (payload && payload[listKey]) return payload[listKey];
  if (payload && payload.value && Array.isArray(payload.value)) return payload.value;
  if (Array.isArray(payload)) return payload;
  return payload ? [payload] : [];
}

function debugLog(...args) {
  if (!DEBUG_DASHBOARD) return;
  console.log('[DASH]', ...args);
}

async function garantirMedicoId() {
  let atual = JSON.parse(localStorage.getItem("medico_ativo") || "{}");
  if (atual && atual.id) {
    // Also ensure TenantContext is resolved
    if (window.TenantContext && typeof window.TenantContext.resolve === 'function') {
      try { await window.TenantContext.resolve(); } catch (e) { console.warn('[garantirMedicoId] TenantContext resolve failed:', e.message); }
    }
    return atual;
  }

  if (!window.supabaseClient || !window.supabaseClient.auth) {
    console.warn("[garantirMedicoId] Supabase ainda não carregou. Usando dados do localStorage.");
    if (atual && atual.nome) return atual;
    throw new Error("Supabase indisponível e localStorage vazio. Faça login novamente.");
  }

  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session || !session.user || !session.user.id) {
    throw new Error("Sessao invalida");
  }

  const medicoDb = typeof window.fetchMedicoData === "function" ? await window.fetchMedicoData(session.user.id) : null;
  if (!medicoDb || !medicoDb.id) {
    throw new Error("medico_id nao encontrado");
  }

  atual = {
    ...atual,
    id: medicoDb.id,
    auth_id: session.user.id,
    nome: atual.nome || medicoDb.nome || "Dr(a). Medico",
    crm: atual.crm || medicoDb.crm || ""
  };
  localStorage.setItem("medico_ativo", JSON.stringify(atual));
  medicoAtivo = atual;
  const nomeEl = document.getElementById("navbar-doctor-name");
  if (nomeEl && atual.nome) nomeEl.innerText = atual.nome;

  // Resolve TenantContext now that we have the full medico record
  if (window.TenantContext && typeof window.TenantContext.resolve === 'function') {
    try { await window.TenantContext.resolve(); } catch (e) { console.warn('[garantirMedicoId] TenantContext resolve failed:', e.message); }
  }

  return atual;
}

async function logoutMedico() {
  // Clear tenant context before signing out
  if (window.TenantContext && typeof window.TenantContext.clear === 'function') {
    window.TenantContext.clear();
  }
  if (window.supabaseClient && window.supabaseClient.auth) {
    await window.supabaseClient.auth.signOut();
  }
  localStorage.removeItem("medico_ativo");
  window.location.href = "login.html";
}

window.logoutMedico = logoutMedico;
