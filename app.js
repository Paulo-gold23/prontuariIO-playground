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
var assinaturaMedico  = null;
var assinaturaPaciente = null;

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
    var atual = JSON.parse(localStorage.getItem('medico_ativo') || '{}');
    if (atual && atual.id && ('tipo_clinica' in atual) && atual.nome_completo !== undefined) {
        medicoAtivo = atual;
        return atual.id;
    }

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

    medicoAtivo = Object.assign({}, atual, {
        id:             medicoDb.id,
        auth_id:        session.user.id,
        nome:           medicoDb.nome || 'Dr(a). Médico',
        nome_completo:  medicoDb.nome_completo || '',
        crm:            medicoDb.crm || '',
        uf_crm:         medicoDb.uf_crm || '',
        especialidade:  medicoDb.especialidade || '',
        assinatura_url: medicoDb.assinatura_url || null,
        tipo_clinica:   medicoDb.tipo_clinica || null
    });
    localStorage.setItem('medico_ativo', JSON.stringify(medicoAtivo));
    return medicoAtivo.id;
}

function verificarPerfilCompleto(medico) {
    if (!medico) return false;
    if (!medico.nome_completo || !medico.nome) return false;
    if (medico.tipo_clinica !== 'lm' && medico.tipo_clinica !== 'demo' && !medico.assinatura_url) return false;
    if (!medico.especialidade) return false;
    if (medico.tipo_clinica !== 'cicatrize' && medico.tipo_clinica !== 'demo') {
        if (!medico.crm || !medico.uf_crm) return false;
    }
    return true;
}

async function urlToBase64(url) {
    if (!url) return null;
    if (typeof url === 'string' && url.startsWith('data:')) {
        return url;
    }
    try {
        var res = await fetch(url);
        if (!res.ok) throw new Error('Status ' + res.status);
        var blob = await res.blob();
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function () { resolve(reader.result); };
            reader.onerror = function (e) { reject(e); };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error('[urlToBase64] Falha ao converter URL via fetch:', e);
        
        // Tenta baixar via Supabase Client se for uma URL do Supabase
        if (window.supabaseClient && typeof url === 'string' && url.includes('supabase.co')) {
            try {
                console.log('[urlToBase64] Tentando download direto via Supabase client como fallback...');
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/');
                const objectIndex = pathParts.findIndex(part => part === 'public' || part === 'sign' || part === 'authenticated');
                if (objectIndex !== -1 && pathParts.length > objectIndex + 2) {
                    const bucket = pathParts[objectIndex + 1];
                    const cleanPath = pathParts.slice(objectIndex + 2).join('/').split('?')[0];
                    const path = decodeURIComponent(cleanPath);
                    
                    const { data, error } = await window.supabaseClient.storage.from(bucket).download(path);
                    if (!error && data) {
                        return await new Promise(function (resolve, reject) {
                            var reader = new FileReader();
                            reader.onloadend = function () { resolve(reader.result); };
                            reader.onerror = function (err) { reject(err); };
                            reader.readAsDataURL(data);
                        });
                    }
                }
            } catch (err2) {
                console.error('[urlToBase64] Falha no fallback do Supabase client:', err2);
            }
        }
        
        return url; // fallback final
    }
}

