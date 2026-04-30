/**
 * js/services/produto.service.js
 * ─────────────────────────────────────────────────────────────
 * Gerencia o catálogo de produtos clínicos e as seleções do modal.
 * Estado privado por closure — sem window.* poluídos.
 * Expõe API pública via window.ProdutoService.
 */

(function () {
    'use strict';

    // ── Estado privado ──────────────────────────────────────────
    var _catalogo      = [];   // lista completa do Supabase
    var _selecionados  = {};   // { id: { id, nome, quantidade } }
    var _confirmados   = [];   // array final pós-confirmação

    // ── Supabase ────────────────────────────────────────────────

    /**
     * Carrega produtos da tabela cicatrize_produtos.
     * Usa cache em memória — não bate no Supabase duas vezes.
     */
    async function carregar() {
        if (_catalogo.length > 0) return _catalogo; // cache hit

        var lista = document.getElementById('produtosListaModal');
        if (lista) {
            lista.innerHTML =
                '<div class="flex items-center justify-center py-8 text-slate-400">' +
                '<i class="ph-fill ph-spinner animate-spin text-2xl mr-2"></i>' +
                '<span class="text-sm font-medium">Carregando produtos...</span>' +
                '</div>';
        }

        if (!window.supabaseClient) throw new Error('Supabase não disponível');

        var tabela = window.AppConfig
            ? window.AppConfig.SUPABASE_TABLES.PRODUTOS
            : 'cicatrize_produtos';

        var result = await window.supabaseClient
            .from(tabela)
            .select('id, nome')
            .eq('ativo', true)
            .order('nome', { ascending: true });

        if (result.error) throw result.error;
        _catalogo = result.data || [];
        return _catalogo;
    }

    /**
     * Insere um produto manual no Supabase e o seleciona imediatamente.
     * @param {string} nome
     */
    async function adicionarManual(nome) {
        nome = (nome || '').trim();
        if (!nome) throw new Error('Nome do produto é obrigatório');
        if (!window.supabaseClient) throw new Error('Supabase indisponível');

        var tabela = window.AppConfig
            ? window.AppConfig.SUPABASE_TABLES.PRODUTOS
            : 'cicatrize_produtos';

        var result = await window.supabaseClient
            .from(tabela)
            .insert({ nome: nome, ativo: true, manual: true })
            .select('id, nome')
            .single();

        if (result.error) throw result.error;

        var produto = result.data;
        _catalogo.push(produto);
        _catalogo.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
        _selecionados[produto.id] = { id: produto.id, nome: produto.nome, quantidade: 1 };

        return produto;
    }

    // ── Seleção ─────────────────────────────────────────────────

    function toggle(id, nome) {
        if (_selecionados[id]) {
            delete _selecionados[id];
        } else {
            _selecionados[id] = { id: id, nome: nome, quantidade: 1 };
        }
    }

    function alterarQtd(id, nome, delta) {
        if (!_selecionados[id]) {
            _selecionados[id] = { id: id, nome: nome, quantidade: 1 };
        }
        var nova = Math.max(1, _selecionados[id].quantidade + delta);
        _selecionados[id].quantidade = nova;
        return nova;
    }

    function confirmar() {
        _confirmados = Object.values(_selecionados);
        return _confirmados;
    }

    function filtrar(query) {
        var q = (query || '').toLowerCase().trim();
        return q
            ? _catalogo.filter(function (p) { return p.nome.toLowerCase().includes(q); })
            : _catalogo.slice();
    }

    // ── Getters ─────────────────────────────────────────────────

    function getCatalogo()     { return _catalogo; }
    function getSelecionados() { return _selecionados; }
    function getConfirmados()  { return _confirmados; }

    /**
     * Retorna os produtos no formato esperado pelo payload de aprovação.
     */
    function getPayload() {
        return _confirmados.map(function (p) {
            return {
                produto_id: p.id || null,
                nome:       p.nome,
                quantidade: p.quantidade,
            };
        });
    }

    function limpar() {
        _selecionados = {};
    }

    // ── API pública ─────────────────────────────────────────────
    window.ProdutoService = {
        carregar:       carregar,
        adicionarManual: adicionarManual,
        toggle:         toggle,
        alterarQtd:     alterarQtd,
        confirmar:      confirmar,
        filtrar:        filtrar,
        getCatalogo:    getCatalogo,
        getSelecionados: getSelecionados,
        getConfirmados: getConfirmados,
        getPayload:     getPayload,
        limpar:         limpar,
    };

})();
