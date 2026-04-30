<div align="center">
  <img src="https://ui-avatars.com/api/?name=F+IO&background=4f46e5&color=fff&size=100&rounded=true" alt="formular.IO Logo">
  <h1>formular.IO — Prontuário Médico com IA</h1>
  <p><strong>A evolução do atendimento médico baseada em voz e Inteligência Artificial.</strong></p>
</div>

<br>

<div align="center">
  <img src="https://img.shields.io/badge/Status-MVP_Validável_v1.0-emerald?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Frontend-HTML5_|_CSS3_|_JS-blue?style=for-the-badge&logo=html5" alt="Frontend" />
  <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-06b6d4?style=for-the-badge&logo=tailwindcss" alt="Styling" />
  <img src="https://img.shields.io/badge/Backend-n8n_|_Workflows-FF6C37?style=for-the-badge&logo=n8n" alt="Backend" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Database" />
  <img src="https://img.shields.io/badge/AI-Groq_|_GPT--4o_Mini-black?style=for-the-badge&logo=openai" alt="AI Stack" />
</div>

<br>

## 🩺 Sobre o Projeto

O **formular.IO** (nome-código *Prontuário AI*) nasceu da dor de mercado dos profissionais de saúde que gastam em média 30 a 40% do seu tempo de consulta olhando para a tela do computador, digitando observações.

Nossa solução propõe o fim da digitação não-natural: O médico atende o paciente de mãos livres. Com um toque em seu celular ou tablet através de nossa interface nativa web, a consulta é **gravada em áudio**, transcrita em altíssima precisão e imediatamente traduzida para um formato de **prontuário clínico estruturado** (HDA, Exames, Suspeitas, Receituário) usando Grandes Modelos de Linguagem (LLMs).

Ao final do dia, toda a clínica possui uma fila centralizada e automatizada.

---

## 🔥 Principais Funcionalidades

- **🎙️ Captura Inteligente de Voz:** Interface `mobile-first` de gravação de áudio no ambiente médico, com pausas dinâmicas e indicadores visuais fluidos.
- **🪄 Transcrição e Extração Contextual:** Pipeline inteligente (Groq Whisper + GPT-4o) que ignora ruídos paralelos, converte linguagem coloquial para termos médicos (CID-10, nomenclaturas) e não "inventa" dados graças ao Prompt Engineering otimizado para *Rigor Técnico*.
- **👥 Controle de Perfis (Acesso Cíclico):** 
  - **Módulo Recepção:** Painel para a secretária adicionar pacientes à fila do dia, controlar tempos de espera e prioridades.
  - **Módulo Médico:** Dashboard exclusivo do médico unindo apenas as suas consultas ativas na fila, onde a magia da gravação acontece. 
- **📄 Emissão Automatizada de Documentos:** Prontuários gerados instantaneamente e engavetados já em layout final PDF via integração Gotenberg/Supabase.
- **🔒 Segurança Ativa:** O projeto implementa separação de visualização por Médico (medico_id isolado no backend), armazenamento seguro de arquivos binários e senhas de acesso (MVP local mode).

---

## 🛠️ Arquitetura Tecnológica

Este projeto é desenvolvido num modelo altamente desacoplado (Serverless / Webhook-driven):

1. **Frontend "Vanilla Moderno":** Construído sem a necessidade complexa de bundlers ou frameworks pesados. `HTML5`, `Vanila JS` e `Tailwind CSS (CDN)` mantêm o cliente hiper ultra-rápido, responsivo perfeitamente e hospedável em estáticos (como GitHub Pages, Hostinger ou Cloudflare).
2. **Orquestração e Integração (n8n):** Todo o tráfego do frontend não vai a um servidor "cru". Os dados sobem no formato via Webhooks/CORS e caem em fluxogramas dinâmicos do n8n localizados numa infraestrutura de ponta.
3. **Database e Storage (Supabase):** Utilizamos PostgreSQL e Object Buckets vinculados aos links diretos em nuvem para guardar tudo, do histórico JSON persistente aos áudios .WEBM finais.

---

## 🚀 Como testar localmente (Dev Environment)

Embora a suíte total requeira o n8n ativo com suas chaves locais, explorar o layout e o poder do MVP frontend é absurdamente ágil.

```bash
# Clone este repositório
git clone https://github.com/SeuUsername/prontuario-app.git

# Acesse o diretório
cd prontuario-app

# Na ausência de um framework Node, use qualquer servidor estático temporário para contornar políticas de CORS padrão de navegadores (arquivos file://):
# Com Python 3 instalado:
python -m http.server 8000

# Ou com NPX:
npx serve .
```

Abra o navegador em `http://localhost:8000/login.html` e utilize os Mocks de teste:
* **Autenticação Recepção:** `manager` / `admin123`
* **Autenticação Médico:** `Qualquer CPF/CRM` / `291098`

---

## 📅 Status / Roadmap

- [x] **Fase 1:** Prototipação Visual (UI/UX) - Clean Medical Tech.
- [x] **Fase 2:** Engenharia de AI (Pipelines n8n)
- [x] **Fase 3:** Segurança e Dashboard Histórico isolado por médicos (MVP Validado v1.0).
- [ ] **Fase 4:** Painel Administrativo de Usuários (Bancos de médicos multi-tenants nativos).
- [ ] **Fase 5:** Integração final de login com JWT Auth do próprio Supabase.

---
📝 *Projeto construído em velocidade recorde com foco extremo em Developer Experience e Experiência Fluida de Usuário Clínico.*
