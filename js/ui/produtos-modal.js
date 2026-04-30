/**
 * js/ui/produtos-modal.js
 * ─────────────────────────────────────────────────────────────
 * Renderização do modal de produtos clínicos.
 * Delega toda a lógica de dados ao ProdutoService.
 * Expõe funções globais chamadas pelo HTML inline (onclick="...").
 */

(function () {
    'use strict';

    // ── Renderização ────────────────────────────────────────────

    function renderizarLista(produtos) {
        var lista = document.getElementById('produtosListaModal');
        if (!lista) return;

        var selecionados = window.ProdutoService.getSelecionados();

        if (!produtos || produtos.length === 0) {
            lista.innerHTML = '<p class="text-center text-slate-400 text-sm py-6">Nenhum produto encontrado.</p>';
            return;
        }

        lista.innerHTML = produtos.map(function (p) {
            var sel = selecionados[p.id];
            var isSelected = !!sel;
            var qty = sel ? sel.quantidade : 1;
            var nomeEsc = p.nome.replace(/'/g, "\\'");

            return '<div class="produto-item ' + (isSelected ? 'selected' : '') + '" id="produto-item-' + p.id + '"' +
                   ' onclick="_uiToggleProduto(\'' + p.id + '\', \'' + nomeEsc + '\')">' +
                   '<div class="flex-shrink-0">' +
                   '<div class="prod-check w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ' +
                   (isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300') + '">' +
                   (isSelected ? '<i class="ph-bold ph-check text-white text-[10px]"></i>' : '') +
                   '</div></div>' +
                   '<span class="prod-nome flex-1 text-sm font-semibold leading-snug">' + p.nome + '</span>' +
                   '<div class="prod-controls flex items-center gap-1.5 flex-shrink-0 ' + (isSelected ? '' : 'opacity-30 pointer-events-none') + '" onclick="event.stopPropagation()">' +
                   '<button onclick="_uiAlterarQtd(\'' + p.id + '\', \'' + nomeEsc + '\', -1)" class="prod-btn w-7 h-7 rounded-lg text-base font-bold flex items-center justify-center transition-all">−</button>' +
                   '<span id="qty-' + p.id + '" class="prod-qty w-6 text-center text-sm font-black">' + qty + '</span>' +
                   '<button onclick="_uiAlterarQtd(\'' + p.id + '\', \'' + nomeEsc + '\', 1)" class="prod-btn w-7 h-7 rounded-lg text-base font-bold flex items-center justify-center transition-all">+</button>' +
                   '</div></div>';
        }).join('');
    }

    function atualizarContadorModal() {
        var total = Object.keys(window.ProdutoService.getSelecionados()).length;
        var el = document.getElementById('produtosContadorModal');
        if (!el) return;
        if (total > 0) {
            el.textContent = total + ' selecionado(s)';
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    function renderizarChips() {
        var container = document.getElementById('produtosChipsContainer');
        var display   = document.getElementById('produtosSelecionadosDisplay');
        var hint      = document.getElementById('produtosVazioHint');
        var badge     = document.getElementById('produtosBadge');

        if (!container || !display || !hint) return;

        var confirmados = window.ProdutoService.getConfirmados();

        if (confirmados.length === 0) {
            display.classList.add('hidden');
            hint.classList.remove('hidden');
            if (badge) badge.classList.add('hidden');
            return;
        }

        container.innerHTML = confirmados.map(function (p) {
            return '<span class="produto-chip">' + p.nome +
                   '<span class="chip-qty">× ' + p.quantidade + '</span></span>';
        }).join('');

        display.classList.remove('hidden');
        hint.classList.add('hidden');

        if (badge) {
            badge.textContent = confirmados.length;
            badge.classList.remove('hidden');
        }
    }

    // ── Modal Open/Close ────────────────────────────────────────

    async function abrirModalProdutos() {
        var overlay = document.getElementById('modalProdutosOverlay');
        if (!overlay) return;

        var busca = document.getElementById('produtosBusca');
        if (busca) busca.value = '';

        overlay.style.display = 'flex';

        try {
            await window.ProdutoService.carregar();
        } catch (err) {
            console.error('[ProdutosModal] Falha ao carregar:', err);
            var lista = document.getElementById('produtosListaModal');
            if (lista) {
                lista.innerHTML = '<div class="text-center py-6 text-rose-500 text-sm font-medium">' +
                    '<i class="ph-fill ph-warning-circle text-2xl block mb-1"></i>' +
                    'Falha ao carregar produtos. Tente novamente.</div>';
            }
            return;
        }

        renderizarLista(window.ProdutoService.getCatalogo());
        atualizarContadorModal();
    }

    function fecharModalProdutos() {
        var overlay = document.getElementById('modalProdutosOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    function confirmarSelecaoProdutos() {
        window.ProdutoService.confirmar();
        fecharModalProdutos();
        renderizarChips();
    }

    // ── Handlers inline (chamados pelo HTML onclick="...") ──────

    function _uiToggleProduto(id, nome) {
        window.ProdutoService.toggle(id, nome);

        var item = document.getElementById('produto-item-' + id);
        if (!item) return;

        var isSelected = !!window.ProdutoService.getSelecionados()[id];
        item.classList.toggle('selected', isSelected);

        var checkbox = item.querySelector('.prod-check');
        if (checkbox) {
            checkbox.className = 'prod-check w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ' +
                (isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300');
            checkbox.innerHTML = isSelected ? '<i class="ph-bold ph-check text-white text-[10px]"></i>' : '';
        }

        var controls = item.querySelector('.prod-controls');
        if (controls) {
            controls.classList.toggle('opacity-30', !isSelected);
            controls.classList.toggle('pointer-events-none', !isSelected);
        }

        atualizarContadorModal();
    }

    function _uiAlterarQtd(id, nome, delta) {
        var nova = window.ProdutoService.alterarQtd(id, nome, delta);
        var qtyEl = document.getElementById('qty-' + id);
        if (qtyEl) qtyEl.textContent = nova;
    }

    async function _uiAdicionarProdutoManual() {
        var input = document.getElementById('produtoManualInput');
        var nome = input ? input.value : '';
        var btnAdd = document.querySelector('[onclick="_uiAdicionarProdutoManual()"]');

        if (btnAdd) { btnAdd.disabled = true; btnAdd.innerHTML = '<i class="ph ph-spinner animate-spin"></i>'; }

        try {
            var produto = await window.ProdutoService.adicionarManual(nome);
            if (input) input.value = '';

            var busca = document.getElementById('produtosBusca');
            if (busca) busca.value = '';

            renderizarLista(window.ProdutoService.getCatalogo());
            atualizarContadorModal();
            window.showToast('"' + produto.nome + '" adicionado!', 'success');
        } catch (err) {
            console.error('[ProdutosModal]', err);
            window.showToast(err.message || 'Falha ao salvar produto.', 'error');
        } finally {
            if (btnAdd) { btnAdd.disabled = false; btnAdd.innerHTML = '<i class="ph-bold ph-plus"></i> Adicionar'; }
        }
    }

    function filtrarProdutosModal(query) {
        renderizarLista(window.ProdutoService.filtrar(query));
    }

    // ── Registrar eventos ao carregar DOM ───────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('btnAbrirProdutos');
        if (btn) btn.addEventListener('click', abrirModalProdutos);
    });

    // ── Expõe globals necessários para onclick="..." no HTML ────
    window.fecharModalProdutos        = fecharModalProdutos;
    window.confirmarSelecaoProdutos   = confirmarSelecaoProdutos;
    window.filtrarProdutosModal       = filtrarProdutosModal;
    window._toggleProduto             = _uiToggleProduto;
    window._alterarQtd                = _uiAlterarQtd;
    window.adicionarProdutoManual     = _uiAdicionarProdutoManual;
    window.ProdutosModal              = {
        renderizarLista:   renderizarLista,
        renderizarChips:   renderizarChips,
        abrirModalProdutos: abrirModalProdutos,
    };

})();
