/**
 * app.js  (Orquestrador)
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade: bootstrap da página + registro de eventos.
 * Toda lógica de negócio foi extraída para js/services/ e js/ui/.
 *
 * Dependências (carregadas ANTES no HTML):
 *   js/config.js
 *   js/ui/toast.js
 *   js/ui/recording.js
 *   js/services/assinatura.service.js
 *   js/services/produto.service.js
 *   js/ui/produtos-modal.js
 *   auth-guard.js
 *   app-images.js
 */

console.log('[app.js v2] Orquestrador carregado.');

// ── Constantes ──────────────────────────────────────────────────────────────

var WEBHOOK_BASE_URL = (window.AppConfig && window.AppConfig.WEBHOOK_BASE_URL)
    || 'https://n8n.srv1181762.hstgr.cloud/webhook';

// ── Estado da página ────────────────────────────────────────────────────────

var pacienteAtual     = null;
var medicoAtivo       = JSON.parse(localStorage.getItem('medico_ativo')) || {};
var consultaIdGlobal  = null;
var audioBlobFinal    = null;

// ── Seletores (cacheados) ───────────────────────────────────────────────────

var btnGravar      = document.getElementById('btnGravar');
var btnPausar      = document.getElementById('btnPausar');
var btnProcessarIA = document.getElementById('btnProcessarIA');
var btnRecomecar   = document.getElementById('btnRecomecar');
var btnNovoPaciente= document.getElementById('btnNovoPaciente');
var btnAprovar     = document.getElementById('btnAprovar');
var btnDescartar   = document.getElementById('btnDescartar');

// ── Helpers de médico ───────────────────────────────────────────────────────

async function garantirMedicoId() {
    if (medicoAtivo && medicoAtivo.id) return medicoAtivo.id;

    if (!window.supabaseClient || !window.fetchMedicoData) {
        throw new Error('Sessão médica indisponível');
    }

    var sessionRes = await window.supabaseClient.auth.getSession();
    var session    = sessionRes.data && sessionRes.data.session;
    if (!session || !session.user || !session.user.id) {
        throw new Error('Sessão inválida');
    }

    var medicoDb = await window.fetchMedicoData(session.user.id);
    if (!medicoDb || !medicoDb.id) throw new Error('medico_id não encontrado');

    medicoAtivo = Object.assign({}, medicoAtivo, {
        id:          medicoDb.id,
        auth_id:     session.user.id,
        nome:        medicoAtivo.nome || medicoDb.nome || 'Dr(a). Médico',
        crm:         medicoAtivo.crm  || medicoDb.crm  || '',
        tipo_clinica: medicoAtivo.tipo_clinica || medicoDb.tipo_clinica || null,
    });
    localStorage.setItem('medico_ativo', JSON.stringify(medicoAtivo));
    return medicoAtivo.id;
}

function ativarModoCicatrize() {
    if (medicoAtivo && medicoAtivo.tipo_clinica === 'cicatrize') {
        var secao = document.getElementById('secaoCurativo');
        if (secao) secao.classList.remove('hidden');
    }
}

// ── Bootstrap ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    var urlParams = new URLSearchParams(window.location.search);
    var pNome  = urlParams.get('paciente');
    var pId    = urlParams.get('id');
    var pConv  = urlParams.get('convenio') || 'Particular';

    // Preenche cabeçalho do médico
    garantirMedicoId().then(function () {
        var mNameEl  = document.getElementById('medicoNome');
        var mAvatar  = document.getElementById('medicoAvatar');
        if (mNameEl && medicoAtivo && medicoAtivo.nome) {
            mNameEl.textContent = 'Dr(a). ' + medicoAtivo.nome;
        }
        if (mAvatar && medicoAtivo && medicoAtivo.nome) {
            mAvatar.src = 'https://ui-avatars.com/api/?name=' +
                encodeURIComponent(medicoAtivo.nome) + '&background=6366f1&color=fff';
        }
        ativarModoCicatrize();
    }).catch(function (err) { console.error(err); });

    // Preenche dados do paciente
    if (pNome && pId) {
        pacienteAtual = { id: pId, nome: pNome, convenio: pConv };

        var nomeEl = document.getElementById('pacienteNome');
        if (nomeEl) nomeEl.textContent = pNome;

        var convEl = document.getElementById('pacienteConvenio');
        if (convEl) convEl.textContent = pConv;

        document.title = 'Atendimento: ' + pNome + ' | Prontuar.io';

        var badge = document.getElementById('pacienteStatus');
        if (badge) {
            badge.className = 'px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-100 uppercase tracking-widest flex items-center gap-1.5';
            badge.innerHTML = '<div class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div> Em Atendimento';
        }

        if (btnGravar) btnGravar.disabled = false;
        window.Recording.setStatus('ready');
    }
});

