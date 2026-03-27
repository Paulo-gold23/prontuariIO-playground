// =========================================================
// medico-dashboard.data.js
// Carrega pacientes e histórico.
// STANDALONE  → usa n8n webhook (filtrado por medico_id)
// CLINIC      → consulta Supabase direto (filtrado por clinica_id)
//               para que todos os médicos da clínica vejam os mesmos dados.
// =========================================================

function computePacienteStats(pacientes) {
  const hoje = new Date().toDateString();
  const aguardandoCount = pacientes.filter((p) => {
    const s = (p.status_atendimento || "").toUpperCase();
    return s === "AGUARDANDO" || s === "EM ESPERA" || s === "CADASTRADO" || s === "";
  }).length;
  const hojeCount = pacientes.filter((p) => {
    return p.created_at && new Date(p.created_at).toDateString() === hoje;
  }).length;
  return { aguardandoCount, hojeCount };
}

async function getAnexoUrl(anexo) {
  if (!anexo) return null;
  if (anexo.includes("prontuarios_pdf")) return await getSignedUrl("prontuarios_pdf", anexo);
  if (anexo.includes("anexos_imagens"))  return await getSignedUrl("anexos_imagens", anexo);
  if (anexo.endsWith("_imagens.pdf"))    return await getSignedUrl("prontuarios_pdf", anexo);
  return await getSignedUrl("anexos_imagens", anexo);
}

async function getAudioUrl(audioUrl) {
  if (!audioUrl) return null;
  if (audioUrl.startsWith("http")) return audioUrl;
  try { return await getSignedUrl("audios_consultas", audioUrl); } catch { return null; }
}

async function getAnexoImagensFallback(consultaId) {
  if (!consultaId || !window.supabaseClient) return null;
  try {
    const fileName = `${consultaId}_imagens.pdf`;
    const { data, error } = await window.supabaseClient.storage
      .from("prontuarios_pdf")
      .createSignedUrl(fileName, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch { return null; }
}

// ---------------------------------------------------------
// Modo CLÍNICA: busca pacientes direto no Supabase
// ---------------------------------------------------------
async function fetchPacientesClinica(clinicaId) {
  if (!window.supabaseClient) return [];

  const { data, error } = await window.supabaseClient
    .from("pacientes")
    .select(`
      id, nome, convenio, created_at, medico_id, clinica_id,
      consultas(status, created_at)
    `)
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchPacientesClinica] Erro:", error.message);
    return [];
  }

  // Normaliza para o formato esperado pelo renderFilteredCards
  return (data || []).map((p) => {
    const ultConsulta = p.consultas && p.consultas.length > 0
      ? p.consultas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      : null;

    let status_atendimento = "CADASTRADO";
    if (ultConsulta) {
      status_atendimento = ultConsulta.status === "finalizado"
        ? "FINALIZADO"
        : "EM ATENDIMENTO";
    }

    const { consultas: _drop, ...rest } = p;
    return { ...rest, status_atendimento };
  });
}

// ---------------------------------------------------------
// Modo CLÍNICA: busca histórico direto no Supabase
// ---------------------------------------------------------
async function fetchHistoricoClinica(clinicaId) {
  if (!window.supabaseClient) return [];

  const { data, error } = await window.supabaseClient
    .from("consultas")
    .select(`
      id, status, created_at, pdf_url, audio_url, anexo_imagens_url,
      pacientes(nome)
    `)
    .eq("clinica_id", clinicaId)
    .eq("status", "finalizado")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("[fetchHistoricoClinica] Erro:", error.message);
    return [];
  }

  return (data || []).map((c) => ({
    consulta_id:       c.id,
    paciente_nome:     c.pacientes?.nome || "Paciente",
    data_hora:         c.created_at,
    pdf_url:           c.pdf_url,
    audio_url:         c.audio_url,
    anexo_imagens_url: c.anexo_imagens_url,
  }));
}

