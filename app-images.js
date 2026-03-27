/**
 * app-images.js — Clínica Demo | prontuar.IO
 * Modal de câmera ao vivo (WebRTC) + upload de arquivo.
 * Gera relatório fotográfico PDF client-side (sem depender do n8n).
 *
 * Expõe globalmente:
 *   window.fotosConsulta          → Array<{ file, dataUrl, timestamp, descricao }>
 *   window.capturarFoto()         → Abre o modal de câmera
 *   window.fecharFotoAmpliada()   → Fecha overlay fullscreen
 *   window.enviarFotos(...)       → Upload para Supabase + n8n (opcional)
 *   window.gerarRelatorioImagens()→ Gera e baixa PDF client-side
 */

console.log('[app-images.js] v2.0 — Modal câmera prontuar.IO carregado.');

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ──────────────────────────────────────────────────────────────────────────────

const IMG_SUPABASE_URL     = 'https://bkkdexuzrjouafrwzdsw.supabase.co';
const IMG_SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJra2RleHV6cmpvdWFmcnd6ZHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzMwOTUsImV4cCI6MjA4NTYwOTA5NX0.yxnTQ9CuQKcOrY4aPoWCUpJxFwusHHwHV2fVc5jzVkI';
const IMG_BUCKET           = 'anexos_imagens';
const IMG_WEBHOOK          = 'https://n8n.srv1181762.hstgr.cloud/webhook';

// ──────────────────────────────────────────────────────────────────────────────
// ESTADO GLOBAL
// ──────────────────────────────────────────────────────────────────────────────

/** @type {Array<{ file: File|null, dataUrl: string, timestamp: string, descricao: string }>} */
window.fotosConsulta = [];

let _cameraStream = null;    // stream WebRTC ativo
let _modalMode    = 'menu';  // 'menu' | 'camera' | 'preview'
let _pendingDataUrl = null;  // foto tirada, aguardando confirmação

// ──────────────────────────────────────────────────────────────────────────────
// SETUP DO MODAL (event listeners — HTML já existe no atendimento.html)
// ──────────────────────────────────────────────────────────────────────────────

function setupModalCamera() {
    // Já configurado (DOMContentLoaded chamou antes)
    if (window._imgModalSetup) return;
    window._imgModalSetup = true;

    const el = (id) => document.getElementById(id);

    // Fechar com Escape
    document.addEventListener('keydown', (e) => {
        const overlay = el('modalCameraOverlay');
        if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
            fecharModalCamera();
        }
    });

    el('btnAbrirCamera')?.addEventListener('click', () => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            const inputNativo = el('inputCameraNativa');
            if (inputNativo) {
                inputNativo.click();
                return;
            }
        }
        iniciarCameraAoVivo();
    });
    el('btnAbrirUpload')  ?.addEventListener('click', () => el('inputArquivoFoto')?.click());
    el('inputArquivoFoto')?.addEventListener('change', onArquivoSelecionado);
    el('inputCameraNativa')?.addEventListener('change', onArquivoSelecionado);

    // Toolbar câmera
    el('btnVoltarAoMenu')?.addEventListener('click', () => exibirTela('menu'));
    el('btnTirarFoto')   ?.addEventListener('click', tirarFoto);
    el('btnTrocarCamera')?.addEventListener('click', trocarCamera);

    // Toolbar preview
    el('btnRecapturar')   ?.addEventListener('click', () => exibirTela('camera'));
    el('btnConfirmarFoto')?.addEventListener('click', confirmarFoto);
}

// Dispara o setup assim que o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupModalCamera);
} else {
    setupModalCamera();
}

// ──────────────────────────────────────────────────────────────────────────────
// CONTROLE DE TELAS DO MODAL
// ──────────────────────────────────────────────────────────────────────────────