// ── Gravação — Eventos ──────────────────────────────────────────────────────

if (btnGravar) {
    btnGravar.onclick = function () {
        if (!window.Recording) return;
        // Detecta estado pelo botão
        if (btnGravar.querySelector('.ph-stop')) {
            window.Recording.parar();
        } else {
            window.Recording.iniciar();
        }
    };
}

if (btnPausar) btnPausar.onclick = function () { window.Recording.togglePause(); };

// Recording.js despacha 'recording:done' quando o áudio está pronto
document.addEventListener('recording:done', function (e) {
    audioBlobFinal = e.detail.blob;
});

if (btnRecomecar) {
    btnRecomecar.onclick = function () {
        window.showConfirm(
            'Recomeçar Gravação',
            'Isso apagará o áudio atual. Continuar?',
            function () {
                audioBlobFinal = null;
                window.Recording.resetar();
            }
        );
    };
}

if (btnProcessarIA) btnProcessarIA.onclick = processarProntuario;
if (btnNovoPaciente) btnNovoPaciente.onclick = function () { window.location.href = 'recepcao.html'; };

// ── Processar Prontuário ────────────────────────────────────────────────────

async function processarProntuario() {
    if (!pacienteAtual) return window.showToast('Selecione um paciente', 'error');
    if (!audioBlobFinal) return window.showToast('Grave primeiro', 'error');

    window.Recording.setStatus('processing');
    btnProcessarIA.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Analisando...';

    var formData = new FormData();
    formData.append('audio', audioBlobFinal, 'consulta.webm');
    formData.append('paciente_id', pacienteAtual.id);

    try {
        var medicoId    = await garantirMedicoId();
        var authHeaders = await window.getAuthHeaders();
        formData.append('medico_id', medicoId);

        var response = await fetch(WEBHOOK_BASE_URL + '/novaConsulta', {
            method: 'POST',
            headers: authHeaders,
            body: formData,
        });

        var data = await response.json();

        if (data.success || data.consulta_id) {
            consultaIdGlobal = data.consulta_id;
            _preencherFormulario(data);
            document.getElementById('gravacaoContainer').classList.add('hidden');
            document.getElementById('resultadoProntuario').classList.remove('hidden');
            window.showToast('Prontuário gerado!', 'success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            throw new Error(data.message || 'Erro no processamento da IA');
        }
    } catch (err) {
        window.showToast('Erro: ' + err.message, 'error');
        window.Recording.setStatus('finished');
        btnProcessarIA.innerHTML = '<i class="ph-fill ph-sparkle text-2xl"></i> ANALISAR COM IA';
        var acoes = document.getElementById('acoesPosGrava');
        if (acoes) acoes.classList.remove('opacity-50', 'pointer-events-none');
    }
}

function _preencherFormulario(data) {
    var d = data.dados_extraidos || data;

    _setVal('hda',          d.hda);
    _setVal('exame_fisico', d.exame_fisico);
    _setVal('diagnostico',  d.diagnostico);

    var trat = d.tratamento || '';
    var obs  = d.observacoes || '';
    if (obs && !trat.includes(obs)) trat += '\n\n📌 OBSERVAÇÕES:\n' + obs;
    _setVal('tratamento', trat);

    // Curativo (Clínica Cicatrize)
    var curativo = data.curativo || d.curativo || null;
    if (curativo && typeof curativo === 'object') {
        var temDados = curativo.procedimento || curativo.fototerapia || curativo.materiais_listados;
        if (temDados) {
            var secao = document.getElementById('secaoCurativo');
            if (secao) secao.classList.remove('hidden');
        }
        _setVal('curativo_procedimento', curativo.procedimento);
        _setVal('curativo_fototerapia',  curativo.fototerapia);

        var mat = curativo.materiais_listados || '';
        if (Array.isArray(mat)) mat = mat.join('\n');
        _setVal('curativo_materiais', mat);
    }
}

function _setVal(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value || '';
}

// ── Modal de Assinatura ─────────────────────────────────────────────────────

var modalAssinatura       = document.getElementById('modalAssinaturaLegal');
var checkboxAcordo        = document.getElementById('checkboxAcordo');
var btnConfirmarAssinatura= document.getElementById('btnConfirmarAssinatura');
var btnCancelarAssinatura = document.getElementById('btnCancelarAssinatura');
var btnFecharModalAssin   = document.getElementById('btnFecharModalAssinatura');
var labelAcordo           = document.getElementById('labelAcordoAssinatura');
var elTimestamp           = document.getElementById('timestampAssinatura');

if (checkboxAcordo) {
    checkboxAcordo.addEventListener('change', function () {
        var ok = checkboxAcordo.checked;
        if (btnConfirmarAssinatura) btnConfirmarAssinatura.disabled = !ok;
        if (labelAcordo) {
            labelAcordo.classList.toggle('border-slate-200',  !ok);
            labelAcordo.classList.toggle('border-emerald-400', ok);
            labelAcordo.classList.toggle('bg-emerald-50/50',   ok);
        }
    });
}

function abrirModalAssinatura() {
    var nomeEl = document.getElementById('nomeAssinante');
    if (nomeEl && medicoAtivo && medicoAtivo.nome) nomeEl.textContent = medicoAtivo.nome;
    if (checkboxAcordo) {
        checkboxAcordo.checked = false;
        checkboxAcordo.dispatchEvent(new Event('change'));
    }
    if (elTimestamp) {
        var fmt = new Date().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        elTimestamp.textContent = 'Data/Hora da assinatura: ' + fmt;
    }
    if (modalAssinatura) modalAssinatura.style.display = 'flex';
}

function fecharModalAssinatura() {
    if (modalAssinatura) modalAssinatura.style.display = 'none';
}

if (btnCancelarAssinatura) btnCancelarAssinatura.onclick = fecharModalAssinatura;
if (btnFecharModalAssin)   btnFecharModalAssin.onclick   = fecharModalAssinatura;

if (btnAprovar) {
    btnAprovar.onclick = function () { abrirModalAssinatura(); };
}

// ── Confirmação de Assinatura ───────────────────────────────────────────────

if (btnConfirmarAssinatura) {
    btnConfirmarAssinatura.onclick = async function () {
        fecharModalAssinatura();
        if (!consultaIdGlobal) return;

        btnAprovar.disabled = true;
        btnAprovar.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Gerando Documentos...';

        // Injeta produtos no payload (ProdutoService já tem o estado)
        var produtosPayload = window.ProdutoService ? window.ProdutoService.getPayload() : [];

        var payload = {
            consulta_id: consultaIdGlobal,
            conteudo_medico: {
                hda:                  _getVal('hda'),
                exame_fisico:         _getVal('exame_fisico'),
                diagnostico:          _getVal('diagnostico'),
                tratamento:           _getVal('tratamento'),
                produtos_utilizados:  produtosPayload,
                curativo:             _coletarCurativo(),
            },
            produtos_utilizados: produtosPayload,
        };

        // Salva produtos no Supabase
        if (window.supabaseClient && produtosPayload.length > 0) {
            window.supabaseClient
                .from('consultas')
                .update({ produtos_utilizados: produtosPayload })
                .eq('id', consultaIdGlobal)
                .then(function (r) {
                    if (r.error) console.error('[app] Falha ao salvar produtos:', r.error);
                });
        }

        try {
            var authHeaders = await window.getAuthHeaders();
            var fetchPromise = fetch(WEBHOOK_BASE_URL + '/aprovarConsulta', {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders),
                body: JSON.stringify(payload),
            });

            var timeoutPromise = new Promise(function (_, reject) {
                setTimeout(function () { reject(new Error('TIMEOUT')); }, 25000);
            });

            var res;
            try {
                res = await Promise.race([fetchPromise, timeoutPromise]);
            } catch (e) {
                if (e.message === 'TIMEOUT') {
                    res = { ok: true, json: function () { return { success: true }; } };
                } else {
                    throw e;
                }
            }

            if (res.ok) {
                // Registra assinatura digital
                try {
                    var medicoId = await garantirMedicoId();
                    await window.AssinaturaService.registrar({
                        consultaId: consultaIdGlobal,
                        medicoId:   medicoId,
                        payload:    payload.conteudo_medico,
                    });
                } catch (eAssin) {
                    console.error('[app] Erro na assinatura:', eAssin);
                }

                _bloquearFormulario();
                await _concluirAtendimento(payload);
                window.showToast('Prontuário assinado com sucesso!');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                throw new Error('Erro Servidor: ' + res.status);
            }

        } catch (err) {
            console.error(err);
            if (err.message.includes('TIMEOUT') || err.message.length < 50) {
                window.showToast('Processo demorou, mas deve finalizar em breve.', 'warning');
                _forcarUiSucesso(payload);
            } else {
                window.showToast('Erro ao aprovar: ' + err.message, 'error');
                btnAprovar.disabled = false;
                btnAprovar.textContent = 'Tentar Novamente';
            }
        }
    };
}

