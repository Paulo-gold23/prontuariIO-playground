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
            html.dark .text-slate-300 { color: #475569 !important; }
            
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
            html.dark input::placeholder, html.dark textarea::placeholder { color: #64748b !important; }

            /* ═══════════════════════════════════════════
               MODAL DARK MODE — SISTEMA DE CAMADAS
               Camada 0 (overlay):  #0f172a
               Camada 1 (modal bg): #1e293b
               Camada 2 (header):   #263147
               Camada 3 (cards):    #2d3d54
               Camada 4 (inputs):   #172032
               ═══════════════════════════════════════════ */

            /* Overlays dos modais */
            html.dark .bg-slate-800\\/40 {
                background-color: rgba(15, 23, 42, 0.8) !important;
            }

            /* Painel principal do modal */
            html.dark .relative.bg-white.rounded-2xl,
            html.dark .relative.bg-white.rounded-xl,
            html.dark [role="dialog"] .bg-white {
                background-color: #1e293b !important;
                border: 1px solid #334155 !important;
            }

            /* Header do modal (bg-indigo-50, bg-slate-50, border-b) */
            html.dark [role="dialog"] .bg-indigo-50,
            html.dark [role="dialog"] .bg-slate-50,
            html.dark .relative.bg-white.rounded-2xl > div:first-child,
            html.dark .relative.bg-white.rounded-xl > div:first-child {
                background-color: #263147 !important;
                border-bottom-color: #3e5068 !important;
            }

            /* Título do header do modal */
            html.dark [role="dialog"] .text-indigo-900,
            html.dark [role="dialog"] h3.text-indigo-900 {
                color: #a5b4fc !important;
            }

            /* Cards de checkbox dentro do modal (bg-slate-50 + border) */
            html.dark [role="dialog"] label.bg-slate-50,
            html.dark [role="dialog"] label.flex.bg-slate-50,
            html.dark [role="dialog"] label.bg-rose-50,
            html.dark [role="dialog"] label.bg-indigo-50 {
                background-color: #2d3d54 !important;
                border-color: #3e5068 !important;
            }
            html.dark [role="dialog"] label.bg-slate-50:hover,
            html.dark [role="dialog"] label.flex.bg-slate-50:hover,
            html.dark [role="dialog"] label.bg-rose-50:hover,
            html.dark [role="dialog"] label.bg-indigo-50:hover,
            html.dark [role="dialog"] label.hover\\:bg-indigo-50:hover,
            html.dark [role="dialog"] label.hover\\:bg-rose-100:hover {
                background-color: #374d68 !important;
                border-color: #5b789e !important;
            }

            /* Texto principal dentro dos cards de checkbox */
            html.dark [role="dialog"] label .text-slate-700 {
                color: #e2e8f0 !important;
            }
            html.dark [role="dialog"] label .text-slate-500 {
                color: #94a3b8 !important;
            }
            html.dark [role="dialog"] .text-indigo-800,
            html.dark [role="dialog"] label.text-indigo-800 {
                color: #a5b4fc !important;
            }

            /* Inputs e Textareas dentro de modais */
            html.dark [role="dialog"] input[type="text"],
            html.dark [role="dialog"] input[type="email"],
            html.dark [role="dialog"] textarea {
                background-color: #172032 !important;
                color: #f1f5f9 !important;
                border-color: #3e5068 !important;
            }
            html.dark [role="dialog"] input[type="text"]:focus,
            html.dark [role="dialog"] input[type="email"]:focus,
            html.dark [role="dialog"] textarea:focus {
                border-color: #6366f1 !important;
                box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2) !important;
            }
            html.dark [role="dialog"] input::placeholder,
            html.dark [role="dialog"] textarea::placeholder {
                color: #64748b !important;
            }

            /* Labels de campo de texto */
            html.dark [role="dialog"] label.text-sm.font-medium,
            html.dark [role="dialog"] .text-sm.font-medium.text-slate-700 {
                color: #cbd5e1 !important;
            }

            /* Separadores / h4 de seção dentro do modal */
            html.dark [role="dialog"] h4.text-slate-800,
            html.dark [role="dialog"] h4.font-bold {
                color: #e2e8f0 !important;
                border-bottom-color: #334155 !important;
            }

            /* Botão "Cancelar" nos modais */
            html.dark [role="dialog"] button.border-slate-300,
            html.dark [role="dialog"] button.border-slate-200,
            html.dark [role="dialog"] button.text-slate-700,
            html.dark [role="dialog"] button.text-slate-600 {
                background-color: #263147 !important;
                border-color: #3e5068 !important;
                color: #cbd5e1 !important;
            }
            html.dark [role="dialog"] button.border-slate-300:hover,
            html.dark [role="dialog"] button.border-slate-200:hover {
                background-color: #2d3d54 !important;
            }

            /* Área de scroll custom dentro de modal */
            html.dark [role="dialog"] .overflow-y-auto {
                background-color: #1e293b !important;
            }

            /* Checkbox inputs — fundo visível */
            html.dark [role="dialog"] input[type="checkbox"] {
                background-color: #2d3d54 !important;
                border-color: #4a6080 !important;
                accent-color: #6366f1;
            }

            /* ═══════════════════════════════════════════
               MODAL PERFIL DO PACIENTE (#modalDetalhes)
               ═══════════════════════════════════════════ */

            /* Body scrollável do perfil — separado do header */
            html.dark #modalDetalhes .bg-white.flex-1,
            html.dark #modalDetalhes div.overflow-y-auto.bg-white {
                background-color: #192234 !important;
            }

            /* Cards de info: CHEGADA / CONVÊNIO (bg-indigo-50/50) */
            html.dark #modalDetalhes .bg-indigo-50\/50 {
                background-color: #1e2d47 !important;
                border-color: #2d4a72 !important;
            }

            /* Card PACIENTE ID (bg-slate-50) */
            html.dark #modalDetalhes .bg-slate-50.border.border-slate-100 {
                background-color: #1e293b !important;
                border-color: #334155 !important;
            }

            /* Labels dos cards: "CHEGADA", "CONVÊNIO" (text-indigo-400) */
            html.dark #modalDetalhes .text-indigo-400 {
                color: #818cf8 !important;
            }

            /* Labels dos cards: "PACIENTE ID" (text-slate-400) */
            html.dark #modalDetalhes .text-slate-400 {
                color: #94a3b8 !important;
            }

            /* Valor nos cards de info (text-slate-700) */
            html.dark #modalDetalhes .text-slate-700 {
                color: #e2e8f0 !important;
            }

            /* ID do paciente (font-mono text-slate-500) */
            html.dark #modalDetalhes .text-slate-500 {
                color: #94a3b8 !important;
            }

            /* Seção Anamnese e Seção Termo — container borda */
            html.dark #modalDetalhes .border.border-slate-200.rounded-xl {
                border-color: #334155 !important;
                background-color: #1e293b !important;
            }

            /* Header das seções (bg-slate-50 com border-b) */
            html.dark #modalDetalhes .border.border-slate-200.rounded-xl .bg-slate-50 {
                background-color: #263147 !important;
                border-bottom-color: #334155 !important;
            }

            /* h4 dentro das seções */
            html.dark #modalDetalhes h4.text-slate-700 {
                color: #e2e8f0 !important;
            }

            /* Body das seções (bg-white content area) */
            html.dark #modalDetalhes #docSecAnamneseContent,
            html.dark #modalDetalhes .border.border-slate-200.rounded-xl .bg-white {
                background-color: #192234 !important;
                color: #cbd5e1 !important;
            }

            /* Texto de aviso dentro das seções (text-slate-600, text-slate-500, text-xs) */
            html.dark #modalDetalhes #docSecAnamneseContent p,
            html.dark #modalDetalhes #docSecAnamneseContent span,
            html.dark #modalDetalhes .text-xs.text-slate-500 {
                color: #94a3b8 !important;
            }

            /* Status badges genéricos no modal (bg-slate-200 text-slate-600) */
            html.dark #modalDetalhes .bg-slate-200 {
                background-color: #334155 !important;
                color: #cbd5e1 !important;
            }

            /* Badge INCOMPLETO (amber) — preservar cor */
            html.dark #modalDetalhes [id*="Status"].bg-amber-100,
            html.dark #modalDetalhes span.bg-amber-100 {
                background-color: rgba(245,158,11,0.2) !important;
                color: #fcd34d !important;
            }

            /* Badge NÃO LOCALIZADO (rose) — preservar cor */
            html.dark #modalDetalhes [id*="Status"].bg-rose-100,
            html.dark #modalDetalhes span.bg-rose-100 {
                background-color: rgba(244,63,94,0.2) !important;
                color: #fda4af !important;
            }

            /* Badge OK / REGISTRADO (emerald) */
            html.dark #modalDetalhes [id*="Status"].bg-emerald-100,
            html.dark #modalDetalhes span.bg-emerald-100 {
                background-color: rgba(16,185,129,0.2) !important;
                color: #6ee7b7 !important;
            }

            /* Botão "Ver / Imprimir Documento" (bg-emerald-50 text-emerald-700) */
            html.dark #modalDetalhes #btnReimprimirTermo {
                background-color: rgba(16,185,129,0.15) !important;
                border-color: rgba(16,185,129,0.3) !important;
                color: #6ee7b7 !important;
            }
            html.dark #modalDetalhes #btnReimprimirTermo:hover {
                background-color: rgba(16,185,129,0.25) !important;
            }

            /* Texto do campo "Assinado em..." / "Nenhum termo..." (text-slate-500) */
            html.dark #modalDetalhes #docSecTermoData {
                color: #94a3b8 !important;
            }

            /* Botões do rodapé: Excluir, Editar, Concluir */
            html.dark #modalDetalhes #btnExcluirPacienteModal {
                background-color: rgba(244,63,94,0.15) !important;
                border-color: rgba(244,63,94,0.3) !important;
                color: #fda4af !important;
            }

            /* Linha vertical colorida da seção Termo (bg-emerald-500) — manter */
            html.dark #modalDetalhes .absolute.bg-emerald-500 {
                background-color: #10b981 !important;
            }

            /* Botões do footer do modal */
            html.dark #modalDetalhes .border-slate-200.rounded-xl ~ div,
            html.dark #modalDetalhes > div > div:last-child {
                border-top-color: #334155 !important;
                background-color: #1e293b !important;
            }

            /* Ícone de avatar (bg-indigo-100 border-indigo-200) */
            html.dark #modalDetalhes .bg-indigo-100 {
                background-color: rgba(79,70,229,0.25) !important;
                border-color: rgba(79,70,229,0.4) !important;
            }

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