function exibirTela(tela) {
    _modalMode = tela;

    // Usa classList para respeitar Tailwind hidden (!important)
    const telas = {
        menu:    document.getElementById('cameraTelaMenu'),
        camera:  document.getElementById('cameraTelaCamera'),
        preview: document.getElementById('cameraTelaPreview'),
    };
    Object.entries(telas).forEach(([key, el]) => {
        if (!el) return;
        if (key === tela) {
            el.classList.remove('hidden');
            // garante display flex (sub-divs precisam de flex-col)
            if (key !== 'menu') el.style.display = 'flex';
        } else {
            el.classList.add('hidden');
            el.style.display = '';
        }
    });

    const titulos = {
        menu:    ['Registrar Foto',   'Escolha como adicionar a imagem'],
        camera:  ['Câmera ao Vivo',   'Posicione e tire a foto'],
        preview: ['Confirmar Foto',   'Revise antes de salvar'],
    };
    const t = document.getElementById('modalCameraTitulo');
    const s = document.getElementById('modalCameraSubtitulo');
    if (t) t.textContent = titulos[tela][0];
    if (s) s.textContent = titulos[tela][1];

    if (tela !== 'camera') pararCameraStream();
}

// ──────────────────────────────────────────────────────────────────────────────
// CÂMERA AO VIVO (WebRTC)
// ──────────────────────────────────────────────────────────────────────────────

let _facingMode = 'environment'; // começa com câmera traseira

async function iniciarCameraAoVivo() {
    exibirTela('camera');

    const spinner  = document.getElementById('cameraLoadingSpinner');
    const video    = document.getElementById('cameraVideoStream');
    if (spinner) spinner.style.display = 'flex';

    try {
        // Para qualquer stream anterior
        pararCameraStream();

        const constraints = {
            video: {
                facingMode: _facingMode,
                width:  { ideal: 1280 },
                height: { ideal: 720 },
            },
            audio: false,
        };

        _cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = _cameraStream;
        await video.play();
        if (spinner) spinner.style.display = 'none';

    } catch (err) {
        console.warn('[app-images] Câmera indisponível:', err);
        if (spinner) spinner.style.display = 'none';

        // Se câmera não estiver disponível ou sem HTTPS, abre upload como fallback
        pararCameraStream();
        exibirTela('menu');
        showImageToast('⚠️ Câmera não disponível. Use a opção de importar arquivo.');
    }
}

function pararCameraStream() {
    if (_cameraStream) {
        _cameraStream.getTracks().forEach(t => t.stop());
        _cameraStream = null;
    }
    const video = document.getElementById('cameraVideoStream');
    if (video) video.srcObject = null;
}

async function trocarCamera() {
    _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
    await iniciarCameraAoVivo();
}

function tirarFoto() {
    const video  = document.getElementById('cameraVideoStream');
    const canvas = document.getElementById('cameraCanvas');
    if (!video || !canvas || !video.videoWidth) {
        showImageToast('Câmera ainda carregando. Aguarde.', 'warn');
        return;
    }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    _pendingDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    document.getElementById('cameraPreviewImg').src = _pendingDataUrl;
    document.getElementById('cameraDescricao').value = '';
    exibirTela('preview');
}

// ──────────────────────────────────────────────────────────────────────────────
// UPLOAD DE ARQUIVO
// ──────────────────────────────────────────────────────────────────────────────

