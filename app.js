
console.log('[app.js v20260320] VERSÃO COM MODAL DE ASSINATURA carregada.');

// ================= CONFIGURAÇÕES E SELETORES =================

const btnGravar = document.getElementById("btnGravar");
const btnPausar = document.getElementById("btnPausar");
const spacerPausar = document.getElementById("spacerPausar");
const btnProcessarIA = document.getElementById("btnProcessarIA");
const btnRecomecar = document.getElementById("btnRecomecar");
const acoesPosGrava = document.getElementById("acoesPosGrava");
const playerAudio = document.getElementById("playerAudio");
const controlPrincipal = document.getElementById("controlPrincipal");
const hintText = document.getElementById("hintText");
const btnNovoPaciente = document.getElementById("btnNovoPaciente");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const timer = document.getElementById("timer");
const waveformCanvas = document.getElementById("waveformCanvas");

let mediaRecorder;
let audioChunks = [];
let segundos = 0;
let timerInterval = null;
let currentStream = null;
let audioBlobFinal = null;
let consultaIdGlobal = null;
let isRecording = false;
let isPaused = false;

let pacienteAtual = null;
let medicoAtivo = JSON.parse(localStorage.getItem('medico_ativo')) || {};
const WEBHOOK_BASE_URL = "https://n8n.srv1181762.hstgr.cloud/webhook";

async function garantirMedicoId() {
    if (medicoAtivo && medicoAtivo.id) return medicoAtivo.id;

    if (!window.supabaseClient || !window.fetchMedicoData) {
        throw new Error("Sessao medica indisponivel");
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session || !session.user || !session.user.id) {
        throw new Error("Sessao invalida");
    }

    const medicoDb = await window.fetchMedicoData(session.user.id);
    if (!medicoDb || !medicoDb.id) {
        throw new Error("medico_id nao encontrado");
    }

    medicoAtivo = {
        ...medicoAtivo,
        id: medicoDb.id,
        auth_id: session.user.id,
        nome: medicoAtivo.nome || medicoDb.nome || "Dr(a). Medico",
        crm: medicoAtivo.crm || medicoDb.crm || ""
    };
    localStorage.setItem("medico_ativo", JSON.stringify(medicoAtivo));
    return medicoAtivo.id;
}