// ---------------------------------------------------------
// Resolve contexto de tenant — com fallback direto ao Supabase
// Nunca retorna silenciosamente null: loga o erro e tenta fallback.
// ---------------------------------------------------------
async function resolveTenantCtx() {
  // Tenta TenantContext (modo normal)
  if (window.TenantContext) {
    try {
      const ctx = await window.TenantContext.resolve();
      debugLog("[data] TenantContext OK →", ctx.type, "| clinicaId:", ctx.clinicaId);
      return ctx;
    } catch (e) {
      console.error("[data] TenantContext.resolve FALHOU:", e.message);
    }
  }

  // Fallback: vai direto ao Supabase para descobrir clinica_id do usuário logado
  console.warn("[data] Usando fallback direto → buscando clinica_id no Supabase");
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session?.user?.id) {
      console.error("[data] Fallback: sessão Supabase inválida");
      return null;
    }
    const { data: medicoRow, error } = await window.supabaseClient
      .from("medicos")
      .select("id, clinica_id, nome")
      .eq("auth_user_id", session.user.id)
      .single();

    if (error || !medicoRow) {
      console.error("[data] Fallback: médico não encontrado no banco:", error?.message);
      return null;
    }

    console.log("[data] Fallback OK → medicoId:", medicoRow.id, "| clinicaId:", medicoRow.clinica_id);

    // Retorna objeto mínimo compatível com o que carregarPacientes espera
    return {
      type:        medicoRow.clinica_id ? "CLINIC" : "STANDALONE",
      isClinic:    !!medicoRow.clinica_id,
      clinicaId:   medicoRow.clinica_id,
      medicoId:    medicoRow.id,
    };
  } catch (fallbackErr) {
    console.error("[data] Fallback também falhou:", fallbackErr.message);
    return null;
  }
}

// ---------------------------------------------------------
// carregarPacientes — ponto de entrada principal
// ---------------------------------------------------------
async function carregarPacientes() {
  const container    = document.getElementById("listaPacientes");
  const statAguard   = document.getElementById("stat-aguardando");
  const statHoje     = document.getElementById("stat-hoje");

  try {
    console.warn("═══ [CARGA] Iniciando carregarPacientes ═══");

    const medicoSeguro = await garantirMedicoId();
    console.warn("[CARGA] medicoSeguro:", JSON.stringify(medicoSeguro));
    if (!medicoSeguro || !medicoSeguro.id) {
      throw new Error("ID do médico não encontrado. Faça logout e login novamente.");
    }

    // ── PASSO 1: Resolver contexto de tenant ──
    let ctx = await resolveTenantCtx();
    console.warn("[CARGA] TenantContext resultado:", ctx ? JSON.stringify({type: ctx.type, clinicaId: ctx.clinicaId, medicoId: ctx.medicoId}) : "NULL");

    let data = [];

    if (ctx && ctx.type === "CLINIC" && ctx.clinicaId) {
      // ── MODO CLÍNICA: Supabase direto ──
      console.warn("[CARGA] ★ Modo CLÍNICA → clinica_id:", ctx.clinicaId);
      data = await fetchPacientesClinica(ctx.clinicaId);
      console.warn("[CARGA] fetchPacientesClinica retornou:", data.length, "pacientes");
    } else {
      // ── ANTES de cair no n8n, tenta buscar clinica_id direto ──
      // Isso corrige o caso onde TenantContext falha mas o médico TEM clinica_id no banco
      console.warn("[CARGA] TenantContext não retornou CLINIC. Tentando busca direta...");
      
      let clinicaIdDireto = null;
      try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session?.user?.id) {
          const { data: mRow } = await window.supabaseClient
            .from("medicos")
            .select("id, clinica_id")
            .eq("auth_user_id", session.user.id)
            .single();
          if (mRow && mRow.clinica_id) {
            clinicaIdDireto = mRow.clinica_id;
            console.warn("[CARGA] ★ BUSCA DIRETA encontrou clinica_id:", clinicaIdDireto);
          }
        }
      } catch (directErr) {
        console.warn("[CARGA] Busca direta falhou:", directErr.message);
      }

      if (clinicaIdDireto) {
        // Médico tem clínica → usa Supabase direto
        data = await fetchPacientesClinica(clinicaIdDireto);
        console.warn("[CARGA] fetchPacientesClinica (direto) retornou:", data.length, "pacientes");
      } else {
        // Realmente standalone → usa n8n
        console.warn("[CARGA] Modo STANDALONE → n8n webhook, medico_id:", medicoSeguro.id);
        const urlFila = `${WEBHOOK_LISTAR}?medico_id=${encodeURIComponent(medicoSeguro.id)}&t=${Date.now()}`;
        const authHeaders = typeof window.getAuthHeaders === "function"
          ? await window.getAuthHeaders()
          : {};
        const res = await fetch(urlFila, { headers: { ...authHeaders } });
        if (!res.ok) throw new Error("API Offline");
        const payload = await res.json();
        data = normalizeListPayload(payload, "all_pacientes");
        console.warn("[CARGA] n8n retornou:", data.length, "pacientes");
      }
    }

    allPacientes = data.filter((p) => p && p.nome);
    console.warn("[CARGA] ✅ Total após filtro:", allPacientes.length, "pacientes");

    const { aguardandoCount, hojeCount } = computePacienteStats(allPacientes);
    statAguard.innerText = aguardandoCount;
    statHoje.innerText   = hojeCount;

    renderFilteredCards();
    carregarHistoricoGlobal();
  } catch (e) {
    console.error("═══ [CARGA] ❌ ERRO FATAL ═══", e.message, e);
    container.innerHTML = `<div class="col-span-full p-8 bg-rose-50 text-rose-500 border border-rose-100 rounded-2xl text-center font-bold">Falha ao conectar com o serviço.</div>`;
  }
}