function onArquivoSelecionado(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    event.target.value = '';

    if (files.length === 1) {
        // Preview antes de confirmar
        const reader = new FileReader();
        reader.onload = (e) => {
            _pendingDataUrl = e.target.result;
            _pendingFile    = files[0];
            document.getElementById('cameraPreviewImg').src = _pendingDataUrl;
            document.getElementById('cameraDescricao').value = '';
            exibirTela('preview');
        };
        reader.readAsDataURL(files[0]);
    } else {
        // Múltiplos arquivos — adiciona direto sem preview individual
        let loaded = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                adicionarFotoAoArray(e.target.result, file, '');
                loaded++;
                if (loaded === files.length) {
                    fecharModalCamera();
                    showImageToast(`${files.length} foto(s) adicionada(s)!`);
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

let _pendingFile = null;

// ──────────────────────────────────────────────────────────────────────────────
// CONFIRMAÇÃO E ARMAZENAMENTO
// ──────────────────────────────────────────────────────────────────────────────

function confirmarFoto() {
    if (!_pendingDataUrl) return;

    const descricao = (document.getElementById('cameraDescricao').value || '').trim();

    // Converte dataUrl para File se veio da câmera (não tem _pendingFile)
    const file = _pendingFile || dataUrlToFile(_pendingDataUrl, `foto_${Date.now()}.jpg`);

    adicionarFotoAoArray(_pendingDataUrl, file, descricao);

    _pendingDataUrl = null;
    _pendingFile    = null;
    fecharModalCamera();
    showImageToast('📷 Foto adicionada com sucesso!');
}

function adicionarFotoAoArray(dataUrl, file, descricao) {
    const timestamp = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    window.fotosConsulta.push({ file, dataUrl, timestamp, descricao });
    renderizarGrid();
}

function dataUrlToFile(dataUrl, filename) {
    const arr  = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
}

// ──────────────────────────────────────────────────────────────────────────────
// ABRIR / FECHAR MODAL
// ──────────────────────────────────────────────────────────────────────────────

window.capturarFoto = function () {
    // O modal já existe no HTML — apenas reseta estado e mostra
    _pendingDataUrl = null;
    _pendingFile    = null;
    exibirTela('menu');
    const overlay = document.getElementById('modalCameraOverlay');
    if (overlay) {
        overlay.classList.remove('hidden'); // remove classe Tailwind (HTML default)
        overlay.style.display = 'flex';
    }
};

function fecharModalCamera() {
    pararCameraStream();
    const overlay = document.getElementById('modalCameraOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('hidden'); // volta para estado inicial
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPATIBILIDADE LEGADA (onFotoSelecionada chamado pelo <input> antigo no HTML)
// ──────────────────────────────────────────────────────────────────────────────

window.onFotoSelecionada = function (event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => adicionarFotoAoArray(e.target.result, file, '');
        reader.readAsDataURL(file);
    });
    event.target.value = '';
};

// ──────────────────────────────────────────────────────────────────────────────
// OVERLAY FOTO AMPLIADA — injetado via JS (display:none default, sem conflito CSS)
// ──────────────────────────────────────────────────────────────────────────────

function injetarOverlayFotoAmpliada() {
    if (document.getElementById('fotoAmpliada')) return;

    const overlay = document.createElement('div');
    overlay.id = 'fotoAmpliada';
    // display:none explicitamente — sem CSS externo que possa sobrescrever
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.92)',
        'z-index:10000', 'display:none',  // <─ NUNCA usar display:flex aqui até o usuário abrir
        'flex-direction:column', 'align-items:center', 'justify-content:center', 'gap:12px',
    ].join(';');

    overlay.innerHTML = `
        <button id="btnFecharFotoAmpliada" style="
            position:absolute;top:16px;right:16px;
            background:rgba(255,255,255,0.1);border:none;border-radius:50%;
            width:44px;height:44px;cursor:pointer;
            display:flex;align-items:center;justify-content:center;
            color:rgba(255,255,255,0.7);font-size:22px;transition:all 0.2s;
        " onmouseenter="this.style.background='rgba(255,255,255,0.2)';this.style.color='#fff'"
          onmouseleave="this.style.background='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.7)'">
            <i class="ph-bold ph-x"></i>
        </button>
        <img id="fotoAmpliadaImg" src="" alt="" style="
            max-width:90vw;max-height:80vh;object-fit:contain;border-radius:12px;
            box-shadow:0 25px 60px rgba(0,0,0,0.5);
        ">
        <p id="fotoAmpliadaTimestamp" style="
            color:rgba(255,255,255,0.45);font-size:11px;font-family:monospace;font-weight:700;
        "></p>
    `;

    document.body.appendChild(overlay);

    // Fechar ao clicar no fundo
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fecharFotoAmpliadaInterno();
    });
    document.getElementById('btnFecharFotoAmpliada').onclick = fecharFotoAmpliadaInterno;

    // Fechar com Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.style.display !== 'none') fecharFotoAmpliadaInterno();
    });
}

function fecharFotoAmpliadaInterno() {
    const overlay = document.getElementById('fotoAmpliada');
    if (overlay) overlay.style.display = 'none';
}

// API pública — chamada pelo onclick inline do HTML legado (se existir)
window.fecharFotoAmpliada = fecharFotoAmpliadaInterno;