// ================= INICIALIZAÇÃO =================

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pNome = urlParams.get('paciente');
    const pId = urlParams.get('id');
    const pConvenio = urlParams.get('convenio') || 'Particular';

    const mNameEl = document.getElementById('medicoNome');
    const mAvatarEl = document.getElementById('medicoAvatar');
    garantirMedicoId().then(() => {
        if (mNameEl && medicoAtivo && medicoAtivo.nome) {
            mNameEl.textContent = `Dr(a). ${medicoAtivo.nome}`;
            if (mAvatarEl) {
                mAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(medicoAtivo.nome)}&background=6366f1&color=fff`;
            }
        }
    }).catch(err => console.error(err));

    if (pNome && pId) {
        pacienteAtual = { id: pId, nome: pNome, convenio: pConvenio };

        const nomeEl = document.getElementById('pacienteNome');
        if (nomeEl) nomeEl.textContent = pNome;

        const convEl = document.getElementById('pacienteConvenio');
        if (convEl) convEl.textContent = pConvenio;

        document.title = `Atendimento: ${pNome} | Prontuar.io`;

        const statusBadge = document.getElementById('pacienteStatus');
        if (statusBadge) {
            statusBadge.className = "px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-100 uppercase tracking-widest flex items-center gap-1.5";
            statusBadge.innerHTML = `<div class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div> Em Atendimento`;
        }

        if (btnGravar) btnGravar.disabled = false;
        setRecordingStatus("ready");
    }
});

// ================= UI HELPERS (CUSTOM POPUPS) =================

function showToast(message, type = "success") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = "ph-fill ph-check-circle text-emerald-500";
    if (type === "error") icon = "ph-fill ph-warning-circle text-rose-500";
    if (type === "info") icon = "ph-fill ph-info text-indigo-500";

    toast.innerHTML = `
        <i class="${icon} text-2xl"></i>
        <span class="text-sm font-bold text-slate-700">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showConfirm(title, message, callback) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;

    overlay.style.display = 'flex';

    document.getElementById('confirmOk').onclick = () => {
        overlay.style.display = 'none';
        callback();
    };

    document.getElementById('confirmCancel').onclick = () => {
        overlay.style.display = 'none';
    };
}

function setRecordingStatus(state) {
    switch (state) {
        case "ready":
            statusText.textContent = "Pronto para iniciar atendimento";
            statusDot.className = "w-2 h-2 rounded-full bg-slate-400";
            statusDot.innerHTML = '';
            hintText.textContent = "Clique para começar";
            controlPrincipal.style.display = "flex";
            acoesPosGrava.classList.add("hidden");
            btnPausar.classList.add("hidden");
            if (spacerPausar) spacerPausar.classList.add("hidden");
            break;
        case "recording":
            statusText.textContent = "Gravando consulta...";
            statusDot.className = "w-2 h-2 rounded-full bg-rose-500 animate-pulse";
            statusDot.innerHTML = '';
            hintText.textContent = "Clique para parar";
            btnPausar.classList.remove("hidden");
            if (spacerPausar) spacerPausar.classList.remove("hidden");
            break;
        case "paused":
            statusText.textContent = "Gravação pausada";
            statusDot.className = "w-2 h-2 rounded-full bg-amber-500";
            statusDot.innerHTML = '';
            hintText.textContent = "Clique para retomar";
            break;
        case "finished":
            statusText.textContent = "Áudio capturado";
            statusDot.className = "w-2 h-2 rounded-full bg-emerald-500";
            statusDot.innerHTML = '';
            hintText.style.display = "none";
            controlPrincipal.style.display = "none";
            acoesPosGrava.classList.remove("hidden");
            break;
        case "processing":
            statusText.textContent = "IA analisando áudio...";
            statusDot.className = "loader-7";
            statusDot.innerHTML = '<div class="square"></div>';
            acoesPosGrava.classList.add("opacity-50", "pointer-events-none");
            break;
    }
}

// ================= GRAVAÇÃO DE ÁUDIO =================

async function iniciarGravacao() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentStream = stream;

        const mimeType = getSupportedMimeType();
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            audioBlobFinal = new Blob(audioChunks, { type: mimeType });
            const audioUrl = URL.createObjectURL(audioBlobFinal);
            playerAudio.src = audioUrl;
            setRecordingStatus("finished");
        };

        mediaRecorder.start();
        isRecording = true;
        isPaused = false;
        iniciarTimer();

        btnGravar.innerHTML = `<i class="ph-fill ph-stop text-5xl"></i>`;
        btnGravar.classList.replace('from-indigo-600', 'from-rose-500');
        btnGravar.classList.replace('to-indigo-700', 'to-rose-600');

        setRecordingStatus("recording");
        if (waveformCanvas) desenharOnda(stream);

    } catch (err) {
        console.error("Erro ao acessar microfone:", err);
        showToast("Não foi possível acessar o microfone.", "error");
    }
}

function pararGravacao() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        isRecording = false;
        isPaused = false;
        pararTimer();
        liberarStream();

        btnGravar.innerHTML = `<i class="ph-fill ph-microphone text-5xl"></i>`;
        btnGravar.classList.replace('from-rose-500', 'from-indigo-600');
        btnGravar.classList.replace('to-rose-600', 'to-indigo-700');
    }
}

function togglePause() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    if (!isPaused) {
        mediaRecorder.pause();
        isPaused = true;
        pararTimer();
        setRecordingStatus("paused");
        document.getElementById('iconPausar').className = "ph-fill ph-play text-3xl";
        btnPausar.classList.replace('text-slate-400', 'text-amber-500');
    } else {
        mediaRecorder.resume();
        isPaused = false;
        continuarTimer();
        setRecordingStatus("recording");
        document.getElementById('iconPausar').className = "ph-fill ph-pause text-3xl";
        btnPausar.classList.replace('text-amber-500', 'text-slate-400');
    }
}

