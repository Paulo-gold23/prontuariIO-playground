function setupSearchAndSortInteractions() {
  const searchEl = document.getElementById("searchPaciente");
  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      const clearBtn = document.getElementById("searchClear");
      if (clearBtn) clearBtn.classList.toggle("hidden", !e.target.value);
      searchDebounce = setTimeout(() => renderFilteredCards(), 200);
    });
  }

  document.addEventListener("click", (e) => {
    const sortC = document.getElementById("sortContainer");
    if (sortC && !sortC.contains(e.target)) {
      document.getElementById("sortMenu")?.classList.add("hidden");
    }
  });
}

document.addEventListener("DOMContentLoaded", setupSearchAndSortInteractions);

function clearSearch() {
  const el = document.getElementById("searchPaciente");
  if (el) {
    el.value = "";
    el.focus();
  }
  document.getElementById("searchClear")?.classList.add("hidden");
  renderFilteredCards();
}

function setFilter(status, btn) {
  activeFilter = status;
  document.querySelectorAll(".filter-pill").forEach((p) => {
    p.classList.remove("active", "bg-emerald-600", "text-white", "border-emerald-600");
    p.classList.add("bg-white", "text-slate-500", "border-slate-200");
  });
  btn.classList.remove("bg-white", "text-slate-500", "border-slate-200");
  btn.classList.add("active", "bg-emerald-600", "text-white", "border-emerald-600");
  renderFilteredCards();
}

function toggleSortMenu() {
  document.getElementById("sortMenu")?.classList.toggle("hidden");
}

function setSort(mode) {
  activeSort = mode;
  const labels = { recent: "Recente", oldest: "Antigo", az: "A â†’ Z", za: "Z â†’ A" };
  document.getElementById("sortLabel").innerText = labels[mode] || mode;
  document.getElementById("sortMenu")?.classList.add("hidden");
  renderFilteredCards();
}

function getPacienteStatusStyle(status) {
  if (status === "AGUARDANDO" || status === "EM ESPERA") {
    return { bg: "bg-amber-100", text: "text-amber-700" };
  }
  if (status === "FINALIZADO" || status === "ATENDIDO") {
    return { bg: "bg-emerald-100", text: "text-emerald-700" };
  }
  if (status === "EM ATENDIMENTO" || status === "CADASTRADO") {
    return { bg: "bg-indigo-100", text: "text-indigo-700" };
  }
  return { bg: "bg-slate-100", text: "text-slate-500" };
}