function sincronizarEstadoCarimbo() {
    var chk = document.getElementById('chkUsarCarimbo');
    var overlay = document.getElementById('overlayAssinaturaSalva');
    var img = document.getElementById('imgAssinaturaSalva');
    var txt = document.getElementById('txtCarimboSalvo');
    var btnLimpar = document.getElementById('btnLimparAssinaturaMedico');

    if (!chk) return;

    var temAssinaturaSalva = medicoAtivo && medicoAtivo.assinatura_url;

    if (temAssinaturaSalva) {
        if (chk.disabled) {
            chk.checked = true;
        }
        chk.disabled = false;
        if (chk.checked) {
            if (overlay) {
                overlay.classList.remove('hidden');
            }
            if (img) {
                if (window.getSignedUrlForFile) {
                    window.getSignedUrlForFile(medicoAtivo.assinatura_url).then(function (url) {
                        if (url) img.src = url;
                    });
                } else {
                    img.src = medicoAtivo.assinatura_url;
                }
            }
            if (txt) {
                var nome = medicoAtivo.nome_completo || medicoAtivo.nome || "";
                var esp = medicoAtivo.especialidade || "";
                if (medicoAtivo.tipo_clinica === 'cicatrize') {
                    txt.innerHTML = nome + "<br>" + esp;
                } else {
                    var crmVal = medicoAtivo.crm || "";
                    var ufVal = medicoAtivo.uf_crm || "";
                    txt.innerHTML = "Dr(a). " + nome + "<br>" + esp + "<br>CRM " + crmVal + "/" + ufVal;
                }
            }
            if (btnLimpar) {
                btnLimpar.classList.add('invisible');
            }
        } else {
            if (overlay) {
                overlay.classList.add('hidden');
            }
            if (btnLimpar) {
                btnLimpar.classList.remove('invisible');
            }
        }
    } else {
        chk.checked = false;
        chk.disabled = true;
        if (overlay) {
            overlay.classList.add('hidden');
        }
        if (btnLimpar) {
            btnLimpar.classList.remove('invisible');
        }
    }
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
    var pConsultaId = urlParams.get('consulta_id') || null;

    // Se veio consulta_id da agenda, significa que a consulta já foi criada
    // Armazena para usar no processamento
    if (pConsultaId) {
        consultaIdGlobal = pConsultaId;
    }

    // Preenche cabeçalho do médico
    garantirMedicoId().then(function () {
        if (!verificarPerfilCompleto(medicoAtivo)) {
            window.location.href = 'medico-dashboard.html?openProfile=true';
            return;
        }

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
        ativarModoLm();
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

    // Inicialização do Canvas de Assinatura
    if (window.CanvasSignature) {
        assinaturaMedico = new CanvasSignature(
            'canvasAssinaturaMedico',
            null,
            'btnLimparAssinaturaMedico',
            'metaAssinaturaMedicoTime',
            'metaAssinaturaMedicoIP',
            'Assine aqui (Responsável)'
        );

        assinaturaPaciente = new CanvasSignature(
            'canvasAssinaturaPaciente',
            null,
            'btnLimparAssinaturaPaciente',
            'metaAssinaturaPacienteTime',
            'metaAssinaturaPacienteIP',
            'Assine aqui (Paciente)'
        );
    }

    // Configura e sincroniza o carimbo/assinatura do perfil
    var chk = document.getElementById('chkUsarCarimbo');
    if (chk) {
        // Se o médico tem assinatura cadastrada, marca por padrão
        if (medicoAtivo && medicoAtivo.assinatura_url) {
            chk.checked = true;
        } else {
            chk.checked = false;
            chk.disabled = true;
        }

        sincronizarEstadoCarimbo();

        chk.addEventListener('change', function () {
            if (!chk.checked) {
                if (assinaturaMedico) {
                    assinaturaMedico.clear();
                }
            }
            sincronizarEstadoCarimbo();
        });
    }

    // Ouvinte para sincronização de abas em tempo real
    window.addEventListener('storage', function (e) {
        if (e.key === 'medico_ativo' || !e.key) {
            var medico = JSON.parse(localStorage.getItem('medico_ativo') || '{}');
            if (medico && medico.id) {
                medicoAtivo = medico;
                
                // Se o perfil ficou incompleto por alteração externa, redireciona
                if (!verificarPerfilCompleto(medicoAtivo)) {
                    window.location.href = 'medico-dashboard.html?openProfile=true';
                    return;
                }

                // Recarrega avatar e nome
                var mNameEl = document.getElementById('medicoNome');
                var mAvatar = document.getElementById('medicoAvatar');
                if (mNameEl && medicoAtivo.nome) {
                    mNameEl.textContent = 'Dr(a). ' + medicoAtivo.nome;
                }
                if (mAvatar && medicoAtivo.nome) {
                    mAvatar.src = 'https://ui-avatars.com/api/?name=' +
                        encodeURIComponent(medicoAtivo.nome) + '&background=6366f1&color=fff';
                }
                
                sincronizarEstadoCarimbo();
            }
        }
    });
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

        var rawText = await response.text();
        var data = {};
        if (rawText && rawText.trim()) {
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.warn('[app] Webhook retornou texto não-JSON:', rawText.substring(0, 200));
                throw new Error('Resposta inválida do servidor de IA. Tente novamente.');
            }
        }

        console.log('[app] Webhook status:', response.status, 'data keys:', Object.keys(data));

        if (data.success || data.consulta_id || data.dados_extraidos || data.hda) {
            consultaIdGlobal = data.consulta_id || data.id || consultaIdGlobal;
            _preencherFormulario(data);
            document.getElementById('gravacaoContainer').classList.add('hidden');
            document.getElementById('resultadoProntuario').classList.remove('hidden');
            window.showToast('Prontuário gerado!', 'success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (!response.ok) {
            throw new Error(data.message || data.error || 'Erro HTTP ' + response.status);
        } else {
            // response.ok (200) mas sem dados reconhecidos — provavelmente erro interno no n8n
            throw new Error(data.message || 'O servidor processou a requisição mas não retornou dados do prontuário. Verifique o paciente e tente novamente.');
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
    btnAprovar.onclick = async function () {
        var isLM = medicoAtivo && (medicoAtivo.tipo_clinica === 'lm' || medicoAtivo.tipo_clinica === 'demo');
        if (isLM) {
            await aprovarConsultaLM();
        } else {
            var chk = document.getElementById('chkUsarCarimbo');
            var usarCarimbo = chk && chk.checked;
            if (!usarCarimbo && assinaturaMedico && assinaturaMedico.isEmpty()) {
                window.showToast('Por favor, insira a assinatura do profissional responsável antes de aprovar.', 'warning');
                return;
            }
            abrirModalAssinatura();
        }
    };
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

        var chk = document.getElementById('chkUsarCarimbo');
        var usarCarimbo = chk && chk.checked;

        // Captura assinaturas e metadados
        var assinaturaMedicoBase64 = null;
        var medicoMetadata = null;

        if (usarCarimbo) {
            if (medicoAtivo && medicoAtivo.assinatura_url) {
                try {
                    var signedUrl = window.getSignedUrlForFile ? await window.getSignedUrlForFile(medicoAtivo.assinatura_url) : medicoAtivo.assinatura_url;
                    assinaturaMedicoBase64 = await urlToBase64(signedUrl);
                } catch (e) {
                    console.error('[Atendimento] Erro convertendo assinatura:', e);
                    assinaturaMedicoBase64 = medicoAtivo.assinatura_url;
                }
            }
            medicoMetadata = {
                timestamp: new Date().toISOString(),
                ip: (assinaturaMedico && assinaturaMedico.auditMetadata) ? assinaturaMedico.auditMetadata.ip : "N/I",
                userAgent: navigator.userAgent,
                resolution: `${window.screen.width}x${window.screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                usar_carimbo: true
            };
        } else {
            assinaturaMedicoBase64 = assinaturaMedico ? assinaturaMedico.toPNG() : null;
            medicoMetadata = assinaturaMedico ? assinaturaMedico.getMetadata() : null;
        }

        var assinaturaPacienteBase64 = assinaturaPaciente ? assinaturaPaciente.toPNG() : null;
        var assinaturaMetadados = {
            medico: medicoMetadata,
            paciente: assinaturaPaciente ? assinaturaPaciente.getMetadata() : null
        };

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
            assinatura_medico_base64: assinaturaMedicoBase64,
            assinatura_paciente_base64: assinaturaPacienteBase64,
            assinatura_metadados: assinaturaMetadados,
            usar_carimbo: usarCarimbo,
            medico_dados: medicoAtivo
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

    // Desabilitar interações com assinaturas e esconder botões "Limpar"
    document.querySelectorAll('.canvas-wrap').forEach(function (wrap) {
        wrap.style.pointerEvents = 'none';
        wrap.style.opacity = '0.7';
    });
    ['btnLimparAssinaturaMedico', 'btnLimparAssinaturaPaciente'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.style.display = 'none';
    });

    var chk = document.getElementById('chkUsarCarimbo');
    if (chk) {
        chk.disabled = true;
        var parent = chk.parentElement;
        if (parent) parent.style.opacity = '0.5';
    }
}

async function _aguardarPDF(consultaId, maxTentativas, intervaloMs) {
    maxTentativas = maxTentativas || 8;
    intervaloMs = intervaloMs || 3000;
    var pdfPath = consultaId + '.pdf';
    for (var i = 0; i < maxTentativas; i++) {
        console.log('[app] Tentativa ' + (i + 1) + '/' + maxTentativas + ' para buscar PDF...');
        var url = await getSignedUrlIfExists('prontuarios_pdf', pdfPath);
        if (url) {
            console.log('[app] PDF encontrado na tentativa ' + (i + 1));
            return url;
        }
        if (i < maxTentativas - 1) {
            await new Promise(function(r) { setTimeout(r, intervaloMs); });
        }
    }
    console.warn('[app] PDF não encontrado após ' + maxTentativas + ' tentativas');
    return null;
}

async function _concluirAtendimento(payload) {
    document.getElementById('conclusaoAtendimento').classList.remove('hidden');

    var btnPDF = document.getElementById('btnDownloadPDF');
    if (btnPDF) {
        btnPDF.innerHTML = '<i class="ph ph-spinner animate-spin text-2xl"></i> Gerando PDF...';
        btnPDF.removeAttribute('href');
        btnPDF.onclick = function(e) { e.preventDefault(); };
    }

    // Polling: aguarda o n8n gerar o PDF (até ~24s)
    var pdfUrl = await _aguardarPDF(payload.consulta_id, 8, 3000);
    if (btnPDF && pdfUrl) {
        btnPDF.href   = pdfUrl;
        btnPDF.target = '_blank';
        btnPDF.onclick = null;
        btnPDF.innerHTML = '<i class="ph-fill ph-file-pdf text-2xl"></i> BAIXAR PDF';
        window.showToast('PDF do prontuário gerado com sucesso!', 'success');
    } else if (btnPDF) {
        btnPDF.innerHTML = '<i class="ph-fill ph-file-pdf text-2xl"></i> PDF (processando...)';
        btnPDF.onclick = async function(e) {
            e.preventDefault();
            btnPDF.innerHTML = '<i class="ph ph-spinner animate-spin text-2xl"></i> Buscando...';
            var retryUrl = await _aguardarPDF(payload.consulta_id, 5, 3000);
            if (retryUrl) {
                btnPDF.href = retryUrl;
                btnPDF.target = '_blank';
                btnPDF.onclick = null;
                btnPDF.innerHTML = '<i class="ph-fill ph-file-pdf text-2xl"></i> BAIXAR PDF';
                window.open(retryUrl, '_blank');
            } else {
                window.showToast('PDF ainda não disponível. Tente novamente em alguns segundos.', 'warning');
                btnPDF.innerHTML = '<i class="ph-fill ph-file-pdf text-2xl"></i> PDF (processando...)';
            }
        };
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
        btnDL.innerHTML = '<i class="ph ph-spinner animate-spin text-2xl"></i> Gerando PDF...';
        var url = await _aguardarPDF(payload.consulta_id, 8, 3000);
        if (url) {
            btnDL.href = url;
            btnDL.target = '_blank';
            btnDL.onclick = null;
            btnDL.innerHTML = '<i class="ph-fill ph-file-pdf text-2xl"></i> BAIXAR PDF';
        } else {
            btnDL.innerHTML = '<i class="ph-fill ph-file-pdf text-2xl"></i> PDF (processando...)';
        }
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

// ── Métodos para Clínica L&M ──────────────────────────────────────────────────

window.toggleAnamneseCard = function () {
    var content = document.getElementById('anamnese-detalhes-content');
    var icon = document.getElementById('anamnese-toggle-icon');
    if (!content || !icon) return;

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.classList.add('grid');
        icon.className = 'ph-bold ph-caret-up text-slate-400';
    } else {
        content.classList.add('hidden');
        content.classList.remove('grid');
        icon.className = 'ph-bold ph-caret-down text-slate-400';
    }
};

async function carregarAnamneseReadOnly(pacienteId) {
    var container = document.getElementById('anamnese-detalhes-content');
    if (!container || !window.supabaseClient) return;

    container.innerHTML = `
        <div class="col-span-full text-center text-slate-400 py-4">
            <i class="ph-fill ph-spinner animate-spin text-lg mr-1.5"></i> Carregando dados do histórico...
        </div>
    `;

    try {
        var res = await window.supabaseClient
            .from('checklist_anamnese')
            .select('*')
            .eq('paciente_id', pacienteId)
            .limit(1);

        if (res.error) throw res.error;

        if (!res.data || res.data.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center text-slate-400 py-4 font-semibold">
                    Nenhum histórico de anamnese cadastrado para este paciente.
                </div>
            `;
            return;
        }

        var ana = res.data[0];
        
        var simNao = function (val) {
            return val ? '<span class="text-emerald-500 font-bold">Sim</span>' : '<span class="text-slate-400">Não</span>';
        };

        container.innerHTML = `
            <div class="space-y-3">
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Doenças Crônicas</p>
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200">${simNao(ana.has_doencas_cronicas)}</p>
                </div>
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Alergias</p>
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200">${simNao(ana.has_alergias)}</p>
                </div>
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Medicamentos em Uso Contínuo</p>
                    <p class="text-xs font-semibold text-slate-750 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50 mt-0.5">${ana.uso_continuo || 'Nenhum'}</p>
                </div>
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Tabagismo ou Etilismo</p>
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200">${simNao(ana.tabagismo_etilismo)}</p>
                </div>
            </div>

            <div class="space-y-3">
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Cicatriação Anormal</p>
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200">${simNao(ana.historico_cicatrizacao_anormal)}</p>
                </div>
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Cirurgias Anteriores</p>
                    <p class="text-xs font-semibold text-slate-750 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50 mt-0.5">${ana.cirurgias_anteriores || 'Nenhuma'}</p>
                </div>
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Condições de Pele</p>
                    <p class="text-xs font-semibold text-slate-750 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50 mt-0.5">${ana.condicoes_pele || 'Nenhuma'}</p>
                </div>
                <div>
                    <p class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Histórico Familiar</p>
                    <p class="text-xs font-semibold text-slate-750 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50 mt-0.5">${ana.historico_familiar || 'Sem registros'}</p>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('[Anamnese] Erro ao carregar:', e);
        container.innerHTML = `
            <div class="col-span-full text-center text-rose-500 py-4 font-bold">
                Erro ao carregar dados do histórico.
            </div>
        `;
    }
}

function ativarModoLm() {
    if (medicoAtivo && (medicoAtivo.tipo_clinica === 'lm' || medicoAtivo.tipo_clinica === 'demo')) {
        var secaoAssin = document.getElementById('secaoAssinaturasStylus');
        if (secaoAssin) secaoAssin.classList.add('hidden');

        var panelAnamnese = document.getElementById('secaoAnamneseReadOnly');
        if (panelAnamnese && pacienteAtual && pacienteAtual.id) {
            panelAnamnese.classList.remove('hidden');
            carregarAnamneseReadOnly(pacienteAtual.id);
        }
    }
}

async function aprovarConsultaLM() {
    if (!consultaIdGlobal) return;

    btnAprovar.disabled = true;
    btnAprovar.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Finalizando...';

    var produtosPayload = window.ProdutoService ? window.ProdutoService.getPayload() : [];

    var payload = {
        consulta_id: consultaIdGlobal,
        conteudo_medico: {
            hda:                  _getVal('hda'),
            exame_fisico:         _getVal('exame_fisico'),
            diagnostico:          _getVal('diagnostico'),
            tratamento:           _getVal('tratamento'),
            produtos_utilizados:  produtosPayload,
            curativo:             null,
        },
        produtos_utilizados: produtosPayload,
        assinatura_medico_base64: null,
        assinatura_paciente_base64: null,
        assinatura_metadados: null,
        usar_carimbo: false,
        medico_dados: medicoAtivo
    };

    // Salva produtos no Supabase se houver
    if (window.supabaseClient && produtosPayload.length > 0) {
        try {
            await window.supabaseClient
                .from('consultas')
                .update({ produtos_utilizados: produtosPayload })
                .eq('id', consultaIdGlobal);
        } catch (e) {
            console.error('[app] Falha ao salvar produtos:', e);
        }
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
            _bloquearFormulario();
            await _concluirAtendimento(payload);
            window.showToast('Consulta finalizada com sucesso!');
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
            window.showToast('Erro ao finalizar: ' + err.message, 'error');
            btnAprovar.disabled = false;
            btnAprovar.innerHTML = 'Tentar Novamente';
        }
    }
}
