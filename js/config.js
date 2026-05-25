/**
 * js/config.js
 * ─────────────────────────────────────────────────────────────
 * Fonte única de verdade para todas as constantes da aplicação.
 * Nunca duplique estas URLs ou nomes de bucket em outros arquivos.
 */

window.AppConfig = {
    WEBHOOK_BASE_URL: 'https://n8n.srv1181762.hstgr.cloud/webhook',
    SUPABASE_URL: 'https://bkkdexuzrjouafrwzdsw.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJra2RleHV6cmpvdWFmcnd6ZHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzMwOTUsImV4cCI6MjA4NTYwOTA5NX0.yxnTQ9CuQKcOrY4aPoWCUpJxFwusHHwHV2fVc5jzVkI',
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
