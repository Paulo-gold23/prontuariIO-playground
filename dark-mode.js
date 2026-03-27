// dark-mode.js
(function () {
    // Verifica logica inicial (se havia preferencia antes)
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.documentElement.classList.add('dark');

    window.addEventListener('DOMContentLoaded', () => {
        // Cria estilos dinamicamente
        const style = document.createElement('style');
        style.textContent = `
            /* Backgrounds e Textos Globais */
            html.dark body { background-color: #0f172a !important; color: #f8fafc !important; }
            html.dark .bg-white { background-color: #1e293b !important; border-color: #334155 !important; }
            html.dark .bg-slate-50 { background-color: #1e293b !important; }
            
            /* Textos */
            html.dark .text-slate-900, html.dark .text-slate-800 { color: #f8fafc !important; }
            html.dark .text-slate-700, html.dark .text-slate-600 { color: #cbd5e1 !important; }
            html.dark .text-slate-500 { color: #94a3b8 !important; }
            html.dark .text-slate-400 { color: #64748b !important; }
            
            /* Bordas e Elementos Auxiliares */
            html.dark .border-slate-200, html.dark .border-slate-100 { border-color: #334155 !important; }
            html.dark .divide-slate-100 > :not([hidden]) ~ :not([hidden]) { border-color: #334155 !important; }
            
            /* Campos de Input e Select */
            html.dark input, html.dark textarea, html.dark select, html.dark .custom-select-trigger { 
                background-color: #0f172a !important; 
                color: #f8fafc !important; 
                border-color: #334155 !important; 
            }
            html.dark .custom-options {
                background-color: #1e293b !important;
                border-color: #334155 !important;
            }
            html.dark .option:hover, html.dark li:hover {
                background-color: #334155 !important;
            }
            
            /* Gradients & Fundos Suaves */
            html.dark .bg-gradient-to-br { background: linear-gradient(to bottom right, #1e293b, #0f172a) !important; }
            html.dark .bg-slate-100, html.dark .bg-slate-200 { background-color: #334155 !important; color: #f1f5f9 !important; }
            html.dark .bg-indigo-50 { background-color: rgba(79, 70, 229, 0.15) !important; color: #a5b4fc !important; }
            html.dark .bg-emerald-50 { background-color: rgba(16, 185, 129, 0.15) !important; color: #6ee7b7 !important; }
            html.dark .bg-amber-50 { background-color: rgba(245, 158, 11, 0.15) !important; color: #fcd34d !important; }
            html.dark .bg-rose-50 { background-color: rgba(244, 63, 94, 0.15) !important; color: #fda4af !important; }
            html.dark .bg-indigo-100 { background-color: rgba(79, 70, 229, 0.25) !important; }
            html.dark .bg-emerald-100 { background-color: rgba(16, 185, 129, 0.25) !important; }
            
            /* Sombras ajustadas para o modo escuro */
            html.dark .shadow-sm, html.dark .shadow-md, html.dark .shadow-lg, html.dark .shadow-xl, html.dark .shadow-2xl { 
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5) !important; 
            }

            /* Placeholders */
            html.dark input::placeholder, html.dark textarea::placeholder { color: #475569 !important; }
            
            /* Nav / Header Especifico */
            html.dark nav { border-bottom-color: #334155 !important; background-color: #1e293b !important; }
            html.dark .toast { background: #1e293b !important; border-color: #334155 !important; }
            html.dark .custom-ui-overlay { background: rgba(0, 0, 0, 0.8) !important; }
            
            /* Componentes pequenos que o theme-toggle usa e Hovers da Fila */
            html.dark .hover\\:bg-slate-100:hover { background-color: #334155 !important; }
            html.dark .hover\\:bg-slate-50:hover { background-color: #334155 !important; }
            html.dark .hover\\:bg-slate-50\\/50:hover { background-color: #334155 !important; }
            html.dark .bg-slate-50\\/50 { background-color: transparent !important; }
            html.dark .bg-slate-50\\/30 { background-color: transparent !important; }
            html.dark .text-slate-500 { color: #94a3b8 !important; }
            
            /* Correções de Contraste para Ícones, Badges e Nomes (Modo Escuro) */
            html.dark .text-indigo-600, html.dark .text-indigo-700 { color: #818cf8 !important; }
            html.dark .text-emerald-600, html.dark .text-emerald-700 { color: #34d399 !important; }
            html.dark .text-amber-600, html.dark .text-amber-700 { color: #fbbf24 !important; }
            html.dark .text-rose-500, html.dark .text-rose-600, html.dark .text-rose-700 { color: #fb7185 !important; }
            
            /* Hover do nome na fila (Group Hover) */
            html.dark .group:hover .group-hover\\:text-indigo-700 { color: #a5b4fc !important; }
            html.dark .group:hover .group-hover\\:text-emerald-500 { color: #34d399 !important; }
            html.dark .group:hover .group-hover\\:text-white { color: #ffffff !important; }
        `;
        document.head.appendChild(style);

        // Não cria mais o botão voador no Javascript.
        // Apenas controla qualquer botao que tenha o ID #theme-toggle.
        const btns = document.querySelectorAll('#theme-toggle');

        function updateIcon() {
            const isDarkActive = document.documentElement.classList.contains('dark');
            btns.forEach(btn => {
                btn.innerHTML = isDarkActive
                    ? '<i class="ph-bold ph-sun text-xl text-amber-400"></i>'
                    : '<i class="ph-bold ph-moon text-xl text-indigo-500"></i>';
            });
        }

        updateIcon();

        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const isNowDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
                updateIcon();
            });
        });
    });
})();