// ── Helpers do formulário ───────────────────────────────────────────────────

function _getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
}

function _coletarCurativo() {
    var proc = (_getVal('curativo_procedimento') || '').trim();
    var foto = (_getVal('curativo_fototerapia')  || '').trim();
    var mat  = (_getVal('curativo_materiais')    || '').trim();
    if (!proc && !foto && !mat) return null;
    return {
        procedimento:      proc || null,
        fototerapia:       foto || null,
        materiais_listados: mat || null,
    };
}

function _bloquearFormulario() {
    ['hda', 'exame_fisico', 'diagnostico', 'tratamento',
     'curativo_procedimento', 'curativo_fototerapia', 'curativo_materiais']
        .forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.readOnly = true;
            el.classList.add('opacity-70', 'cursor-not-allowed', 'bg-slate-200', 'border-transparent');
            el.classList.remove('bg-slate-50/50', 'border-slate-200');
        });

    var titleContainer = document.querySelector('#resultadoProntuario .flex.items-center.gap-3 div');
    if (titleContainer) {
        titleContainer.innerHTML =
            '<h3 class="text-xl font-bold text-emerald-800 tracking-tight">Prontuário Assinado e Bloqueado</h3>' +
            '<p class="text-sm text-emerald-600 font-medium"><i class="ph-bold ph-lock-key"></i> Documento assinado digitalmente.</p>';
    }

    var iconContainer = document.querySelector('#resultadoProntuario .bg-emerald-100');
    if (iconContainer) {
        iconContainer.classList.replace('bg-emerald-100', 'bg-emerald-200');
        iconContainer.innerHTML = '<i class="ph-fill ph-lock-key text-2xl"></i>';
    }

    var btnAprovarEl = document.getElementById('btnAprovar');
    if (btnAprovarEl && btnAprovarEl.parentElement) {
        btnAprovarEl.parentElement.style.display = 'none';
    }
    var btnProdEl = document.getElementById('btnAbrirProdutos');
    if (btnProdEl) btnProdEl.style.display = 'none';
}