function abrirFotoAmpliada(dataUrl, timestamp) {
    injetarOverlayFotoAmpliada();
    const overlay = document.getElementById('fotoAmpliada');
    const img     = document.getElementById('fotoAmpliadaImg');
    const ts      = document.getElementById('fotoAmpliadaTimestamp');
    if (!overlay || !img) return;
    img.src = dataUrl;
    if (ts) ts.textContent = timestamp || '';
    overlay.style.display = 'flex'; // agora sim, mostra como flex
}

// ──────────────────────────────────────────────────────────────────────────────
// GRID DE FOTOS
// ──────────────────────────────────────────────────────────────────────────────

function renderizarGrid() {
    const container = document.getElementById('fotosContainer');
    const grid      = document.getElementById('fotosGrid');
    const contador  = document.getElementById('fotosContador');
    if (!grid) return;

    const n = window.fotosConsulta.length;
    if (container) container.classList.toggle('hidden', n === 0);
    if (contador)  contador.textContent = `${n} foto${n !== 1 ? 's' : ''}`;

    grid.innerHTML = '';

    window.fotosConsulta.forEach(({ dataUrl, timestamp, descricao }, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'foto-thumb group relative cursor-pointer rounded-xl overflow-hidden aspect-square border-2 border-transparent hover:border-indigo-400 transition-all shadow-sm';
        thumb.innerHTML = `
            <img src="${dataUrl}" alt="Foto ${idx + 1}" class="w-full h-full object-cover" />
            <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white px-1 py-0.5 pointer-events-none">
                <p style="font-size:8px;font-weight:700;truncate;">${timestamp}</p>
                ${descricao ? `<p style="font-size:7px;color:rgba(255,255,255,0.7);">${descricao}</p>` : ''}
            </div>
            <button onclick="event.stopPropagation();window.removerFoto(${idx})"
                class="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 flex items-center justify-center"
                title="Remover foto">
                <i class="ph-bold ph-x" style="font-size:9px;"></i>
            </button>
        `;
        thumb.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            abrirFotoAmpliada(dataUrl, timestamp);
        });
        grid.appendChild(thumb);
    });
}

window.removerFoto = function (idx) {
    window.fotosConsulta.splice(idx, 1);
    renderizarGrid();
};

// ──────────────────────────────────────────────────────────────────────────────
// TOAST INTERNO (não depende do app.js)
// ──────────────────────────────────────────────────────────────────────────────

function showImageToast(msg, type = 'success') {
    if (typeof window.showToast === 'function') {
        window.showToast(msg, type === 'warn' ? 'info' : type);
        return;
    }
    const t = document.createElement('div');
    t.style.cssText = `
        position:fixed;top:24px;right:24px;z-index:99999;
        background:white;border-radius:14px;padding:14px 20px;
        box-shadow:0 10px 30px rgba(0,0,0,0.12);border:1px solid #f1f5f9;
        font-family:'Inter',sans-serif;font-size:13px;font-weight:700;color:#1e293b;
        display:flex;align-items:center;gap:10px;
        animation:slideInR 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
    `;
    t.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='0.3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ──────────────────────────────────────────────────────────────────────────────
// UPLOAD PARA SUPABASE STORAGE (mantido para integração com n8n)
// ──────────────────────────────────────────────────────────────────────────────

async function uploadParaStorage(file, pacienteId, consultaId, idx) {
    const ext = (file.name || '').split('.').pop() || 'jpg';
    const storagePath = `${pacienteId}/${consultaId || 'sem-consulta'}/foto_${Date.now()}_${idx}.${ext}`;

    // Preferência 1: Supabase SDK (já autenticado, mais confiável)
    if (window.supabaseClient?.storage) {
        let uploadOk = false;
        for (let t = 0; t < 3; t++) {
            const { error } = await window.supabaseClient.storage
                .from(IMG_BUCKET)
                .upload(storagePath, file, {
                    contentType: file.type || 'image/jpeg',
                    upsert: true,
                });
            if (!error) { uploadOk = true; break; }
            console.warn(`[app-images] Upload foto SDK tentativa ${t + 1}:`, error);
            if (t < 2) await new Promise(r => setTimeout(r, 1000));
        }
        if (uploadOk) return storagePath;
        console.warn('[app-images] SDK falhou 3×, tentando REST...');
    }

    // Fallback: fetch REST com token da sessão
    let authToken = IMG_SUPABASE_ANON;
    try {
        const sessionStr = localStorage.getItem('prontuar_session');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            if (session?.access_token) authToken = session.access_token;
        }
    } catch (e) { /* usa anon */ }

    const uploadUrl = `${IMG_SUPABASE_URL}/storage/v1/object/${IMG_BUCKET}/${storagePath}`;
    const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': file.type || 'image/jpeg',
            'x-upsert': 'true',
        },
        body: file,
    });

    if (!res.ok) throw new Error(`Storage upload falhou: ${await res.text().catch(() => res.status)}`);
    return storagePath;
}