// ---------------------------------------------------------
// carregarHistoricoGlobal
// ---------------------------------------------------------
async function carregarHistoricoGlobal() {
  const container = document.getElementById("listaHistorico");
  try {
    const medicoSeguro = await garantirMedicoId();
    const ctx = await resolveTenantCtx();

    let hist = [];

    if (ctx && ctx.type === "CLINIC" && ctx.clinicaId) {
      // CLÍNICA: Supabase direto
      hist = await fetchHistoricoClinica(ctx.clinicaId);
    } else {
      // Fallback: tenta buscar clinica_id direto antes de ir pro n8n
      let clinicaIdDireto = null;
      try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session?.user?.id) {
          const { data: mRow } = await window.supabaseClient
            .from("medicos")
            .select("id, clinica_id")
            .eq("auth_user_id", session.user.id)
            .single();
          if (mRow && mRow.clinica_id) clinicaIdDireto = mRow.clinica_id;
        }
      } catch (e) { /* ignora */ }

      if (clinicaIdDireto) {
        hist = await fetchHistoricoClinica(clinicaIdDireto);
      } else {
        // STANDALONE: n8n webhook
        const url = `${WEBHOOK_HISTORICO}?medico_id=${encodeURIComponent(medicoSeguro.id)}&t=${Date.now()}`;
        const authHeaders = typeof window.getAuthHeaders === "function"
          ? await window.getAuthHeaders()
          : {};
        const res = await fetch(url, { headers: { ...authHeaders } });
        if (!res.ok) return;
        const payload = await res.json();
        hist = normalizeListPayload(payload, "all_consultas");
      }
    }

    container.innerHTML = "";
    if (hist.length === 0) {
      container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400 font-medium">Nenhum prontuário registrado.</div>`;
      return;
    }

    for (const item of hist.slice(0, 8)) {
      const dataC   = new Date(item.data_hora);
      const dataFmt = dataC.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const pdfUrl  = await getSignedUrl("prontuarios_pdf", item.pdf_url || `${item.consulta_id}.pdf`);
      let   imgUrl  = await getAnexoUrl(item.anexo_imagens_url);
      if (!imgUrl)  imgUrl = await getAnexoImagensFallback(item.consulta_id);
      const vozUrl  = item.audio_url ? await getSignedUrl("audios_consultas", item.audio_url) : null;

      const card = document.createElement("div");
      card.className = "bg-white p-5 rounded-3xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 animate-in group flex flex-col";
      card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
          <div class="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
            <i class="ph ph-file-text text-xl"></i>
          </div>
          <span class="text-[10px] bg-slate-50 px-2 py-1 rounded-md text-slate-400 font-bold uppercase tracking-wider">${dataFmt}</span>
        </div>
        <h5 class="font-extrabold text-slate-900 text-sm mb-4 line-clamp-1 flex-1">${item.paciente_nome}</h5>
        <div class="flex gap-2 mt-auto flex-wrap">
          <a href="${pdfUrl || "#"}" target="_blank" class="flex-1 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-emerald-600 transition-all uppercase tracking-widest text-center inline-block">Ver Laudo</a>
          ${imgUrl ? `<a href="${imgUrl}" target="_blank" title="PDF de Imagens" class="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-center inline-flex items-center justify-center gap-1"><i class="ph-bold ph-image text-xs"></i>Imagens</a>` : ""}
          ${vozUrl ? `<a href="${vozUrl}" target="_blank" title="Áudio da Consulta" class="flex-1 py-2 bg-violet-600 text-white text-[10px] font-black rounded-xl hover:bg-violet-700 transition-all uppercase tracking-widest text-center inline-flex items-center justify-center gap-1"><i class="ph-bold ph-waveform text-xs"></i>Voz</a>` : ""}
        </div>
      `;
      container.appendChild(card);
    }
  } catch (e) {
    console.error(e);
  }
}

async function verHistorico(id, nome) {
  const modal   = document.getElementById("modalHistorico");
  document.getElementById("modal-hist-nome").innerText = nome;
  const content = document.getElementById("historicoConteudo");
  modal.classList.remove("hidden");
  content.innerHTML = `<div class="p-12 text-center text-slate-400"><i class="ph ph-spinner animate-spin text-4xl mb-3 text-emerald-500"></i><p>Acessando prontuários...</p></div>`;

  try {
    const url = `${WEBHOOK_HISTORICO}?paciente_id=${id}&t=${Date.now()}`;
    const authHeaders = typeof window.getAuthHeaders === "function"
      ? await window.getAuthHeaders()
      : {};
    const res  = await fetch(url, { headers: { ...authHeaders } });
    const list = await res.json();
    const consultas = normalizeListPayload(list, "all_consultas");

    content.innerHTML = "";
    if (consultas.length === 0) {
      content.innerHTML = `<div class="p-12 text-center text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200"><p>Sem registros anteriores.</p></div>`;
      return;
    }

    for (const c of consultas) {
      const data   = new Date(c.data_hora).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const pdfUrl = await getSignedUrl("prontuarios_pdf", c.pdf_url || `${c.consulta_id}.pdf`);
      let   imgUrl = await getAnexoUrl(c.anexo_imagens_url);
      if (!imgUrl)  imgUrl = await getAnexoImagensFallback(c.consulta_id);
      const vozUrl = c.audio_url ? await getSignedUrl("audios_consultas", c.audio_url) : null;

      const div = document.createElement("div");
      div.className = "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-slate-50 rounded-2xl hover:bg-white border border-transparent hover:border-emerald-100 hover:shadow-lg transition-all group";
      div.innerHTML = `
        <div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm shrink-0">
            <i class="ph-bold ph-calendar"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">${data}</p>
            <p class="text-xs text-slate-400 font-bold uppercase tracking-tight truncate">
              Atendimento Finalizado
              ${imgUrl ? " · <span class=\"text-indigo-500\">+ Imagens</span>" : ""}
              ${vozUrl ? " · <span class=\"text-violet-500\">+ Voz</span>" : ""}
            </p>
          </div>
        </div>
        <div class="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 custom-scrollbar shrink-0">
          <a href="${pdfUrl || "#"}" target="_blank" class="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-emerald-600 transition-all uppercase tracking-widest shadow-xl whitespace-nowrap text-center">Prontuário</a>
          ${imgUrl ? `<a href="${imgUrl}" target="_blank" class="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 transition-all uppercase tracking-widest shadow-xl whitespace-nowrap flex items-center justify-center gap-1"><i class="ph-bold ph-image text-xs"></i>Imagens</a>` : ""}
          ${vozUrl ? `<a href="${vozUrl}" target="_blank" class="flex-1 sm:flex-none px-4 py-2.5 bg-violet-600 text-white text-[10px] font-black rounded-xl hover:bg-violet-700 transition-all uppercase tracking-widest shadow-xl whitespace-nowrap flex items-center justify-center gap-1"><i class="ph-bold ph-waveform text-xs"></i>Voz</a>` : ""}
        </div>
      `;
      content.appendChild(div);
    }
  } catch (e) {
    content.innerText = "Erro ao carregar histórico.";
  }
}

function fecharModalHistorico() {
  document.getElementById("modalHistorico").classList.add("hidden");
}

function atenderPaciente(id, nome, convenio) {
  if (window.speechSynthesis) {
    const msg = new SpeechSynthesisUtterance(`Paciente ${nome}, favor dirigir-se ao consultório.`);
    msg.lang = "pt-BR";
    window.speechSynthesis.speak(msg);
  }
  setTimeout(() => {
    window.location.href = `atendimento.html?paciente=${encodeURIComponent(nome)}&id=${id}&convenio=${encodeURIComponent(convenio)}`;
  }, 1200);
}

window.carregarPacientes    = carregarPacientes;
window.verHistorico         = verHistorico;
window.fecharModalHistorico = fecharModalHistorico;
window.atenderPaciente      = atenderPaciente;

document.addEventListener("DOMContentLoaded", carregarPacientes);
setInterval(carregarPacientes, 45000);
