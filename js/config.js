/**
 * js/config.js
 * ─────────────────────────────────────────────────────────────
 * Fonte única de verdade para todas as constantes da aplicação.
 * Nunca duplique estas URLs ou nomes de bucket em outros arquivos.
 */

window.AppConfig = {
    WEBHOOK_BASE_URL: 'https://n8n.srv1181762.hstgr.cloud/webhook',
    BUCKETS: {
        PRONTUARIOS_PDF: 'prontuarios_pdf',
        ANEXOS_IMAGENS: 'anexos_imagens',
    },
    SUPABASE_TABLES: {
        CONSULTAS:              'consultas',
        MEDICOS:                'medicos',
        PRODUTOS:               'cicatrize_produtos',
        ASSINATURAS:            'cicatrize_prontuario_assinaturas',
        AUDITORIA:              'cicatrize_auditoria_logs',
    },
};