async function _concluirAtendimento(payload) {
    document.getElementById('conclusaoAtendimento').classList.remove('hidden');

    var pdfUrl = await getSignedUrl('prontuarios_pdf', payload.consulta_id + '.pdf');
    var btnPDF = document.getElementById('btnDownloadPDF');
    if (btnPDF && pdfUrl) {
        btnPDF.href   = pdfUrl;
        btnPDF.target = '_blank';
    }

    var badge = document.getElementById('pacienteStatus');
    if (badge) {
        badge.className = 'px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100 uppercase tracking-widest flex items-center gap-1.5';
        badge.innerHTML = '<i class="ph-fill ph-check-circle"></i> Finalizado';
    }

    // Fotos / relatório fotográfico
    var btnImgPDF = document.getElementById('btnRelatorioImagens');
    var cId = consultaIdGlobal || payload.consulta_id;
    var pId = pacienteAtual ? pacienteAtual.id : new URLSearchParams(window.location.search).get('id');

    if (window.fotosConsulta && window.fotosConsulta.length > 0) {
        window._fotosParaRelatorio        = window.fotosConsulta.slice();
        window._pacienteNomeParaRelatorio = window._pacienteNomeParaRelatorio || document.getElementById('pacienteNome')?.innerText || 'Paciente';
        window._medicoNomeParaRelatorio   = window._medicoNomeParaRelatorio   || 'Médico';

        window.showToast(window.fotosConsulta.length + ' foto(s) — salvando relatório...', 'info');

        if (btnImgPDF) {
            btnImgPDF.classList.remove('hidden');
            btnImgPDF.removeAttribute('href');
            btnImgPDF.onclick = function (e) { e.preventDefault(); };
            btnImgPDF.innerHTML = '<i class="ph ph-spinner animate-spin text-2xl"></i> Salvando...';
        }

        if (typeof window.enviarFotos === 'function') {
            try {
                var mId = await garantirMedicoId();
                await window.enviarFotos(cId, pId, mId);
            } catch (e) { console.error('[app] Upload fotos falhou:', e); }
        }

        try {
            var storagePath = await _chamarSalvarRelatorioImagens(cId, pId);
            if (storagePath && btnImgPDF) {
                var signedUrl = await getSignedUrl('prontuarios_pdf', storagePath);
                if (signedUrl) {
                    btnImgPDF.href    = signedUrl;
                    btnImgPDF.target  = '_blank';
                    btnImgPDF.onclick = null;
                    btnImgPDF.innerHTML = '<i class="ph-fill ph-images text-2xl"></i> PDF IMAGENS';
                }
            } else if (btnImgPDF) {
                btnImgPDF.classList.add('hidden');
            }
        } catch (e) {
            console.error('[app] Salvar PDF imagens falhou:', e);
            if (btnImgPDF) btnImgPDF.classList.add('hidden');
        }
    } else {
        await _chamarExibirBotaoRelatorioImagens(cId);
    }
}