window.enviarFotos = async function (consultaId, pacienteId, medicoId, grupoEvolucao = 'geral') {
    if (!window.fotosConsulta.length) return [];
    if (!medicoId)   { console.warn('[app-images] medicoId ausente'); return []; }
    if (!pacienteId) { console.warn('[app-images] pacienteId ausente'); return []; }

    const erros = [], enviadas = [];

    for (let idx = 0; idx < window.fotosConsulta.length; idx++) {
        const { file, timestamp, descricao } = window.fotosConsulta[idx];
        try {
            const storagePath = await uploadParaStorage(file, pacienteId, consultaId, idx);
            const payload = {
                medico_id: medicoId, paciente_id: pacienteId, consulta_id: consultaId || null,
                grupo_evolucao: grupoEvolucao,
                descricao: descricao || `Foto capturada em ${timestamp}`,
                nome_arquivo: file.name || `foto_${idx}.jpg`,
                mime_type: file.type || 'image/jpeg',
                tamanho_bytes: file.size || 0,
                storage_path: storagePath,
            };

            // Tenta 1: registro via webhook n8n
            let registrado = false;
            try {
                const regRes = await fetch(`${IMG_WEBHOOK}/uploadFotosConsulta`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (regRes.ok) {
                    enviadas.push(await regRes.json());
                    registrado = true;
                }
            } catch (webhookErr) {
                console.warn(`[app-images] Webhook indisponível, usando fallback DB:`, webhookErr.message);
            }

            // Fallback: insere direto no Supabase via SDK
            if (!registrado && window.supabaseClient) {
                const { data, error } = await window.supabaseClient
                    .from('paciente_imagens')
                    .insert({
                        paciente_id: pacienteId,
                        consulta_id: consultaId || null,
                        medico_id: medicoId,
                        clinica_id: window._clinicaIdAtual || null,
                        grupo_evolucao: grupoEvolucao,
                        descricao: descricao || `Foto capturada em ${timestamp}`,
                        nome_arquivo: file.name || `foto_${idx}.jpg`,
                        mime_type: file.type || 'image/jpeg',
                        tamanho_bytes: file.size || 0,
                        storage_path: storagePath,
                    })
                    .select()
                    .single();

                if (!error) {
                    enviadas.push(data);
                    console.log(`[app-images] ✅ Foto ${idx + 1} registrada via SDK (fallback)`);
                } else {
                    console.warn(`[app-images] Fallback DB falhou:`, error);
                    erros.push({ idx, err: error.message });
                }
            }
        } catch (err) {
            console.warn(`[app-images] Erro foto ${idx + 1}:`, err);
            erros.push({ idx, err: err.message });
        }
    }

    console.log(`[app-images] ${enviadas.length} enviada(s), ${erros.length} erro(s)`);
    return enviadas;
};

// ──────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE RELATÓRIO FOTOGRÁFICO PDF (client-side, sem n8n)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Gera e baixa um PDF do relatório fotográfico diretamente no browser.
 * Usa jsPDF (carregado via CDN quando necessário).
 *
 * @param {object} opts
 * @param {string} opts.pacienteNome
 * @param {string} opts.medicoNome
 * @param {string} opts.consultaId
 * @returns {Promise<void>}
 */
window.gerarRelatorioFotografico = async function ({ pacienteNome = 'Paciente', medicoNome = 'Médico', consultaId = '', returnBlob = false } = {}) {
    if (!window.fotosConsulta.length && !window._fotosParaRelatorio?.length) {
        showImageToast('Nenhuma foto para gerar o relatório.', 'warn');
        return;
    }

    const fotos = window._fotosParaRelatorio || window.fotosConsulta;

    // Carrega jsPDF dinamicamente se não estiver disponível
    if (!window.jspdf) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload  = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PAG_W = 210, PAG_H = 297;
    const MARGIN = 15;
    const dataHoje = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    // ── Capa ─────────────────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PAG_W, 55, 'F');

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO FOTOGRÁFICO', MARGIN, 28);

    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('prontuar.IO — Clínica Demo', MARGIN, 36);

    // Linha verde
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 55, PAG_W, 3, 'F');

    // Info do cabeçalho
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');

    const infoY = 70;
    doc.text(`Paciente:`, MARGIN, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(pacienteNome, MARGIN + 22, infoY);

    doc.setFont('helvetica', 'bold');
    doc.text(`Médico:`, MARGIN, infoY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(medicoNome, MARGIN + 22, infoY + 8);

    doc.setFont('helvetica', 'bold');
    doc.text(`Data:`, MARGIN, infoY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(dataHoje, MARGIN + 22, infoY + 16);

    if (consultaId) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Consulta:`, MARGIN, infoY + 24);
        doc.setFont('helvetica', 'normal');
        doc.text(String(consultaId).slice(0, 20), MARGIN + 22, infoY + 24);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`Total de fotos:`, MARGIN, infoY + 32);
    doc.setFont('helvetica', 'normal');
    doc.text(String(fotos.length), MARGIN + 32, infoY + 32);

    // Linha separadora
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, infoY + 40, PAG_W - MARGIN, infoY + 40);

    // ── Fotos em grade 2x2 por página ─────────────────────────────────────────
    const FOTO_W  = 85;
    const FOTO_H  = 70;
    const GAP     = 8;
    const COLS    = 2;
    const START_Y = infoY + 50;

    let col = 0, row = 0, currentY = START_Y;
    let isFirstPage = true;

    for (let i = 0; i < fotos.length; i++) {
        const { dataUrl, timestamp, descricao } = fotos[i];

        // Nova página se necessário
        if (!isFirstPage && col === 0 && row === 0) {
            doc.addPage();
            currentY = MARGIN + 10;
        }

        const x = MARGIN + col * (FOTO_W + GAP);
        const y = currentY + row * (FOTO_H + 20);

        // Borda da foto
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x - 1, y - 1, FOTO_W + 2, FOTO_H + 2, 3, 3, 'S');

        // Imagem
        try {
            const imgObj = new Image();
            await new Promise((resolve) => {
                imgObj.onload = resolve;
                imgObj.onerror = resolve;
                imgObj.src = dataUrl;
            });

            const iW = imgObj.width || FOTO_W;
            const iH = imgObj.height || FOTO_H;
            const scale = Math.min(FOTO_W / iW, FOTO_H / iH);
            const finalW = iW * scale;
            const finalH = iH * scale;

            const xPos = x + (FOTO_W - finalW) / 2;
            const yPos = y + (FOTO_H - finalH) / 2;

            doc.addImage(dataUrl, 'JPEG', xPos, yPos, finalW, finalH, undefined, 'MEDIUM');
        } catch (e) {
            // Se a imagem falhar, placeholder
            doc.setFillColor(248, 250, 252);
            doc.rect(x, y, FOTO_W, FOTO_H, 'F');
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text('Imagem indisponível', x + FOTO_W / 2, y + FOTO_H / 2, { align: 'center' });
        }

        // Número da foto
        doc.setFillColor(79, 70, 229);
        doc.circle(x + 6, y + 6, 4, 'F');
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(String(i + 1), x + 6, y + 7.5, { align: 'center' });

        // Timestamp
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text(`📅 ${timestamp}`, x, y + FOTO_H + 5);

        // Descrição (se houver)
        if (descricao) {
            doc.setFontSize(7);
            doc.setTextColor(51, 65, 85);
            const descLines = doc.splitTextToSize(descricao, FOTO_W);
            doc.text(descLines[0], x, y + FOTO_H + 12);
        }

        // Avançar posição
        col++;
        if (col >= COLS) {
            col = 0;
            row++;
            if (row >= 3 && i < fotos.length - 1) {
                row = 0;
                isFirstPage = false;
                doc.addPage();
                currentY = MARGIN + 10;
            }
        }
        isFirstPage = false;
    }

    // ── Rodapé ────────────────────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, PAG_H - 14, PAG_W, 14, 'F');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`prontuar.IO — Relatório Fotográfico Confidencial — Gerado em ${dataHoje}`, MARGIN, PAG_H - 5);
        doc.text(`Página ${p} de ${totalPages}`, PAG_W - MARGIN, PAG_H - 5, { align: 'right' });
    }

    // Retornar blob (para upload ao Storage) ou fazer download direto
    if (returnBlob) {
        return doc.output('blob');
    }
    const filename = `relatorio_fotos_${pacienteNome.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
    showImageToast('📄 Relatório fotográfico gerado!');
};

/**
 * Gera o PDF de imagens e faz upload para o Supabase Storage,
 * retornando o storagePath para uso no histórico.
 * NÃO faz download local.
 */
window.gerarRelatorioImagens = async function (consultaId) {
    if (!consultaId) return null;

    // Apenas persiste no Storage (SEM download local)
    try {
        const storagePath = await window.salvarRelatorioImagensNoStorage(consultaId, null);
        return storagePath;
    } catch (e) {
        console.error('[app-images] Upload PDF imagens falhou:', e);
    }
    return null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Listar / Remover (mantidos para compatibilidade)
// ──────────────────────────────────────────────────────────────────────────────

window.listarImagensPaciente = async function (pacienteId) {
    try {
        const res = await fetch(`${IMG_WEBHOOK}/listarImagensPaciente?paciente_id=${encodeURIComponent(pacienteId)}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('[app-images] Falha ao listar:', err);
        return [];
    }
};

window.removerImagemDB = async function (imagemId, medicoId) {
    try {
        const res = await fetch(`${IMG_WEBHOOK}/removerImagem`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: imagemId, medico_id: medicoId }),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('[app-images] Falha ao remover:', err);
        return null;
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// PERSISTÊNCIA DO PDF DE IMAGENS NO SUPABASE STORAGE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Gera o PDF de imagens como blob, faz upload para prontuarios_pdf/{consultaId}-imagens.pdf
 * e salva o anexo_imagens_url na tabela consultas.
 *
 * Chamado pelo app.js na etapa de aprovação do prontuário.
 *
 * @param {string} consultaId
 * @param {string|null} _pacienteId  (ignorado — mantido por compatibilidade de assinatura)
 * @returns {Promise<string|null>} URL pública do PDF ou null se falhar
 */
window.salvarRelatorioImagensNoStorage = async function (consultaId, _pacienteId) {
    if (!consultaId) {
        console.error('[app-images] salvarRelatorioImagensNoStorage: consultaId ausente!');
        return null;
    }

    const fotosSource = window._fotosParaRelatorio?.length ? '_fotosParaRelatorio' : 
                        window.fotosConsulta?.length ? 'fotosConsulta' : null;
    if (!fotosSource) {
        console.error('[app-images] ❌ ZERO fotos disponíveis para PDF de imagens!',
            { _fotosParaRelatorio: window._fotosParaRelatorio?.length || 0,
              fotosConsulta: window.fotosConsulta?.length || 0 });
        return null;
    }
    console.log(`[app-images] Gerando PDF com ${fotosSource} (${fotosSource === '_fotosParaRelatorio' ? window._fotosParaRelatorio.length : window.fotosConsulta.length} fotos)`);

    const pacienteNome = window._pacienteNomeParaRelatorio || 'Paciente';
    const medicoNome   = window._medicoNomeParaRelatorio   || 'Médico';

    // 1. Gera o PDF como Blob (sem download)
    const blob = await window.gerarRelatorioFotografico({
        pacienteNome, medicoNome, consultaId, returnBlob: true
    });
    if (!blob) {
        console.error('[app-images] ❌ gerarRelatorioFotografico retornou null/undefined!');
        return null;
    }
    console.log(`[app-images] PDF blob gerado: ${(blob.size / 1024).toFixed(1)} KB`);

    // 2. Upload via Supabase SDK (preferido) ou fetch REST como fallback
    const storagePath = `${consultaId}_imagens.pdf`; // underscore para consistência com app.js

    if (window.supabaseClient?.storage) {
        // Usa SDK do Supabase (já autenticado, sem risco de token anon)
        let uploadOk = false;
        for (let t = 0; t < 3; t++) {
            const { error } = await window.supabaseClient.storage
                .from('prontuarios_pdf')
                .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });
            if (!error) { uploadOk = true; break; }
            console.warn(`[app-images] Upload tentativa ${t + 1}:`, error);
            if (t < 2) await new Promise(r => setTimeout(r, 1500));
        }
        if (!uploadOk) throw new Error('Upload PDF imagens falhou após 3 tentativas');

        // Salva caminho relativo na coluna (getSignedUrl vai gerar URL quando necessário)
        const { error: dbError } = await window.supabaseClient
            .from('consultas')
            .update({ anexo_imagens_url: storagePath, updated_at: new Date().toISOString() })
            .eq('id', consultaId);
        if (dbError) console.warn('[app-images] Update consultas:', dbError);

        console.log('[app-images] ✅ PDF imagens persistido via SDK:', storagePath);
        return storagePath; // retorna path relativo; quem quiser URL usa getSignedUrl
    }

    // Fallback: fetch REST com token da sessão
    let authToken = IMG_SUPABASE_ANON;
    try {
        const session = JSON.parse(localStorage.getItem('prontuar_session') || '{}');
        if (session?.access_token) authToken = session.access_token;
    } catch (e) { /* usa anon */ }

    const uploadUrl = `${IMG_SUPABASE_URL}/storage/v1/object/prontuarios_pdf/${storagePath}`;
    const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
        body: blob,
    });
    if (!uploadRes.ok) {
        const err = await uploadRes.text().catch(() => uploadRes.status);
        throw new Error(`Upload PDF imagens (REST) falhou: ${err}`);
    }

    // Salva path relativo na coluna
    await fetch(`${IMG_SUPABASE_URL}/rest/v1/consultas?id=eq.${consultaId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${authToken}`, 'apikey': IMG_SUPABASE_ANON,
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ anexo_imagens_url: storagePath, updated_at: new Date().toISOString() }),
    }).catch(e => console.warn('[app-images] PATCH consultas:', e));

    console.log('[app-images] ✅ PDF imagens persistido via REST:', storagePath);
    return storagePath;
};

/**
 * Verifica se existe um PDF de imagens para a consulta e exibe um botão de
 * download/link na interface. Chamado pelo app.js após aprovação (fallback
 * para quando não há fotos em memória mas o arquivo já existe no storage).
 *
 * @param {string} consultaId
 * @returns {Promise<void>}
 */
window.exibirBotaoRelatorioImagens = async function (consultaId) {
    if (!consultaId) return;

    const btn = document.getElementById('btnRelatorioImagens');
    if (!btn) return;

    try {
        if (!window.supabaseClient?.storage) return;

        // Tenta até 3× com delay (webhook pode ainda estar gravando)
        let storagePath = null;
        for (let t = 0; t < 3; t++) {
            const { data: row, error } = await window.supabaseClient
                .from('consultas')
                .select('anexo_imagens_url')
                .eq('id', consultaId)
                .single();

            if (!error && row?.anexo_imagens_url) {
                storagePath = row.anexo_imagens_url;
                break;
            }
            if (t < 2) await new Promise(r => setTimeout(r, 2000));
        }

        // Fallback: tenta o caminho padrão mesmo que não esteja no DB
        if (!storagePath) storagePath = `${consultaId}_imagens.pdf`;

        const { data: signed, error: signErr } = await window.supabaseClient.storage
            .from('prontuarios_pdf')
            .createSignedUrl(storagePath, 3600); // 1 hora

        if (signErr || !signed?.signedUrl) return; // Arquivo não existe

        btn.classList.remove('hidden');
        btn.href    = signed.signedUrl;
        btn.target  = '_blank';
        btn.onclick = null;
        btn.innerHTML = `<i class="ph-fill ph-images text-2xl"></i> PDF IMAGENS`;
        showImageToast('📸 Relatório de imagens disponível!');

    } catch (err) {
        console.error('[app-images] exibirBotaoRelatorioImagens:', err);
    }
};