function escapeSingleQuotes(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function buildEmptyPacienteState(isFiltering) {
  return `
      <div class="col-span-full flex flex-col items-center justify-center p-10 sm:p-20 bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm animate-in">
        <div class="w-16 h-16 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4 sm:mb-6">
          <i class="ph ph-${isFiltering ? "funnel-simple" : "coffee"} text-3xl sm:text-5xl text-slate-200"></i>
        </div>
        <h3 class="text-lg sm:text-xl font-bold text-slate-900 mb-2 text-center">${isFiltering ? "Nenhum resultado" : "Sil\u00eancio no consult\u00f3rio"}</h3>
        <p class="text-sm sm:text-base text-slate-400 font-medium text-center">${isFiltering ? "Tente ajustar a busca ou os filtros." : "N\u00e3o h\u00e1 pacientes aguardando no momento."}</p>
        ${isFiltering ? "<button onclick=\"clearSearch(); setFilter('TODOS', document.querySelector('.filter-pill[data-filter=TODOS]'));\" class=\"mt-4 px-5 py-2 bg-emerald-50 text-emerald-700 text-xs font-black rounded-xl hover:bg-emerald-100 transition-all uppercase tracking-wider\"><i class=\"ph-bold ph-x mr-1\"></i>Limpar Filtros</button>" : ""}
      </div>
    `;
}

function buildPacienteCardHtml(paciente, hora, status, statusStyle) {
  const nomeEscaped = escapeSingleQuotes(paciente.nome);
  const convenio = paciente.convenio || "Particular";
  return `
      <div class="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
        <i class="ph ph-user text-8xl"></i>
      </div>
      <div class="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-8">
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-base sm:text-lg shadow-inner uppercase shrink-0">
          ${paciente.nome.substring(0, 2)}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="text-sm sm:text-lg font-extrabold text-slate-900 group-hover:text-emerald-600 transition-colors leading-tight truncate">${paciente.nome}</h4>
          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest"><i class="ph-bold ph-clock text-emerald-400 mr-0.5"></i>${hora}</span>
            <span class="w-1 h-1 bg-slate-200 rounded-full"></span>
            <span class="px-1.5 sm:px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-100 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-tight">${convenio}</span>
            <span class="w-1 h-1 bg-slate-200 rounded-full"></span>
            <span class="px-1.5 sm:px-2 py-0.5 ${statusStyle.bg} ${statusStyle.text} rounded text-[8px] sm:text-[9px] font-black uppercase tracking-tight">${status}</span>
          </div>
        </div>
      </div>
      <div class="flex gap-2 sm:gap-3 mt-auto relative z-10 w-full">
        <button onclick="verHistorico('${paciente.id}', '${nomeEscaped}')" class="flex-1 py-2.5 sm:py-3 px-2 bg-slate-100 text-slate-600 text-[10px] sm:text-xs font-black rounded-lg sm:rounded-xl hover:bg-slate-200 transition-all uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-2">
        <i class="ph-bold ph-clock-counter-clockwise text-sm"></i> <span>Hist\u00f3rico</span>
      </button>
      <button onclick="atenderPaciente('${paciente.id}', '${nomeEscaped}', '${convenio}')" class="flex-1 py-2.5 sm:py-3 px-2 bg-indigo-600 text-white text-[10px] sm:text-xs font-black rounded-lg sm:rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-2">
          <i class="ph-bold ph-plus-circle text-sm"></i> <span>Novo Atend.</span>
        </button>
      </div>`;
}

function getFilteredPacientes() {
  const query = (document.getElementById("searchPaciente")?.value || "").trim().toUpperCase();
  let filtered = allPacientes.filter((p) => {
    if (query && !p.nome.toUpperCase().includes(query)) return false;
    if (activeFilter !== "TODOS") {
      const s = (p.status_atendimento || "CADASTRADO").toUpperCase();
      if (activeFilter === "AGUARDANDO") {
        return s === "AGUARDANDO" || s === "EM ESPERA";
      }
      return s === activeFilter;
    }
    return true;
  });
  filtered.sort((a, b) => {
    switch (activeSort) {
      case "az": return a.nome.localeCompare(b.nome, "pt-BR");
      case "za": return b.nome.localeCompare(a.nome, "pt-BR");
      case "oldest": return new Date(a.created_at) - new Date(b.created_at);
      case "recent":
      default: return new Date(b.created_at) - new Date(a.created_at);
    }
  });
  return filtered;
}

function renderFilteredCards() {
  const container = document.getElementById("listaPacientes");
  const fila = getFilteredPacientes();
  const countEl = document.getElementById("filteredCount");
  if (countEl) countEl.innerText = fila.length;

  container.innerHTML = "";
  if (fila.length === 0) {
    const query = (document.getElementById("searchPaciente")?.value || "").trim();
    const isFiltering = query || activeFilter !== "TODOS";
    container.innerHTML = buildEmptyPacienteState(isFiltering);
    return;
  }

  fila.forEach((p, idx) => {
    const hora = new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const status = (p.status_atendimento || "CADASTRADO").toUpperCase();
    const statusStyle = getPacienteStatusStyle(status);

    const card = document.createElement("div");
    card.className = "bg-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2rem] border border-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.04)] hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 animate-in group relative overflow-hidden h-full";
    card.style.animationDelay = `${idx * 50}ms`;
    card.innerHTML = buildPacienteCardHtml(p, hora, status, statusStyle);
    container.appendChild(card);
  });
}

window.clearSearch = clearSearch;
window.setFilter = setFilter;
window.toggleSortMenu = toggleSortMenu;
window.setSort = setSort;
