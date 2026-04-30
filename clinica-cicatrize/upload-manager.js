/**
 * upload-manager.js — Módulo de Upload de Imagens (Clínica Cicatrize)
 * Responsabilidade: upload, listagem e exclusão de imagens no bucket 'anexos_imagens'
 * Dependências: window.supabaseClient (auth-guard.js deve ser carregado antes)
 * PDF Thumbnails: PDF.js (Mozilla) carregado via CDN
 */

const UploadManager = (() => {
  const BUCKET = 'anexos_imagens';
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
  const EXTENSOES_ACEITAS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf'];

  // ─── Helpers internos ──────────────────────────────────────────────────────

  function _getSupabase() {
    if (!window.supabaseClient) throw new Error('Supabase client não inicializado.');
    return window.supabaseClient;
  }

  function _buildPath(pacienteId, arquivo) {
    const ext = arquivo.name.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    return `${pacienteId}/${timestamp}_${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  }

  function _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _isPDF(mimeType, nomeArquivo) {
    return mimeType === 'application/pdf' || nomeArquivo?.toLowerCase().endsWith('.pdf');
  }

  /**
   * Renderiza a primeira página de um PDF num elemento <canvas>
   * Usa PDF.js (carregado via CDN no <head>)
   * @param {string} pdfUrl — URL assinada do PDF
   * @param {HTMLCanvasElement} canvas
   */
  async function _renderPdfThumbnail(pdfUrl, canvas) {
    try {
      // PDF.js precisa ser carregado via CDN — verificar disponibilidade
      if (!window.pdfjsLib) return;

      // Worker path do CDN
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

      const loadingTask = window.pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      // Escala para caber no card (quadrado ~140px)
      const viewport = page.getViewport({ scale: 1 });
      const scale = 140 / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'cover';

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

      // Esconder o placeholder e mostrar o canvas
      const placeholder = canvas.closest('.pdf-thumb-wrap')?.querySelector('.pdf-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      canvas.style.display = 'block';

    } catch (e) {
      // Falha silenciosa — mantém o ícone placeholder
      console.warn('[UploadManager] PDF thumbnail falhou:', e.message);
    }
  }

  // ─── API Pública ───────────────────────────────────────────────────────────

  /**
   * Faz upload de um arquivo para o Storage e salva metadata em paciente_imagens
   * @param {File} arquivo
   * @param {string} pacienteId
   * @param {string} medicoId
   * @param {string|null} consultaId — opcional
   * @param {string} descricao — opcional
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async function uploadArquivo(arquivo, pacienteId, medicoId, consultaId = null, descricao = '') {
    // Validação de tipo
    if (!TIPOS_ACEITOS.includes(arquivo.type) && !EXTENSOES_ACEITAS.some(e => arquivo.name.toLowerCase().endsWith(e))) {
      return { success: false, error: `Tipo de arquivo não permitido. Use: ${EXTENSOES_ACEITAS.join(', ')}` };
    }
    // Validação de tamanho
    if (arquivo.size > MAX_SIZE_BYTES) {
      return { success: false, error: `Arquivo muito grande. Máximo permitido: 10MB. Seu arquivo: ${_formatBytes(arquivo.size)}` };
    }

    const supabase = _getSupabase();
    const storagePath = _buildPath(pacienteId, arquivo);

    // 1. Upload para o Storage
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arquivo, { upsert: false });

    if (storageErr) {
      return { success: false, error: `Erro no upload: ${storageErr.message}` };
    }

    // 2. Salvar metadata no banco
    const { data: dbData, error: dbErr } = await supabase
      .from('paciente_imagens')
      .insert({
        paciente_id: pacienteId,
        medico_id: medicoId,
        consulta_id: consultaId || null,
        storage_path: storagePath,
        nome_arquivo: arquivo.name,
        mime_type: arquivo.type,
        tamanho_bytes: arquivo.size,
        descricao: descricao || null,
        data_captura: new Date().toISOString().split('T')[0],
        grupo_evolucao: 'cicatrize'
      })
      .select()
      .single();

    if (dbErr) {
      // Tentar remover do Storage para evitar arquivo órfão
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return { success: false, error: `Erro ao salvar registro: ${dbErr.message}` };
    }

    return { success: true, data: dbData };
  }

  /**
   * Lista todas as imagens de um paciente
   * @param {string} pacienteId
   * @returns {Promise<Array>}
   */
  async function listarImagens(pacienteId) {
    const supabase = _getSupabase();
    const { data, error } = await supabase
      .from('paciente_imagens')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  /**
   * Gera Signed URL para visualização de um arquivo
   * @param {string} storagePath
   * @param {number} expiresIn — segundos (default 300 = 5min)
   * @returns {Promise<string|null>}
   */
  async function getUrlAssinada(storagePath, expiresIn = 300) {
    const supabase = _getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  /**
   * Exclui uma imagem do Storage e do banco
   * @param {string} imagemId — UUID do registro em paciente_imagens
   * @param {string} storagePath
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function excluirImagem(imagemId, storagePath) {
    const supabase = _getSupabase();

    // 1. Remover do Storage
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (storageErr) return { success: false, error: `Erro ao remover arquivo: ${storageErr.message}` };

    // 2. Remover do banco
    const { error: dbErr } = await supabase.from('paciente_imagens').delete().eq('id', imagemId);
    if (dbErr) return { success: false, error: `Arquivo removido, mas erro ao atualizar banco: ${dbErr.message}` };

    return { success: true };
  }

  // ─── Feedback Visual ───────────────────────────────────────────────────────

  /**
   * Exibe um toast de feedback dentro do modal de upload
   * @param {'success'|'error'|'loading'} tipo
   * @param {string} mensagem
   * @param {number} duracao — ms (0 = permanente até dismiss manual)
   * @returns {HTMLElement} o toast (para remover programaticamente)
   */
  function _showToast(tipo, mensagem, duracao = 4000) {
    // Remover toast anterior se existir
    document.querySelectorAll('.upload-toast').forEach(t => t.remove());

    const cores = {
      success: 'bg-emerald-600 text-white shadow-emerald-200',
      error:   'bg-rose-600 text-white shadow-rose-200',
      loading: 'bg-slate-800 text-white shadow-slate-300'
    };
    const icones = {
      success: 'ph-check-circle',
      error:   'ph-x-circle',
      loading: 'ph-spinner animate-spin'
    };

    const toast = document.createElement('div');
    toast.className = `upload-toast fixed z-[2000] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl
      text-sm font-bold transition-all duration-300 opacity-0 translate-y-2
      ${cores[tipo]}`;

    // Posicionar dentro do modal de imagens (relativo à viewport mas acima do modal)
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(8px);
      z-index: 2000;
      max-width: calc(100vw - 32px);
      white-space: nowrap;
    `;

    toast.innerHTML = `
      <i class="ph-bold ${icones[tipo]} text-lg shrink-0"></i>
      <span>${mensagem}</span>
      ${tipo !== 'loading' ? `<button onclick="this.closest('.upload-toast').remove()" class="ml-1 opacity-70 hover:opacity-100 transition-opacity">
        <i class="ph-bold ph-x text-sm"></i>
      </button>` : ''}
    `;

    document.body.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });
    });

    // Auto-remover
    if (duracao > 0) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(8px)';
        setTimeout(() => toast.remove(), 300);
      }, duracao);
    }

    return toast;
  }

  /**
   * Aplica animação de "salvo com sucesso" no primeiro card do grid
   */
  function _animarCardNovo(grid) {
    const primeiroCard = grid?.firstElementChild;
    if (!primeiroCard || !primeiroCard.classList.contains('upload-item')) return;

    // Ring verde pulsa por 1.5s
    primeiroCard.style.boxShadow = '0 0 0 3px #10b981';
    primeiroCard.style.transition = 'box-shadow 0.3s ease';

    // Badge "Salvo" aparece no canto
    const badge = document.createElement('div');
    badge.className = 'absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-full uppercase tracking-wider z-10 upload-novo-badge';
    badge.textContent = '✓ Salvo';
    primeiroCard.appendChild(badge);

    setTimeout(() => {
      primeiroCard.style.boxShadow = '';
      badge.style.opacity = '0';
      badge.style.transition = 'opacity 0.4s ease';
      setTimeout(() => badge.remove(), 400);
    }, 2500);
  }

  // ─── Render de UI ──────────────────────────────────────────────────────────

  /**
   * Renderiza o grid de thumbnails numa div alvo
   * @param {Array} imagens — resultado de listarImagens()
   * @param {HTMLElement} container
   */
  async function renderGrid(imagens, container) {
    container.innerHTML = '';

    if (imagens.length === 0) {
      container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center p-10 text-center">
          <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <i class="ph ph-image text-3xl text-slate-300"></i>
          </div>
          <p class="text-sm font-bold text-slate-400">Nenhuma imagem cadastrada</p>
          <p class="text-xs text-slate-300 mt-1">Arraste ou clique no botão acima para adicionar</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    // Gerar URLs assinadas em paralelo
    const urlsPromises = imagens.map(img => getUrlAssinada(img.storage_path, 3600));
    const urls = await Promise.all(urlsPromises);

    for (let i = 0; i < imagens.length; i++) {
      const img = imagens[i];
      const url = urls[i];
      if (!url) continue;

      const isPdf = _isPDF(img.mime_type, img.nome_arquivo);
      const dataFmt = img.data_captura
        ? new Date(img.data_captura + 'T00:00:00').toLocaleDateString('pt-BR')
        : new Date(img.created_at).toLocaleDateString('pt-BR');

      const item = document.createElement('div');
      item.className = 'upload-item relative bg-white border border-slate-100 rounded-2xl overflow-hidden group hover:border-emerald-200 hover:shadow-lg transition-all duration-300';
      item.dataset.id = img.id;
      item.dataset.path = img.storage_path;

      item.innerHTML = `
        <!-- Thumbnail -->
        <a href="${url}" target="_blank" class="block aspect-square bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer">
          ${isPdf
            ? `<div class="pdf-thumb-wrap w-full h-full relative flex items-center justify-center">
                 <!-- Placeholder visível até o canvas renderizar -->
                 <div class="pdf-placeholder flex flex-col items-center gap-1.5 text-rose-400">
                   <i class="ph-bold ph-file-pdf text-5xl"></i>
                   <span class="text-[9px] font-black uppercase tracking-wider text-slate-400">PDF</span>
                 </div>
                 <!-- Canvas onde PDF.js vai renderizar a 1ª página -->
                 <canvas class="pdf-thumb-canvas hidden absolute inset-0 w-full h-full" style="display:none;"></canvas>
               </div>`
            : `<img src="${url}" alt="${img.nome_arquivo}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />`
          }
        </a>
        <!-- Info + Actions -->
        <div class="p-3">
          <p class="text-[10px] font-black text-slate-700 truncate mb-1" title="${img.nome_arquivo}">${img.nome_arquivo}</p>
          <p class="text-[9px] text-slate-400 font-medium">${dataFmt} · ${_formatBytes(img.tamanho_bytes || 0)}</p>
          ${img.descricao ? `<p class="text-[9px] text-slate-500 mt-1 italic truncate">${img.descricao}</p>` : ''}
        </div>
        <!-- Actions Overlay -->
        <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a href="${url}" target="_blank"
             class="w-7 h-7 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:bg-white shadow-sm transition-all"
             title="Abrir em nova aba">
            <i class="ph-bold ph-arrow-square-out text-xs"></i>
          </a>
          <button onclick="UploadManager.confirmarExclusao('${img.id}', '${img.storage_path}', this)"
             class="w-7 h-7 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-white shadow-sm transition-all"
             title="Excluir arquivo">
            <i class="ph-bold ph-trash text-xs"></i>
          </button>
        </div>`;

      fragment.appendChild(item);
    }

    container.appendChild(fragment);

    // Renderizar thumbnail do PDF assincronamente após inserir no DOM
    setTimeout(() => {
      container.querySelectorAll('.upload-item').forEach((item, index) => {
        if (_isPDF(imagens[index].mime_type, imagens[index].nome_arquivo)) {
          const canvas = item.querySelector('.pdf-thumb-canvas');
          if (canvas) _renderPdfThumbnail(urls[index], canvas);
        }
      });
    }, 100);
  }

  /**
   * Exibe o modal de confirmação customizado e aguarda decisão do usuário
   * @param {string} nomeArquivo
   * @returns {Promise<boolean>}
   */
  function _confirmarModal(nomeArquivo) {
    return new Promise((resolve) => {
      const modal = document.getElementById('modalConfirmarExclusao');
      const nomeEl = document.getElementById('exclusao-nome-arquivo');
      const btnConfirmar = document.getElementById('exclusao-btn-confirmar');
      const btnCancelar = document.getElementById('exclusao-btn-cancelar');
      const backdrop = document.getElementById('exclusao-backdrop');

      if (!modal) {
        // Fallback caso o modal não exista no HTML
        resolve(window.confirm(`Excluir "${nomeArquivo}"? Esta ação não pode ser desfeita.`));
        return;
      }

      // Preencher nome do arquivo
      if (nomeEl) nomeEl.textContent = nomeArquivo;

      // Abrir modal
      modal.classList.remove('hidden');

      // Limpeza e resolução
      function fechar(resultado) {
        modal.classList.add('hidden');
        btnConfirmar.removeEventListener('click', onConfirmar);
        btnCancelar.removeEventListener('click', onCancelar);
        backdrop.removeEventListener('click', onCancelar);
        resolve(resultado);
      }

      function onConfirmar() { fechar(true); }
      function onCancelar() { fechar(false); }

      btnConfirmar.addEventListener('click', onConfirmar);
      btnCancelar.addEventListener('click', onCancelar);
      backdrop.addEventListener('click', onCancelar);
    });
  }

  /**
   * Confirma e executa exclusão de uma imagem
   */
  async function confirmarExclusao(imagemId, storagePath, btn) {
    // Extrair nome do arquivo do path (último segmento sem timestamp prefix)
    const segmentos = storagePath.split('/');
    const nomeRaw = segmentos[segmentos.length - 1] || 'arquivo';
    // Remover timestamp prefix: "1714000000000_nome.ext" → "nome.ext"
    const nomeArquivo = nomeRaw.replace(/^\d+_/, '');

    const confirmado = await _confirmarModal(nomeArquivo);
    if (!confirmado) return;

    const item = btn.closest('.upload-item');
    if (item) { item.style.opacity = '0.5'; item.style.pointerEvents = 'none'; }

    const result = await excluirImagem(imagemId, storagePath);
    if (result.success) {
      item?.remove();
      _showToast('success', `"${nomeArquivo}" excluído com sucesso.`, 3500);
      // Verificar se grid ficou vazio
      const grid = document.getElementById('upload-grid');
      if (grid && grid.querySelectorAll('.upload-item').length === 0) {
        grid.innerHTML = `
          <div class="col-span-full flex flex-col items-center justify-center p-10 text-center">
            <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <i class="ph ph-image text-3xl text-slate-300"></i>
            </div>
            <p class="text-sm font-bold text-slate-400">Nenhuma imagem cadastrada</p>
            <p class="text-xs text-slate-300 mt-1">Arraste ou clique no botão acima para adicionar</p>
          </div>`;
      }
    } else {
      if (item) { item.style.opacity = '1'; item.style.pointerEvents = ''; }
      _showToast('error', `Erro ao excluir: ${result.error}`, 6000);
    }
  }


  /**
   * Inicializa a zona de upload numa aba do modal
   * @param {string} pacienteId
   * @param {string} medicoId
   */
  async function initUploadZone(pacienteId, medicoId) {
    const zona = document.getElementById('upload-zona');
    const grid = document.getElementById('upload-grid');
    const input = document.getElementById('upload-input');
    const btn = document.getElementById('upload-btn');
    const statusEl = document.getElementById('upload-status');

    if (!zona || !grid || !input) return;

    // Carregar imagens existentes
    try {
      statusEl.textContent = 'Carregando...';
      const imagens = await listarImagens(pacienteId);
      statusEl.textContent = '';
      await renderGrid(imagens, grid);
    } catch (e) {
      statusEl.textContent = 'Erro ao carregar imagens.';
    }

    // Drag & Drop
    zona.addEventListener('dragover', (e) => {
      e.preventDefault();
      zona.classList.add('border-emerald-400', 'bg-emerald-50/50');
    });
    zona.addEventListener('dragleave', () => {
      zona.classList.remove('border-emerald-400', 'bg-emerald-50/50');
    });
    zona.addEventListener('drop', (e) => {
      e.preventDefault();
      zona.classList.remove('border-emerald-400', 'bg-emerald-50/50');
      const files = Array.from(e.dataTransfer.files);
      files.forEach(f => processarUpload(f, pacienteId, medicoId, grid, statusEl));
    });

    // Click to upload
    btn?.addEventListener('click', () => input.click());
    input?.addEventListener('change', (e) => {
      Array.from(e.target.files).forEach(f => processarUpload(f, pacienteId, medicoId, grid, statusEl));
      e.target.value = ''; // reset para permitir re-upload do mesmo arquivo
    });
  }

  let uploadsPendentes = 0;

  /**
   * Processa um único arquivo (valida + faz upload + atualiza UI)
   */
  async function processarUpload(arquivo, pacienteId, medicoId, grid, statusEl) {
    uploadsPendentes++;
    const medicoLocal = JSON.parse(localStorage.getItem('medico_ativo') || '{}');
    const medicoIdFinal = medicoId || medicoLocal.id;

    // Toast de loading (permanente até concluir)
    const toastLoading = _showToast('loading', `Enviando “${arquivo.name}”...`, 0);

    // Limpar status antigo
    if (statusEl) statusEl.textContent = '';

    const result = await uploadArquivo(arquivo, pacienteId, medicoIdFinal, null, '');

    // Remover toast de loading
    toastLoading.remove();

    if (!result.success) {
      _showToast('error', `Erro ao enviar: ${result.error}`, 6000);
    } else {
      // Toast de sucesso bem visível
      _showToast('success', `“${arquivo.name}” salvo com sucesso!`, 4000);
    }

    uploadsPendentes--;

    // Recarregar grid e animar o card novo apenas quando todos os uploads simultâneos terminarem
    if (uploadsPendentes === 0) {
      try {
        const imagens = await listarImagens(pacienteId);
        await renderGrid(imagens, grid);
        _animarCardNovo(grid);
      } catch (e) { /* sem crash */ }
    }
  }

  // Expor API
  return {
    uploadArquivo,
    listarImagens,
    getUrlAssinada,
    excluirImagem,
    confirmarExclusao,
    renderGrid,
    initUploadZone,
    processarUpload,
    showToast: _showToast
  };
})();

// Expor globalmente
window.UploadManager = UploadManager;
