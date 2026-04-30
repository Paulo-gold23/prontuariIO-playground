/**
 * js/services/assinatura.service.js
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade única: registrar assinatura digital no Supabase.
 * Sem manipulação de DOM. Retorna dados para o orquestrador tratar.
 */

(function () {
    'use strict';

    var TABELAS = window.AppConfig && window.AppConfig.SUPABASE_TABLES;

    /**
     * Busca o IP público do cliente.
     * @returns {Promise<string>}
     */
    async function fetchIpOrigem() {
        try {
            var res = await fetch('https://api.ipify.org?format=json');
            var data = await res.json();
            return data && data.ip ? data.ip : '0.0.0.0';
        } catch (_) {
            return '0.0.0.0';
        }
    }

    /**
     * Gera hash SHA-256 de um texto.
     * @param {string} texto
     * @returns {Promise<string>} hex string
     */
    async function gerarHash(texto) {
        var msgBuffer = new TextEncoder().encode(texto);
        var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        var hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    /**
     * Registra a assinatura digital + log de auditoria no Supabase.
     *
     * @param {Object} opts
     * @param {string} opts.consultaId
     * @param {string} opts.medicoId
     * @param {Object} opts.payload    - Conteúdo médico para derivar o hash
     * @returns {Promise<{hashHex: string, ipOrigem: string}>}
     */
    async function registrar({ consultaId, medicoId, payload }) {
        if (!window.supabaseClient) {
            throw new Error('supabaseClient não disponível');
        }

        var ipOrigem = await fetchIpOrigem();

        var textoParaHash =
            consultaId +
            (payload.diagnostico || '') +
            (payload.tratamento || '') +
            new Date().getTime();

        var hashHex = await gerarHash(textoParaHash);

        var tabelas = (window.AppConfig && window.AppConfig.SUPABASE_TABLES) || {
            ASSINATURAS: 'cicatrize_prontuario_assinaturas',
            AUDITORIA:   'cicatrize_auditoria_logs',
        };

        // Insere assinatura (ignora duplicata 23505)
        var resAssinatura = await window.supabaseClient
            .from(tabelas.ASSINATURAS)
            .insert({
                consulta_id:    consultaId,
                medico_id:      medicoId,
                hash_documento: hashHex,
                ip_assinatura:  ipOrigem,
                ambiente:       'cicatrize',
            });

        if (resAssinatura.error && resAssinatura.error.code !== '23505') {
            console.error('[AssinaturaService] Falha ao registrar assinatura:', resAssinatura.error);
        }

        // Registra log de auditoria
        await window.supabaseClient
            .from(tabelas.AUDITORIA)
            .insert({
                tipo_evento:  'PRONTUARIO_ASSINADO',
                referencia_id: consultaId,
                gerado_por:    medicoId,
                ip_origem:     ipOrigem,
                metadata:      { hash: hashHex },
            });

        return { hashHex: hashHex, ipOrigem: ipOrigem };
    }

    window.AssinaturaService = {
        registrar:    registrar,
        gerarHash:    gerarHash,
        fetchIpOrigem: fetchIpOrigem,
    };

})();
