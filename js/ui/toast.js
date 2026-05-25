/**
 * js/ui/toast.js
 * ─────────────────────────────────────────────────────────────
 * Funções de feedback visual para o usuário.
 * Substitui as implementações duplicadas em app.js e app-images.js.
 */

(function () {
    'use strict';

    /**
     * Exibe uma notificação toast temporária.
     * @param {string} message - Texto da mensagem
     * @param {'success'|'error'|'info'|'warning'} type
     */
    /**
     * Exibe uma notificação toast temporária.
     * @param {string} message - Texto da mensagem
     * @param {'success'|'error'|'info'|'warning'|'loading'} type
     * @param {number} [duration] - Tempo de exibição em ms (0 para não remover automaticamente)
     * @returns {HTMLElement} O elemento toast criado
     */
    function showToast(message, type, duration) {
        type = type || 'success';
        if (duration === undefined) {
            duration = 4000;
        }

        var container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);

            if (!document.getElementById('toast-styles-injected')) {
                var style = document.createElement('style');
                style.id = 'toast-styles-injected';
                style.textContent =
                    '.toast-container {' +
                    '    position: fixed;' +
                    '    top: 24px;' +
                    '    right: 24px;' +
                    '    z-index: 9999;' +
                    '    display: flex;' +
                    '    flex-direction: column;' +
                    '    gap: 12px;' +
                    '}' +
                    '.toast {' +
                    '    min-width: 300px;' +
                    '    padding: 16px 20px;' +
                    '    border-radius: 16px;' +
                    '    background: white;' +
                    '    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);' +
                    '    display: flex;' +
                    '    align-items: center;' +
                    '    gap: 12px;' +
                    '    border: 1px solid #f1f5f9;' +
                    '    animation: slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;' +
                    '    transition: opacity 0.3s, transform 0.3s;' +
                    '}' +
                    '@keyframes slideInRight {' +
                    '    from { transform: translateX(100%); opacity: 0; }' +
                    '    to { transform: translateX(0); opacity: 1; }' +
                    '}';
                document.head.appendChild(style);
            }
        }

        var toast = document.createElement('div');
        toast.className = 'toast';

        var icon = 'ph-fill ph-check-circle text-emerald-500';
        if (type === 'error')   icon = 'ph-fill ph-warning-circle text-rose-500';
        if (type === 'info')    icon = 'ph-fill ph-info text-indigo-500';
        if (type === 'warning') icon = 'ph-fill ph-warning text-amber-500';
        if (type === 'loading') icon = 'ph-bold ph-spinner animate-spin text-slate-500';

        toast.innerHTML =
            '<i class="' + icon + ' text-2xl"></i>' +
            '<span class="text-sm font-bold text-slate-700">' + message + '</span>';

        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(function () {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(20px)';
                setTimeout(function () { toast.remove(); }, 300);
            }, duration);
        }

        return toast;
    }

    /**
     * Exibe um modal de confirmação customizado.
     * @param {string} title
     * @param {string} message
     * @param {Function} callback - Executado ao confirmar
     */
    function showConfirm(title, message, callback) {
        var overlay = document.getElementById('confirmOverlay');
        if (!overlay) { if (confirm(message)) callback(); return; }

        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        overlay.style.display = 'flex';

        document.getElementById('confirmOk').onclick = function () {
            overlay.style.display = 'none';
            callback();
        };
        document.getElementById('confirmCancel').onclick = function () {
            overlay.style.display = 'none';
        };
    }

    // Expõe no escopo global — compatível com chamadas inline do HTML (onclick="showToast(...)")
    window.showToast    = showToast;
    window.showConfirm  = showConfirm;

})();