function getSupportedMimeType() {
    const types = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg'];
    for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
}

function liberarStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

// ================= TIMER =================

function iniciarTimer() {
    segundos = 0;
    timer.textContent = "00:00";
    continuarTimer();
}

function continuarTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        segundos++;
        const mins = Math.floor(segundos / 60).toString().padStart(2, '0');
        const secs = (segundos % 60).toString().padStart(2, '0');
        timer.textContent = `${mins}:${secs}`;
    }, 1000);
}

function pararTimer() {
    clearInterval(timerInterval);
}

// ================= VISUALIZER =================

function desenharOnda(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const ctx = waveformCanvas.getContext("2d");
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;

    function render() {
        if (!isRecording || isPaused) {
            if (!isRecording) ctx.clearRect(0, 0, width, height);
            if (isRecording && isPaused) requestAnimationFrame(render);
            return;
        }
        requestAnimationFrame(render);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, width, height);
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height;
            ctx.fillStyle = `rgba(79, 70, 229, ${barHeight / height + 0.1})`;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 2;
        }
    }
    render();
}

// ================= EVENTOS =================

btnGravar.onclick = () => {
    if (!isRecording) iniciarGravacao();
    else pararGravacao();
};

if (btnNovoPaciente) {
    btnNovoPaciente.onclick = () => {
        window.location.href = "recepcao.html";
    };
}

btnPausar.onclick = () => togglePause();

btnRecomecar.onclick = () => {
    showConfirm("Recomeçar Gravação", "Isso apagará o áudio atual. Continuar?", () => {
        audioBlobFinal = null;
        playerAudio.src = "";
        timer.textContent = "00:00";
        setRecordingStatus("ready");
    });
};

btnProcessarIA.onclick = () => processarProntuario();

