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
    function showToast(message, type) {
        type = type || 'success';
        var container = document.getElementById('toastContainer');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'toast';

        var icon = 'ph-fill ph-check-circle text-emerald-500';
        if (type === 'error')   icon = 'ph-fill ph-warning-circle text-rose-500';
        if (type === 'info')    icon = 'ph-fill ph-info text-indigo-500';
        if (type === 'warning') icon = 'ph-fill ph-warning text-amber-500';

        toast.innerHTML =
            '<i class="' + icon + ' text-2xl"></i>' +
            '<span class="text-sm font-bold text-slate-700">' + message + '</span>';

        container.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = '0.3s';
            setTimeout(function () { toast.remove(); }, 300);
        }, 4000);
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