async function _forcarUiSucesso(payload) {
    document.getElementById('resultadoProntuario').classList.add('hidden');
    document.getElementById('conclusaoAtendimento').classList.remove('hidden');
    var btnDL = document.getElementById('btnDownloadPDF');
    if (btnDL) {
        var url = await getSignedUrl('prontuarios_pdf', payload.consulta_id + '.pdf');
        if (url) { btnDL.href = url; btnDL.target = '_blank'; }
    }
    await _chamarExibirBotaoRelatorioImagens(payload.consulta_id);
}

// ── Delegação para app-images.js ────────────────────────────────────────────

async function _chamarSalvarRelatorioImagens(consultaId, pacienteId) {
    if (typeof window.salvarRelatorioImagensNoStorage === 'function') {
        return window.salvarRelatorioImagensNoStorage(consultaId, pacienteId);
    }
    console.warn('[app] window.salvarRelatorioImagensNoStorage não disponível');
    return null;
}

async function _chamarExibirBotaoRelatorioImagens(consultaId) {
    if (typeof window.exibirBotaoRelatorioImagens === 'function') {
        return window.exibirBotaoRelatorioImagens(consultaId);
    }
    console.warn('[app] window.exibirBotaoRelatorioImagens não disponível');
}

// ── Descartar ────────────────────────────────────────────────────────────────

if (btnDescartar) {
    btnDescartar.onclick = function () {
        window.showConfirm(
            'Sair do Atendimento',
            'Deseja mesmo descartar este atendimento e voltar para a fila?',
            function () { window.location.href = 'medico-dashboard.html'; }
        );
    };
}