async function processarProntuario() {
    if (!pacienteAtual) return showToast("Selecione um paciente", "error");
    if (!audioBlobFinal) return showToast("Grave primeiro", "error");

    setRecordingStatus("processing");
    btnProcessarIA.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Analisando...`;

    const formData = new FormData();
    formData.append("audio", audioBlobFinal, "consulta.webm");
    formData.append("paciente_id", pacienteAtual.id);
    const medicoId = await garantirMedicoId();
    formData.append("medico_id", medicoId);

    try {
        const authHeaders = await window.getAuthHeaders();
        const response = await fetch(WEBHOOK_BASE_URL + "/novaConsulta", {
            method: "POST",
            headers: {
                ...authHeaders
            },
            body: formData
        });

        const data = await response.json();
        if (data.success || data.consulta_id) {
            consultaIdGlobal = data.consulta_id;
            document.getElementById('gravacaoContainer').classList.add('hidden');
            document.getElementById('resultadoProntuario').classList.remove('hidden');

            document.getElementById('hda').value = data.hda || data.dados_extraidos?.hda || '';
            document.getElementById('exame_fisico').value = data.exame_fisico || data.dados_extraidos?.exame_fisico || '';
            document.getElementById('diagnostico').value = data.diagnostico || data.dados_extraidos?.diagnostico || '';

            // Tratamento + Observações
            let trat = data.tratamento || data.dados_extraidos?.tratamento || '';
            const obs = data.observacoes || data.dados_extraidos?.observacoes || '';
            if (obs && !trat.includes(obs)) {
                trat += `\n\n📌 OBSERVAÇÕES:\n${obs}`;
            }
            document.getElementById('tratamento').value = trat;

            showToast("Prontuário gerado!", "success");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            throw new Error(data.message || "Erro no processamento da IA");
        }
    } catch (err) {
        showToast("Erro: " + err.message, "error");
        setRecordingStatus("finished");
        btnProcessarIA.innerHTML = `<i class="ph-fill ph-sparkle text-2xl"></i> ANALISAR COM IA`;
        acoesPosGrava.classList.remove("opacity-50", "pointer-events-none");
    }
}

// ================= APROVAÇÃO FINAL (COM MODAL DE ASSINATURA LEGAL) =================

const btnAprovar = document.getElementById('btnAprovar');
const btnDescartar = document.getElementById('btnDescartar');

// Elementos do Modal de Assinatura Legal
const modalAssinatura = document.getElementById('modalAssinaturaLegal');
const checkboxAcordo = document.getElementById('checkboxAcordo');
const btnConfirmarAssinatura = document.getElementById('btnConfirmarAssinatura');
const btnCancelarAssinatura = document.getElementById('btnCancelarAssinatura');
const btnFecharModalAssinatura = document.getElementById('btnFecharModalAssinatura');
const labelAcordoAssinatura = document.getElementById('labelAcordoAssinatura');
const timestampAssinatura = document.getElementById('timestampAssinatura');

// Toggle do checkbox -> habilita/desabilita botão de assinar
if (checkboxAcordo) {
    checkboxAcordo.addEventListener('change', () => {
        const isChecked = checkboxAcordo.checked;
        if (btnConfirmarAssinatura) btnConfirmarAssinatura.disabled = !isChecked;
        // Visual feedback no label
        if (labelAcordoAssinatura) {
            if (isChecked) {
                labelAcordoAssinatura.classList.remove('border-slate-200');
                labelAcordoAssinatura.classList.add('border-emerald-400', 'bg-emerald-50/50');
            } else {
                labelAcordoAssinatura.classList.add('border-slate-200');
                labelAcordoAssinatura.classList.remove('border-emerald-400', 'bg-emerald-50/50');
            }
        }
    });
}

function abrirModalAssinatura() {
    // Preencher nome do médico dinamicamente
    const nomeEl = document.getElementById('nomeAssinante');
    if (nomeEl && medicoAtivo && medicoAtivo.nome) {
        nomeEl.textContent = medicoAtivo.nome;
    }
    // Resetar checkbox a cada abertura
    if (checkboxAcordo) {
        checkboxAcordo.checked = false;
        checkboxAcordo.dispatchEvent(new Event('change'));
    }
    // Exibir timestamp atual
    if (timestampAssinatura) {
        const agora = new Date();
        const fmt = agora.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        timestampAssinatura.textContent = `Data/Hora da assinatura: ${fmt}`;
    }
    // Mostrar modal
    if (modalAssinatura) modalAssinatura.style.display = 'flex';
}

function fecharModalAssinatura() {
    if (modalAssinatura) modalAssinatura.style.display = 'none';
}

// Fechar modal com botões
if (btnCancelarAssinatura) btnCancelarAssinatura.onclick = fecharModalAssinatura;
if (btnFecharModalAssinatura) btnFecharModalAssinatura.onclick = fecharModalAssinatura;

// Ao clicar em "Finalizar e Assinar Prontuário" -> abre o modal de confirmação legal
if (btnAprovar) {
    console.log('[app.js] btnAprovar encontrado, onclick configurado para abrir modal.');
    btnAprovar.onclick = () => {
        console.log('[app.js] btnAprovar clicado! consultaIdGlobal =', consultaIdGlobal);
        if (!consultaIdGlobal) {
            // abrindo modal mesmo assim para teste.
        }
        abrirModalAssinatura();
    };
}

// Ao confirmar a assinatura no modal -> executa a aprovação real
if (btnConfirmarAssinatura) {
    btnConfirmarAssinatura.onclick = async () => {
        fecharModalAssinatura();

        if (!consultaIdGlobal) return;

        btnAprovar.disabled = true;
        btnAprovar.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Gerando Documentos...`;

        const payload = {
            consulta_id: consultaIdGlobal,
            conteudo_medico: {
                hda: document.getElementById('hda').value,
                exame_fisico: document.getElementById('exame_fisico').value,
                diagnostico: document.getElementById('diagnostico').value,
                tratamento: document.getElementById('tratamento').value
            }
        };

        try {
            // Promessa com timeout de segurança (25s)
            const authHeaders = await window.getAuthHeaders();
            const fetchPromise = fetch(WEBHOOK_BASE_URL + "/aprovarConsulta", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: JSON.stringify(payload)
            });

            // Se o servidor demorar > 25s, assumimos sucesso otimista e liberamos o PDF
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000));

            let res;
            try {
                res = await Promise.race([fetchPromise, timeoutPromise]);
            } catch (e) {
                if (e.message === 'TIMEOUT') {
                    res = { ok: true, json: () => ({ success: true }) };
                } else {
                    throw e;
                }
            }

            if (res.ok) {
                let result = {};
                try {
                    result = await res.json();
                } catch (e) {
                    result = { success: true };
                }

                document.getElementById('resultadoProntuario').classList.add('hidden');
                document.getElementById('conclusaoAtendimento').classList.remove('hidden');

                // Gerar URL assinada para o Prontuário PDF
                const pdfSignedUrl = await getSignedUrl('prontuarios_pdf', payload.consulta_id + '.pdf');
                const btnPDF = document.getElementById('btnDownloadPDF');
                if (btnPDF && pdfSignedUrl) {
                    btnPDF.href = pdfSignedUrl;
                    btnPDF.target = "_blank";
                    btnPDF.onclick = (e) => {
                        if (!btnPDF.href || btnPDF.href.includes('#')) {
                            e.preventDefault();
                            showToast("PDF ainda sendo gerado, tente em instantes.", "info");
                        }
                    };
                }

                // ── Relatório Fotográfico: Upload para Storage (mesmo padrão do prontuário) ──
                const btnImgPDF = document.getElementById('btnRelatorioImagens');
                const cId = consultaIdGlobal || payload.consulta_id;

                if (window.fotosConsulta && window.fotosConsulta.length > 0) {
                    // 1. Snapshot das fotos ANTES de qualquer async
                    window._fotosParaRelatorio = [...window.fotosConsulta];
                    window._pacienteNomeParaRelatorio = window._pacienteNomeParaRelatorio || pacienteAtual?.nome || 'Paciente';
                    window._medicoNomeParaRelatorio   = window._medicoNomeParaRelatorio   || (medicoAtivo?.nome ? `Dr(a). ${medicoAtivo.nome}` : 'Médico');

                    console.log(`[app.js] 📸 ${window._fotosParaRelatorio.length} foto(s) — iniciando upload`);
                    showToast(`${window.fotosConsulta.length} foto(s) — salvando relatório...`, 'info');

                    // Mostrar botão em estado "carregando" (sem onclick de download)
                    if (btnImgPDF) {
                        btnImgPDF.classList.remove('hidden');
                        btnImgPDF.removeAttribute('href');
                        btnImgPDF.onclick = (e) => e.preventDefault(); // bloqueia clique enquanto carrega
                        btnImgPDF.innerHTML = `<i class="ph ph-spinner animate-spin text-2xl"></i> Salvando...`;
                    }

                    const pId = pacienteAtual ? pacienteAtual.id : null;

                    // 2. Upload fotos individuais para storage + DB
                    if (typeof window.enviarFotos === 'function') {
                        try {
                            const medicoId = await garantirMedicoId();
                            await window.enviarFotos(cId, pId, medicoId);
                            console.log('[app.js] ✅ Fotos individuais salvas');
                        } catch (e) {
                            console.error('[app.js] Upload fotos individuais falhou:', e);
                        }
                    }

                    // 3. Gerar PDF de imagens como blob → upload → gravar URL na tabela consultas
                    //    (SEM download local — mesmo padrão do prontuário PDF)
                    try {
                        const storagePath = await _chamarSalvarRelatorioImagens(cId, pId);

                        if (storagePath && btnImgPDF) {
                            // Gerar signed URL (mesmo padrão do prontuário)
                            const signedUrl = await getSignedUrl('prontuarios_pdf', storagePath);
                            if (signedUrl) {
                                btnImgPDF.href = signedUrl;
                                btnImgPDF.target = '_blank';
                                btnImgPDF.onclick = null; // link direto, sem interceptar
                                btnImgPDF.innerHTML = `<i class="ph-fill ph-images text-2xl"></i> PDF IMAGENS`;
                                console.log('[app.js] ✅ PDF imagens salvo e botão atualizado:', storagePath);
                            }
                        } else if (btnImgPDF) {
                            btnImgPDF.classList.add('hidden');
                            console.error('[app.js] ❌ salvarRelatorioImagensNoStorage retornou null');
                        }
                    } catch (e) {
                        console.error('[app.js] ❌ Salvar PDF imagens FALHOU:', e);
                        if (btnImgPDF) btnImgPDF.classList.add('hidden');
                    }
                } else {
                    // Sem fotos na sessão: tenta buscar relatório salvo anteriormente
                    await _chamarExibirBotaoRelatorioImagens(cId);
                }

                // Atualizar badge
                const badge = document.getElementById('pacienteStatus');
                if (badge) {
                    badge.className = "px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100 uppercase tracking-widest flex items-center gap-1.5";
                    badge.innerHTML = `<i class="ph-fill ph-check-circle"></i> Finalizado`;
                }

                showToast("Prontuário assinado com sucesso!");
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // NÃO reabilitar botão para evitar duplo clique
                return;
            } else {
                const text = await res.text();
                throw new Error(`Erro Servidor: ${res.status}`);
            }

        } catch (err) {
            console.error(err);
            if (err.message.includes('TIMEOUT') || err.message.length < 50) {
                showToast("Processo demorou, mas deve finalizar em breve. Verifique o PDF.", "warning");
                // Força UI de sucesso
                document.getElementById('resultadoProntuario').classList.add('hidden');
                document.getElementById('conclusaoAtendimento').classList.remove('hidden');
                const btnDownloadPDF = document.getElementById('btnDownloadPDF');
                if (btnDownloadPDF) {
                    const fallbackUrl = await getSignedUrl('prontuarios_pdf', payload.consulta_id + '.pdf');
                    if (fallbackUrl) {
                        btnDownloadPDF.href = fallbackUrl;
                        btnDownloadPDF.target = "_blank";
                        btnDownloadPDF.onclick = (e) => {
                            if (!btnDownloadPDF.href || btnDownloadPDF.href.includes('#')) {
                                e.preventDefault();
                                showToast("PDF ainda sendo gerado, tente em instantes.", "info");
                            }
                        };
                    }
                }
                // Tenta buscar imagens mesmo em timeout
                await _chamarExibirBotaoRelatorioImagens(payload.consulta_id);
            } else {
                showToast("Erro ao aprovar: " + err.message, "error");
                btnAprovar.disabled = false;
                btnAprovar.textContent = "Tentar Novamente";
            }
        }
    };
}

// ── Funções de PDF de imagens delegadas ao app-images.js (window.*) ──
// IMPORTANTE: NÃO usar o mesmo nome que window.* para evitar shadowing!
// Funções no escopo global são automaticamente adicionadas ao window,
// sobrescrevendo as implementações reais de app-images.js.

async function _chamarSalvarRelatorioImagens(consultaId, pacienteId) {
    if (typeof window.salvarRelatorioImagensNoStorage === 'function') {
        return window.salvarRelatorioImagensNoStorage(consultaId, pacienteId);
    }
    console.warn('[app.js] window.salvarRelatorioImagensNoStorage não disponível (app-images.js carregado?)');
    return null;
}

async function _chamarExibirBotaoRelatorioImagens(consultaId) {
    if (typeof window.exibirBotaoRelatorioImagens === 'function') {
        return window.exibirBotaoRelatorioImagens(consultaId);
    }
    console.warn('[app.js] window.exibirBotaoRelatorioImagens não disponível (app-images.js carregado?)');
}

if (btnDescartar) {
    btnDescartar.onclick = () => {
        showConfirm("Sair do Atendimento", "Deseja mesmo descartar este atendimento e voltar para a fila?", () => {
            window.location.href = "medico-dashboard.html";
        });
    };
}
