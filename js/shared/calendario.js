/**
 * js/shared/calendario.js
 * ─────────────────────────────────────────────────────────────
 * Módulo de Calendário Interno (Sem dependências externas).
 * Renderiza visualizações: Semanal (padrão), Mensal e Diária.
 * Permite CRUD completo de agendamentos de forma visual.
 */

(function () {
    'use strict';

    var _dataReferencia = new Date(); // Data ativa no calendário
    var _visaoAtual = 'semanal';      // semanal, mensal, diaria
    var _medicoFiltro = '';           // ID do médico selecionado para filtrar
    var _agendamentos = [];           // Cache de agendamentos carregados
    var _medicos = [];                 // Lista de médicos da clínica
    var _pacientes = [];               // Lista de pacientes da clínica
    var _containerId = '';             // Container alvo da renderização

    function _aplicarMascaraHora(inputEl) {
        if (!inputEl) return;
        
        inputEl.addEventListener('input', function (e) {
            var v = e.target.value.replace(/\D/g, '');
            if (v.length > 4) v = v.substring(0, 4);
            
            if (v.length >= 2) {
                var hh = v.substring(0, 2);
                if (parseInt(hh, 10) > 23) hh = '23';
                
                if (v.length > 2) {
                    var mm = v.substring(2);
                    if (parseInt(mm, 10) > 59) mm = '59';
                    e.target.value = hh + ':' + mm;
                } else {
                    e.target.value = hh;
                }
            } else {
                e.target.value = v;
            }
        });

        inputEl.addEventListener('blur', function (e) {
            var val = e.target.value;
            if (!val) return;
            var parts = val.split(':');
            var hh = parts[0] || '00';
            var mm = parts[1] || '00';
            
            if (hh.length === 1) hh = '0' + hh;
            if (hh.length === 0) hh = '00';
            while (mm.length < 2) mm += '0';
            
            e.target.value = hh + ':' + mm;
        });
    }

    /**
     * Inicializa o calendário em um container.
     */
    async function inicializar(containerId) {
        _containerId = containerId;
        
        // Se for dispositivo móvel, inicia por padrão na visão diária para melhor usabilidade
        if (window.innerWidth < 768) {
            _visaoAtual = 'diaria';
        }
        
        // Carrega dados iniciais do Supabase
        await Promise.all([
            _carregarMedicos(),
            _carregarPacientes()
        ]);

        _renderizarEstruturaBase();
        await atualizarDados();
    }

    // ─── Carregamento de Dados ──────────────────────────────────────────────────

    async function _carregarMedicos() {
        if (!window.supabaseClient) return;
        try {
            var medicoLocal = JSON.parse(localStorage.getItem('medico_ativo') || '{}');
            var { data, error } = await window.supabaseClient
                .from('medicos')
                .select('id, nome, especialidade, cargo')
                .eq('clinica_id', medicoLocal.clinica_id)
                .eq('ativo', true);

            if (error) throw error;
            // Filtra secretárias, mantém apenas médicos
            _medicos = (data || []).filter(function (m) { return m.cargo !== 'secretaria'; });
        } catch (e) {
            console.error('[Calendario] Erro ao carregar médicos:', e);
        }
    }

    async function _carregarPacientes() {
        if (!window.supabaseClient) return;
        try {
            var { data, error } = await window.supabaseClient
                .from('pacientes')
                .select('id, nome, telefone, cpf')
                .order('nome', { ascending: true });

            if (error) throw error;
            _pacientes = data || [];
        } catch (e) {
            console.error('[Calendario] Erro ao carregar pacientes:', e);
        }
    }

    async function atualizarDados() {
        if (!window.AgendaService) return;
        
        var limites = _calcularLimitesBusca();
        try {
            _agendamentos = await window.AgendaService.listar({
                medicoId:   _medicoFiltro || null,
                dataInicio: limites.inicio,
                dataFim:    limites.fim
            });

            _renderizarVisao();
        } catch (e) {
            console.error('[Calendario] Erro ao atualizar dados:', e);
            if (window.showToast) window.showToast('Erro ao carregar agenda', 'error');
        }
    }

    // ─── Helpers de Data ────────────────────────────────────────────────────────

    function _calcularLimitesBusca() {
        var inicio = new Date(_dataReferencia);
        var fim = new Date(_dataReferencia);

        if (_visaoAtual === 'diaria') {
            // Apenas o próprio dia
            return {
                inicio: _formatDate(inicio),
                fim:    _formatDate(fim)
            };
        } else if (_visaoAtual === 'semanal') {
            // Domingo a Sábado da semana atual
            var diaSemana = inicio.getDay();
            inicio.setDate(inicio.getDate() - diaSemana);
            fim.setDate(fim.getDate() + (6 - diaSemana));
            return {
                inicio: _formatDate(inicio),
                fim:    _formatDate(fim)
            };
        } else if (_visaoAtual === 'agenda') {
            // Próximos 30 dias a partir da data de referência
            fim.setDate(fim.getDate() + 30);
            return {
                inicio: _formatDate(inicio),
                fim:    _formatDate(fim)
            };
        } else {
            // Primeiro ao último dia do mês
            inicio.setDate(1);
            fim.setMonth(fim.getMonth() + 1);
            fim.setDate(0);
            return {
                inicio: _formatDate(inicio),
                fim:    _formatDate(fim)
            };
        }
    }

    function _formatDate(date) {
        var d = new Date(date);
        var month = '' + (d.getMonth() + 1);
        var day = '' + d.getDate();
        var year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    function _getInicioSemana(date) {
        var d = new Date(date);
        var dia = d.getDay();
        d.setDate(d.getDate() - dia);
        return d;
    }

    // ─── Renderização de Layout ──────────────────────────────────────────────────

    function _renderizarEstruturaBase() {
        var container = document.getElementById(_containerId);
        if (!container) return;

        container.className = "flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800";
        container.innerHTML = `
            <!-- Header do Calendário -->
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-5 p-3 md:p-5 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                <!-- Título e Navegação -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between w-full lg:w-auto gap-4">
                    <h3 id="cal-titulo-periodo" class="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider text-center sm:text-left"></h3>
                    <div class="flex items-center justify-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl relative mx-auto sm:mx-0 shrink-0">
                        <button id="cal-btn-prev" class="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all">
                            <i class="ph-bold ph-caret-left"></i>
                        </button>
                        <button id="cal-btn-today" class="px-3 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-all">
                            Hoje
                        </button>
                        <button id="cal-btn-next" class="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all">
                            <i class="ph-bold ph-caret-right"></i>
                        </button>
                        <div class="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <button id="cal-btn-datepicker" class="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all" title="Ir para Data">
                            <i class="ph-bold ph-calendar-blank"></i>
                        </button>
                        <input type="date" id="cal-input-datepicker" class="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none">
                    </div>
                </div>

                <!-- Filtros, Visões e Agendamento -->
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <!-- Filtro de Médico -->
                    <select id="cal-select-medico" class="w-full sm:w-60 bg-slate-100 dark:bg-slate-800 border-0 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20">
                        <option value="">Todos os Médicos</option>
                        ${_medicos.map(function(m) {
                            return `<option value="${m.id}">${m.nome} (${m.especialidade})</option>`;
                        }).join('')}
                    </select>

                    <!-- Seletor de Visão -->
                    <div class="flex w-full sm:w-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                        <button id="cal-btn-semanal" class="cal-btn-view flex-1 sm:flex-initial px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-center">Semanal</button>
                        <button id="cal-btn-mensal" class="cal-btn-view flex-1 sm:flex-initial px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-center">Mensal</button>
                        <button id="cal-btn-diaria" class="cal-btn-view flex-1 sm:flex-initial px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-center">Diária</button>
                        <button id="cal-btn-agenda" class="cal-btn-view flex-1 sm:flex-initial px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-center">Agenda</button>
                    </div>

                    <!-- Botão Agendar -->
                    <button id="cal-btn-agendar-topo" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/10 uppercase tracking-widest shrink-0">
                        <i class="ph-bold ph-plus-circle text-base"></i> AGENDAR
                    </button>
                </div>
            </div>

            <!-- Grid do Calendário -->
            <div id="cal-grid-view" class="flex-1 overflow-auto p-2 md:p-6 min-h-[400px]"></div>
        `;

        // Bind Events
        document.getElementById('cal-btn-prev').addEventListener('click', _navegarAnterior);
        document.getElementById('cal-btn-next').addEventListener('click', _navegarProximo);
        document.getElementById('cal-btn-today').addEventListener('click', _irParaHoje);
        document.getElementById('cal-select-medico').addEventListener('change', _filtrarMedico);
        
        document.getElementById('cal-btn-semanal').addEventListener('click', function() { _mudarVisao('semanal'); });
        document.getElementById('cal-btn-mensal').addEventListener('click', function() { _mudarVisao('mensal'); });
        document.getElementById('cal-btn-diaria').addEventListener('click', function() { _mudarVisao('diaria'); });
        document.getElementById('cal-btn-agenda').addEventListener('click', function() { _mudarVisao('agenda'); });
        document.getElementById('cal-btn-agendar-topo').addEventListener('click', function() { _abrirFormAgendamento(); });

        // DatePicker Events
        document.getElementById('cal-btn-datepicker').addEventListener('click', function() {
            var dp = document.getElementById('cal-input-datepicker');
            if (dp) {
                dp.value = _formatDate(_dataReferencia);
                dp.showPicker();
            }
        });
        document.getElementById('cal-input-datepicker').addEventListener('change', function(e) {
            if (e.target.value) {
                _dataReferencia = new Date(e.target.value + 'T12:00:00');
                atualizarDados();
            }
        });
    }

    function _renderizarVisao() {
        _atualizarBotoesVisao();
        _atualizarTituloPeriodo();

        var grid = document.getElementById('cal-grid-view');
        if (!grid) return;

        // Garante que o grid externo mantém scroll local e 100% da largura útil
        grid.className = "flex-1 overflow-auto p-2 md:p-6 min-h-[400px] w-full";
        grid.innerHTML = '';

        // Container interno responsivo que receberá a largura mínima de cada grid
        var inner = document.createElement('div');
        inner.className = "w-full";
        grid.appendChild(inner);

        if (_visaoAtual === 'diaria') {
            _renderizarVisaoDiaria(inner);
        } else if (_visaoAtual === 'semanal') {
            _renderizarVisaoSemanal(inner);
        } else if (_visaoAtual === 'mensal') {
            _renderizarVisaoMensal(inner);
        } else if (_visaoAtual === 'agenda') {
            _renderizarVisaoAgenda(inner);
        }
    }

    // ─── Visão Semanal ─────────────────────────────────────────────────────────

    function _renderizarVisaoSemanal(container) {
        var inicioSemana = _getInicioSemana(_dataReferencia);
        var diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        
        container.className = "grid grid-cols-7 gap-4 h-full min-w-[900px]";
        container.innerHTML = '';

        for (var i = 0; i < 7; i++) {
            var diaCorrente = new Date(inicioSemana);
            diaCorrente.setDate(inicioSemana.getDate() + i);
            var diaStr = _formatDate(diaCorrente);
            var isHoje = _formatDate(new Date()) === diaStr;

            // Filtra agendamentos do dia
            var agendamentosDia = _agendamentos.filter(function (a) {
                return a.data_agendamento === diaStr;
            });

            var diaCol = document.createElement('div');
            diaCol.className = "flex flex-col bg-white dark:bg-slate-950 rounded-2xl border " + 
                (isHoje ? "border-emerald-200 dark:border-emerald-800 shadow-emerald-500/5 shadow-md" : "border-slate-100 dark:border-slate-800") + 
                " overflow-hidden min-h-[350px]";

            var diaHeaderHtml = `
                <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between ` + 
                    (isHoje ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "") + `">
                    <div>
                        <h4 class="text-xs font-black uppercase tracking-wider ` + 
                            (isHoje ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400") + `">
                            ${diasSemana[i]}
                        </h4>
                        <p class="text-lg font-bold text-slate-800 dark:text-white mt-0.5">${diaCorrente.getDate()}</p>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400">
                        ${agendamentosDia.length}
                    </span>
                </div>
            `;

            var diaContent = document.createElement('div');
            diaContent.className = "flex-1 p-3 overflow-y-auto space-y-2.5 max-h-[450px]";

            if (agendamentosDia.length === 0) {
                diaContent.innerHTML = `
                    <div class="h-full flex items-center justify-center py-12 text-center">
                        <span class="text-[10px] font-bold text-slate-400">Sem agendamentos</span>
                    </div>
                `;
            } else {
                agendamentosDia.forEach(function (ag) {
                    var card = _criarCardAgendamento(ag);
                    diaContent.appendChild(card);
                });
            }

            var diaFooterHtml = `
                <button onclick="window.Calendario.abrirAgendamentoDia('${diaStr}')" class="w-full py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900 text-[10px] font-black text-slate-600 dark:text-slate-400 text-center uppercase tracking-wider border-t border-slate-100 dark:border-slate-800 transition-all">
                    + Agendar
                </button>
            `;

            diaCol.innerHTML = diaHeaderHtml;
            diaCol.appendChild(diaContent);
            diaCol.insertAdjacentHTML('beforeend', diaFooterHtml);
            container.appendChild(diaCol);
        }
    }

    // ─── Visão Diária ──────────────────────────────────────────────────────────

    function _renderizarVisaoDiaria(container) {
        var diaStr = _formatDate(_dataReferencia);
        var isHoje = _formatDate(new Date()) === diaStr;
        
        container.className = "flex flex-col gap-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 md:p-6 max-w-3xl mx-auto shadow-sm w-full";
        
        if (_agendamentos.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-center">
                    <div class="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                        <i class="ph ph-calendar-blank text-3xl text-slate-400"></i>
                    </div>
                    <p class="text-sm font-bold text-slate-500">Nenhum atendimento para esta data</p>
                    <button onclick="window.Calendario.abrirAgendamentoDia('${diaStr}')" class="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all">
                        AGENDAR NOVO
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Cronograma do Dia</h4>
                </div>
                <button onclick="window.Calendario.abrirAgendamentoDia('${diaStr}')" class="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline">
                    + Adicionar Agendamento
                </button>
            </div>
            <div class="space-y-4"></div>
        `;

        var listContainer = container.querySelector('.space-y-4');
        _agendamentos.forEach(function (ag) {
            var item = document.createElement('div');
            item.className = "flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 border border-slate-100 dark:border-slate-800 hover:border-emerald-100 hover:bg-emerald-50/10 rounded-2xl transition-all gap-3 md:gap-4";
            
            var statusColors = _getStatusColors(ag.status);
            var statusText = _getStatusText(ag.status);

            item.innerHTML = `
                <div class="flex items-start gap-4">
                    <!-- Horário -->
                    <div class="text-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
                        <span class="text-sm font-black text-slate-800 dark:text-white">${ag.horario.substring(0, 5)}</span>
                    </div>
                    <div>
                        <h5 class="text-sm font-bold text-slate-800 dark:text-white">${ag.pacientes ? ag.pacientes.nome : 'Sem Paciente'}</h5>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Médico: <strong>${ag.medicos ? ag.medicos.nome : 'Sem Médico'}</strong>
                            ${ag.pacientes && ag.pacientes.telefone ? ` · Tel: ${ag.pacientes.telefone}` : ''}
                        </p>
                        ${ag.observacoes ? `<p class="text-xs italic text-slate-400 mt-1">Obs: ${ag.observacoes}</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${statusColors}">
                        ${statusText}
                    </span>
                    <button onclick="window.Calendario.detalharAgendamento('${ag.id}')" class="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-all" title="Gerenciar Agendamento">
                        <i class="ph-bold ph-pencil-simple-line text-sm"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    // ─── Visão Mensal ──────────────────────────────────────────────────────────

    function _renderizarVisaoMensal(container) {
        var ano = _dataReferencia.getFullYear();
        var mes = _dataReferencia.getMonth();

        // Dia da semana do 1º dia do mês
        var primeiroDia = new Date(ano, mes, 1);
        var diaSemanaInicial = primeiroDia.getDay();

        // Número de dias no mês
        var ultimoDia = new Date(ano, mes + 1, 0);
        var totalDiasMes = ultimoDia.getDate();

        container.className = "grid grid-cols-7 gap-2 min-h-[450px] min-w-[700px]";
        container.innerHTML = '';

        // Headers dos dias
        var diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        diasSemana.forEach(function (dia) {
            container.insertAdjacentHTML('beforeend', `
                <div class="text-center font-black text-[10px] text-slate-400 uppercase tracking-widest py-2">${dia}</div>
            `);
        });

        // Células vazias do início da semana
        for (var i = 0; i < diaSemanaInicial; i++) {
            container.insertAdjacentHTML('beforeend', `<div class="bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl"></div>`);
        }

        // Dias do mês
        for (var dia = 1; dia <= totalDiasMes; dia++) {
            var dataFmt = _formatDate(new Date(ano, mes, dia));
            var isHoje = _formatDate(new Date()) === dataFmt;

            var agsDia = _agendamentos.filter(function (a) {
                return a.data_agendamento === dataFmt;
            });

            var cell = document.createElement('button');
            cell.className = "flex flex-col items-start p-2 md:p-3 bg-white dark:bg-slate-950 border " + 
                (isHoje ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/10" : "border-slate-100 dark:border-slate-800") + 
                " hover:border-emerald-200 dark:hover:border-emerald-800 rounded-xl md:rounded-2xl transition-all text-left min-h-[70px] md:min-h-[80px]";
            
            // Evento clique do dia
            (function (dataDia) {
                cell.addEventListener('click', function () {
                    _dataReferencia = new Date(dataDia + 'T12:00:00');
                    _visaoAtual = 'diaria';
                    atualizarDados();
                });
            })(dataFmt);

            cell.innerHTML = `
                <span class="text-xs font-black ` + (isHoje ? "text-emerald-500" : "text-slate-800 dark:text-slate-300") + `">${dia}</span>
                ${agsDia.length > 0 
                    ? `<span class="mt-1 md:mt-2 text-[8px] md:text-[10px] font-black uppercase px-1.5 md:px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                         ${agsDia.length} ${agsDia.length === 1 ? 'consulta' : 'consultas'}
                       </span>`
                    : ''
                }
            `;
            container.appendChild(cell);
        }
    }

    // ─── Criação de Cards e Status ──────────────────────────────────────────────

    function _detectarChoqueHorario(ag) {
        if (ag.status === 'cancelado') return false;
        
        var duplicados = _agendamentos.filter(function (a) {
            return a.id !== ag.id &&
                   a.status !== 'cancelado' &&
                   a.data_agendamento === ag.data_agendamento &&
                   a.horario === ag.horario &&
                   a.medico_id === ag.medico_id;
        });

        return duplicados.length > 0;
    }

    function _criarCardAgendamento(ag) {
        var card = document.createElement('button');
        var choque = _detectarChoqueHorario(ag);
        
        var borderClass = choque 
            ? "border-amber-300 dark:border-amber-700 bg-amber-50/5 dark:bg-amber-950/5 hover:border-amber-400" 
            : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-950 hover:border-emerald-100";
            
        card.className = "w-full text-left p-3 border rounded-xl transition-all shadow-sm group relative overflow-hidden " + borderClass;
        
        var statusColors = _getStatusColors(ag.status);
        var statusText = _getStatusText(ag.status);
        
        var choqueIcon = choque 
            ? `<i class="ph-fill ph-warning-circle text-amber-500 text-xs shrink-0" title="Alerta: Choque de horário para este médico!"></i>` 
            : '';

        card.innerHTML = `
            <!-- Badge de Status Lateral -->
            <div class="absolute left-0 top-0 bottom-0 w-1 ${choque ? 'bg-amber-500' : (ag.status === 'cancelado' ? 'bg-rose-400' : 'bg-emerald-400')}"></div>
            
            <div class="flex items-center justify-between gap-1 mb-1">
                <span class="text-[9px] font-black text-slate-800 dark:text-white shrink-0">${ag.horario.substring(0, 5)}</span>
                <div class="flex items-center gap-1">
                    ${choqueIcon}
                    <span class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${statusColors}">${statusText}</span>
                </div>
            </div>
            <p class="text-[11px] font-bold text-slate-800 dark:text-slate-300 truncate">${ag.pacientes ? ag.pacientes.nome : 'Sem Paciente'}</p>
            <p class="text-[9px] text-slate-400 mt-0.5 truncate">Dr(a). ${ag.medicos ? ag.medicos.nome : 'Médico'}</p>
        `;

        card.addEventListener('click', function () {
            _detalharAgendamento(ag.id);
        });

        return card;
    }

    function _renderizarVisaoAgenda(container) {
        container.className = "flex flex-col gap-4 md:gap-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 md:p-6 max-w-3xl mx-auto shadow-sm overflow-y-auto w-full";
        
        if (_agendamentos.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-center">
                    <div class="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                        <i class="ph ph-calendar-blank text-3xl text-slate-400"></i>
                    </div>
                    <p class="text-sm font-bold text-slate-500">Nenhum atendimento agendado para os próximos 30 dias</p>
                </div>
            `;
            return;
        }

        // Agrupar agendamentos por dia
        var agendamentosPorDia = {};
        _agendamentos.forEach(function (ag) {
            if (!agendamentosPorDia[ag.data_agendamento]) {
                agendamentosPorDia[ag.data_agendamento] = [];
            }
            agendamentosPorDia[ag.data_agendamento].push(ag);
        });

        // Ordenar as datas
        var datasOrdenadas = Object.keys(agendamentosPorDia).sort();

        container.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Compromissos Agendados (Próximos 30 dias)</h4>
                </div>
            </div>
            <div class="space-y-6" id="agenda-lista-dias"></div>
        `;

        var listaDias = container.querySelector('#agenda-lista-dias');

        datasOrdenadas.forEach(function (dataStr) {
            var dataObj = new Date(dataStr + 'T12:00:00');
            var diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dataObj.getDay()];
            var diaMes = dataObj.getDate();
            var mesStr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][dataObj.getMonth()];

            var diaSection = document.createElement('div');
            diaSection.className = "space-y-3";

            diaSection.innerHTML = `
                <div class="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800/60">
                    <div class="flex flex-col items-center justify-center w-11 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl shrink-0">
                        <span class="text-[9px] font-black uppercase text-slate-400 leading-none">${mesStr}</span>
                        <span class="text-base font-black text-slate-800 dark:text-white leading-none mt-0.5">${diaMes}</span>
                    </div>
                    <div>
                        <h5 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">${diaSemana}</h5>
                        <p class="text-[10px] text-slate-400 font-bold">${dataObj.toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
                <div class="space-y-3 pl-0 sm:pl-14" id="consultas-${dataStr}"></div>
            `;

            listaDias.appendChild(diaSection);
            var consultasContainer = diaSection.querySelector(`#consultas-${dataStr}`);

            agendamentosPorDia[dataStr].forEach(function (ag) {
                var item = document.createElement('div');
                item.className = "flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 dark:border-slate-800 hover:border-emerald-100 hover:bg-emerald-50/10 rounded-2xl transition-all gap-4";
                
                var statusColors = _getStatusColors(ag.status);
                var statusText = _getStatusText(ag.status);

                var choque = _detectarChoqueHorario(ag);
                var choqueWarning = choque 
                    ? `<div class="inline-flex items-center gap-1 mt-1 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-200/50">
                         <i class="ph-bold ph-warning-circle text-xs"></i> CHOQUE DE HORÁRIO
                       </div>`
                    : '';

                item.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div class="text-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
                            <span class="text-sm font-black text-slate-800 dark:text-white">${ag.horario.substring(0, 5)}</span>
                        </div>
                        <div>
                            <h5 class="text-sm font-bold text-slate-800 dark:text-white">${ag.pacientes ? ag.pacientes.nome : 'Sem Paciente'}</h5>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Médico: <strong>${ag.medicos ? ag.medicos.nome : 'Sem Médico'}</strong>
                                ${ag.pacientes && ag.pacientes.telefone ? ` · Tel: ${ag.pacientes.telefone}` : ''}
                            </p>
                            ${choqueWarning}
                            ${ag.observacoes ? `<p class="text-xs italic text-slate-400 mt-1">Obs: ${ag.observacoes}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${statusColors}">
                            ${statusText}
                        </span>
                        <button onclick="window.Calendario.detalharAgendamento('${ag.id}')" class="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-all" title="Gerenciar Agendamento">
                            <i class="ph-bold ph-pencil-simple-line text-sm"></i>
                        </button>
                    </div>
                `;
                consultasContainer.appendChild(item);
            });
        });
    }

    function _getStatusColors(status) {
        switch (status) {
            case 'agendado': return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
            case 'confirmado': return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400';
            case 'em_atendimento': return 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 animate-pulse';
            case 'finalizado': return 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400';
            case 'cancelado': return 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400';
            case 'remarcado': return 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400';
            default: return 'bg-slate-100 text-slate-600';
        }
    }

    function _getStatusText(status) {
        switch (status) {
            case 'agendado': return 'Agendado';
            case 'confirmado': return 'Confirmado';
            case 'em_atendimento': return 'Em Consulta';
            case 'finalizado': return 'Finalizado';
            case 'cancelado': return 'Cancelado';
            case 'remarcado': return 'Remarcado';
            default: return status;
        }
    }

    // ─── Modais e Gerenciamento ──────────────────────────────────────────────────

    async function _abrirFormAgendamento(dataPreDefinida) {
        var dataFinal = dataPreDefinida || _formatDate(_dataReferencia);

        // Garante que a lista de médicos está carregada antes de exibir o seletor
        if (_medicos.length === 0) {
            await _carregarMedicos();
        }
        
        var modal = document.createElement('div');
        modal.id = 'modal-agendamento-temp';
        modal.className = "fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm";
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 transform scale-95 transition-all">
                <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h4 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">Agendar Atendimento</h4>
                    <button id="form-btn-fechar" class="text-slate-400 hover:text-slate-600"><i class="ph-bold ph-x text-lg"></i></button>
                </div>
                
                <form id="form-agendar" class="p-6 space-y-4">
                    <!-- Paciente -->
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-black uppercase tracking-wider text-slate-400">Paciente</label>
                        <select id="form-agendar-paciente" required class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <option value="">Selecione um Paciente...</option>
                            ${_pacientes.map(function(p) {
                                var cpfFmt = p.cpf ? ` (CPF: ${p.cpf})` : '';
                                return `<option value="${p.id}">${p.nome}${cpfFmt}</option>`;
                            }).join('')}
                        </select>
                    </div>

                    <!-- Médico -->
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-black uppercase tracking-wider text-slate-400">Médico Responsável</label>
                        <select id="form-agendar-medico" required class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <option value="">Selecione um Médico...</option>
                            ${_medicos.length === 0
                                ? `<option value="" disabled>Nenhum médico disponível</option>`
                                : _medicos.map(function(m) {
                                    var esp = m.especialidade ? ` (${m.especialidade})` : '';
                                    return `<option value="${m.id}">Dr(a). ${m.nome}${esp}</option>`;
                                  }).join('')
                            }
                        </select>
                    </div>

                    <!-- Data e Horário -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-black uppercase tracking-wider text-slate-400">Data</label>
                            <input type="date" id="form-agendar-data" required value="${dataFinal}" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-black uppercase tracking-wider text-slate-400">Horário</label>
                            <input type="text" id="form-agendar-hora" placeholder="00:00" required class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                        </div>
                    </div>

                    <!-- Observações -->
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-black uppercase tracking-wider text-slate-400">Observações (opcional)</label>
                        <textarea id="form-agendar-obs" rows="2" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"></textarea>
                    </div>

                    <button type="submit" class="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/10 uppercase tracking-widest">
                        CONFIRMAR AGENDAMENTO
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Input mask e validação para hora (HH:MM)
        var horaInput = document.getElementById('form-agendar-hora');
        _aplicarMascaraHora(horaInput);

        // Fechar Modal
        document.getElementById('form-btn-fechar').addEventListener('click', function() { modal.remove(); });

        // Submit form
        document.getElementById('form-agendar').addEventListener('submit', async function (e) {
            e.preventDefault();
            
            var pId = document.getElementById('form-agendar-paciente').value;
            var mId = document.getElementById('form-agendar-medico').value;
            var dt = document.getElementById('form-agendar-data').value;
            var hr = document.getElementById('form-agendar-hora').value;
            var obs = document.getElementById('form-agendar-obs').value;

            if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(hr)) {
                if (window.showToast) window.showToast('Horário inválido. Digite no formato HH:MM (00:00 às 23:59)', 'error');
                return;
            }

            try {
                await window.AgendaService.criar({
                    pacienteId: pId,
                    medicoId: mId,
                    dataAgendamento: dt,
                    horario: hr,
                    observacoes: obs
                });
                if (window.showToast) window.showToast('Agendamento criado com sucesso!', 'success');
                modal.remove();
                atualizarDados();
            } catch (err) {
                console.error(err);
                if (window.showToast) window.showToast('Falha ao agendar: ' + err.message, 'error');
            }
        });
    }

    async function _detalharAgendamento(id) {
        var ag = _agendamentos.find(function(a) { return a.id === id; });
        if (!ag) return;

        var modal = document.createElement('div');
        modal.id = 'modal-detalhe-temp';
        modal.className = "fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm";
        
        var isAgendado = ag.status === 'agendado';
        var isConfirmado = ag.status === 'confirmado';

        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 transform scale-95 transition-all">
                <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h4 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">Gerenciar Consulta</h4>
                    <button id="detalhe-btn-fechar" class="text-slate-400 hover:text-slate-600"><i class="ph-bold ph-x text-lg"></i></button>
                </div>
                
                <div class="p-6 space-y-5">
                    <!-- Info do Paciente -->
                    <div class="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div class="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black">
                            ${ag.pacientes ? ag.pacientes.nome.charAt(0) : '?'}
                        </div>
                        <div>
                            <h5 class="text-sm font-bold text-slate-800 dark:text-white">${ag.pacientes ? ag.pacientes.nome : 'Sem Paciente'}</h5>
                            <p class="text-xs text-slate-400">Tel: ${ag.pacientes && ag.pacientes.telefone ? ag.pacientes.telefone : 'Não cadastrado'}</p>
                        </div>
                    </div>

                    <!-- Detalhes do Agendamento -->
                    <div class="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <div>
                            <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Médico</p>
                            <p class="text-slate-800 dark:text-slate-200">Dr(a). ${ag.medicos ? ag.medicos.nome : 'Não especificado'}</p>
                        </div>
                        <div>
                            <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Status</p>
                            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${_getStatusColors(ag.status)}">${_getStatusText(ag.status)}</span>
                        </div>
                        <div>
                            <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Data</p>
                            <p class="text-slate-800 dark:text-slate-200">${new Date(ag.data_agendamento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div>
                            <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Horário</p>
                            <p class="text-slate-800 dark:text-slate-200">${ag.horario.substring(0, 5)}</p>
                        </div>
                    </div>

                    ${ag.observacoes ? `
                    <div class="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <p class="text-[9px] font-black uppercase text-slate-400 mb-1">Observações</p>
                        <p class="text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">${ag.observacoes}</p>
                    </div>
                    ` : ''}

                    <!-- Ações -->
                    <div class="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        ${isAgendado ? `
                        <button id="detalhe-btn-confirmar" class="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all shadow-md">
                            CONFIRMAR PRESENÇA
                        </button>
                        ` : ''}
                        
                        ${(isAgendado || isConfirmado) ? `
                        <div class="grid grid-cols-2 gap-2">
                            <button id="detalhe-btn-remarcar" class="py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl transition-all">
                                REMARCAR
                            </button>
                            <button id="detalhe-btn-cancelar" class="py-3 border border-rose-100 hover:bg-rose-50 text-rose-600 text-xs font-black rounded-xl transition-all">
                                CANCELAR
                            </button>
                        </div>
                        ` : ''}

                        <!-- Formulário de Remarcação (oculto por padrão) -->
                        <div id="secao-remarcar" class="hidden space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mt-2">
                            <h5 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Nova Data e Hora</h5>
                            <div class="grid grid-cols-2 gap-3">
                                <input type="date" id="remarcar-data" value="${ag.data_agendamento}" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none">
                                <input type="text" id="remarcar-hora" value="${ag.horario.substring(0, 5)}" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none">
                            </div>
                            <button id="remarcar-confirmar" class="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all">
                                SALVAR REMARCAÇÃO
                            </button>
                        </div>

                        <!-- Formulário de Cancelamento (oculto por padrão) -->
                        <div id="secao-cancelar" class="hidden space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-rose-100 dark:border-rose-950/20 mt-2">
                            <h5 class="text-xs font-black uppercase tracking-wider text-rose-600">Cancelar Agendamento</h5>
                            <p class="text-[10px] text-slate-400 font-bold">Por favor, informe o motivo do cancelamento (opcional):</p>
                            <input type="text" id="cancelar-motivo" placeholder="Ex: Paciente precisou viajar" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none w-full">
                            <button id="cancelar-confirmar" class="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-600/10">
                                CONFIRMAR CANCELAMENTO
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind Buttons
        document.getElementById('detalhe-btn-fechar').addEventListener('click', function() { modal.remove(); });

        if (isAgendado) {
            document.getElementById('detalhe-btn-confirmar').addEventListener('click', async function () {
                try {
                    await window.AgendaService.confirmar(id);
                    if (window.showToast) window.showToast('Presença confirmada!', 'success');
                    modal.remove();
                    atualizarDados();
                } catch (e) {
                    if (window.showToast) window.showToast('Erro ao confirmar: ' + e.message, 'error');
                }
            });
        }

        if (isAgendado || isConfirmado) {
            // Cancelar
            document.getElementById('detalhe-btn-cancelar').addEventListener('click', function () {
                document.getElementById('secao-cancelar').classList.toggle('hidden');
                document.getElementById('secao-remarcar').classList.add('hidden');
            });

            document.getElementById('cancelar-confirmar').addEventListener('click', async function () {
                var motivo = document.getElementById('cancelar-motivo').value.trim();
                try {
                    await window.AgendaService.cancelar(id, motivo || null);
                    if (window.showToast) window.showToast('Agendamento cancelado.', 'success');
                    modal.remove();
                    atualizarDados();
                } catch (e) {
                    if (window.showToast) window.showToast('Erro ao cancelar: ' + e.message, 'error');
                }
            });

            // Toggle Remarcar Secao
            document.getElementById('detalhe-btn-remarcar').addEventListener('click', function () {
                document.getElementById('secao-remarcar').classList.toggle('hidden');
                document.getElementById('secao-cancelar').classList.add('hidden');
            });

            // Mask para hora de remarcação
            var remHora = document.getElementById('remarcar-hora');
            _aplicarMascaraHora(remHora);

            // Confirmar Remarcação
            document.getElementById('remarcar-confirmar').addEventListener('click', async function () {
                var nd = document.getElementById('remarcar-data').value;
                var nh = document.getElementById('remarcar-hora').value;

                if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(nh)) {
                    if (window.showToast) window.showToast('Horário de remarcação inválido (00:00 às 23:59)', 'error');
                    return;
                }

                try {
                    await window.AgendaService.remarcar(id, {
                        dataAgendamento: nd,
                        horario:          nh
                    });
                    if (window.showToast) window.showToast('Agendamento remarcado!', 'success');
                    modal.remove();
                    atualizarDados();
                } catch (e) {
                    if (window.showToast) window.showToast('Erro ao remarcar: ' + e.message, 'error');
                }
            });
        }
    }

    // ─── Navegação de Datas e Filtros ──────────────────────────────────────────

    function _navegarAnterior() {
        if (_visaoAtual === 'diaria') {
            _dataReferencia.setDate(_dataReferencia.getDate() - 1);
        } else if (_visaoAtual === 'semanal') {
            _dataReferencia.setDate(_dataReferencia.getDate() - 7);
        } else if (_visaoAtual === 'agenda') {
            _dataReferencia.setDate(_dataReferencia.getDate() - 30);
        } else {
            _dataReferencia.setMonth(_dataReferencia.getMonth() - 1);
        }
        atualizarDados();
    }

    function _navegarProximo() {
        if (_visaoAtual === 'diaria') {
            _dataReferencia.setDate(_dataReferencia.getDate() + 1);
        } else if (_visaoAtual === 'semanal') {
            _dataReferencia.setDate(_dataReferencia.getDate() + 7);
        } else if (_visaoAtual === 'agenda') {
            _dataReferencia.setDate(_dataReferencia.getDate() + 30);
        } else {
            _dataReferencia.setMonth(_dataReferencia.getMonth() + 1);
        }
        atualizarDados();
    }

    function _irParaHoje() {
        _dataReferencia = new Date();
        atualizarDados();
    }

    function _filtrarMedico(e) {
        _medicoFiltro = e.target.value;
        atualizarDados();
    }

    function _mudarVisao(visao) {
        _visaoAtual = visao;
        _renderizarVisao();
        atualizarDados();
    }

    function _atualizarBotoesVisao() {
        document.querySelectorAll('.cal-btn-view').forEach(function (btn) {
            btn.className = "cal-btn-view flex-1 sm:flex-initial px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-center";
        });

        var btnAtivo = document.getElementById('cal-btn-' + _visaoAtual);
        if (btnAtivo) {
            btnAtivo.className = "cal-btn-view flex-1 sm:flex-initial px-3 py-2.5 rounded-lg text-xs font-black bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition-all text-center";
        }
    }

    function _atualizarTituloPeriodo() {
        var titulo = document.getElementById('cal-titulo-periodo');
        if (!titulo) return;

        var meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        var ano = _dataReferencia.getFullYear();
        var mes = meses[_dataReferencia.getMonth()];

        if (_visaoAtual === 'diaria') {
            titulo.textContent = _dataReferencia.getDate() + ' de ' + mes + ' de ' + ano;
        } else if (_visaoAtual === 'semanal') {
            var inicio = _getInicioSemana(_dataReferencia);
            var fim = new Date(inicio);
            fim.setDate(inicio.getDate() + 6);
            titulo.textContent = inicio.getDate() + ' a ' + fim.getDate() + ' de ' + mes + ' de ' + ano;
        } else if (_visaoAtual === 'agenda') {
            titulo.textContent = 'Próximos 30 dias';
        } else {
            titulo.textContent = mes + ' de ' + ano;
        }
    }

    // Exposição da API global para cliques em botões
    window.Calendario = {
        inicializar:           inicializar,
        atualizarDados:        atualizarDados,
        abrirAgendamentoDia:  function (diaStr) { _abrirFormAgendamento(diaStr); },
        detalharAgendamento:   _detalharAgendamento
    };
})();
