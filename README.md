<div align="center">
  <img src="https://ui-avatars.com/api/?name=F+IO&background=4f46e5&color=fff&size=100&rounded=true" alt="formular.IO Logo">
  <h1>formular.IO — Prontuário AI</h1>
  <p><strong>Prontuário médico inteligente com captura de voz e IA generativa.</strong></p>
</div>

<br>

<div align="center">
  <img src="https://img.shields.io/badge/Versão-2.0-emerald?style=for-the-badge" alt="Versão" />
  <img src="https://img.shields.io/badge/Frontend-HTML5_|_CSS3_|_JS-blue?style=for-the-badge&logo=html5" alt="Frontend" />
  <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-06b6d4?style=for-the-badge&logo=tailwindcss" alt="Styling" />
  <img src="https://img.shields.io/badge/Backend-n8n_|_Workflows-FF6C37?style=for-the-badge&logo=n8n" alt="Backend" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Database" />
  <img src="https://img.shields.io/badge/AI-Groq_Whisper_|_GPT--4.1_Mini-black?style=for-the-badge&logo=openai" alt="AI Stack" />
</div>

<br>

## 🩺 Sobre o Projeto

O **formular.IO** (Prontuário AI) nasceu da dor real de profissionais de saúde que gastam de 30% a 40% do tempo de consulta digitando observações em uma tela, em vez de dar atenção plena ao paciente.

Nossa solução elimina a digitação: o médico atende de **mãos livres**. Com um toque na interface web (celular, tablet ou desktop), a consulta é **gravada em áudio**, transcrita com alta precisão e convertida automaticamente em um **prontuário clínico estruturado** (HDA, Exame Físico, Diagnóstico, Tratamento) por meio de Grandes Modelos de Linguagem (LLMs).

O sistema é **escalável e adaptável** a qualquer especialidade médica — da geriatria à cardiologia, da ortopedia à clínica geral — ajustando-se às necessidades de cada profissional e clínica.

> **Princípio central:** A IA **sugere**, o médico **aprova**. Nenhum dado clínico é gerado sem revisão humana.

---

## 🔥 Funcionalidades Principais

- **🎙️ Captura Inteligente de Voz:** Interface mobile-first de gravação de áudio com pausas dinâmicas, timer em tempo real e visualizador de ondas.
- **🪄 Transcrição + Extração Clínica:** Pipeline Groq Whisper (STT) + GPT-4.1-mini que converte linguagem coloquial em termos médicos estruturados, sem inventar dados.
- **👥 Controle de Perfis:**
  - **Módulo Recepção:** Cadastro de pacientes, gestão da fila do dia, tempos de espera e prioridades.
  - **Módulo Médico:** Dashboard exclusivo com fila de pacientes, gravação, análise por IA e histórico de consultas.
- **📄 Geração Automática de PDF:** Prontuários aprovados são convertidos em PDF estruturado via Gotenberg e armazenados com segurança.
- **🔒 Segurança:** Autenticação via Supabase Auth, arquivos em buckets privados (Signed URLs com 5 min de validade), separação de dados por médico.
- **🌙 Dark Mode:** Tema claro/escuro persistente em todas as telas.

---

## 🛠️ Arquitetura

Modelo **serverless + webhook-driven** com separação total entre frontend e backend:

```
Frontend (HTML/CSS/JS)
    │
    ▼
Webhooks n8n (Orquestração)
    │
    ├── Groq Whisper (Transcrição)
    ├── GPT-4.1-mini (Extração Clínica)
    ├── Gotenberg (HTML → PDF)
    │
    ▼
Supabase (PostgreSQL + Auth + Storage)
```

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | HTML5, JavaScript Vanilla, Tailwind CSS (CDN) |
| **Orquestração** | n8n (6 webhooks ativos) |
| **Transcrição** | Groq Whisper (whisper-large-v3) |
| **Extração IA** | OpenAI GPT-4.1-mini (via agente n8n LangChain) |
| **Banco de Dados** | Supabase PostgreSQL |
| **Autenticação** | Supabase Auth (signInWithPassword) |
| **Storage** | Supabase Storage (buckets privados) |
| **PDF** | Gotenberg (conversão HTML → PDF) |

---

## 📁 Estrutura de Arquivos

```
prontuario_project/
├── index.html              → Redireciona para login.html
├── login.html              → Tela de autenticação (Supabase Auth)
├── recepcao.html           → Painel de recepção: cadastro e gestão de pacientes
├── medico-dashboard.html   → Painel médico: fila, atendimentos e histórico
├── atendimento.html        → Tela de atendimento: gravação → IA → aprovação → PDF
├── app.js                  → Lógica da tela de atendimento
├── auth-guard.js           → Autenticação, proteção de rotas, Signed URLs
├── dark-mode.js            → Sistema de tema claro/escuro
├── styles.css              → Estilos complementares ao Tailwind
├── n8n_workflow.json       → Backup do workflow n8n completo
├── ROADMAP.md              → Documentação técnica detalhada
├── README.md               → Este arquivo
└── INPI/                   → Documentação para registro de software
    ├── IDENTIFICACAO_VERSAO.txt
    ├── AUTORES.txt
    ├── DOCUMENTACAO_TECNICA.md
    ├── DESCRICAO_FUNCIONAL.md
    ├── ARQUITETURA_RESUMIDA.md
    └── WORKFLOW_IA.md
```

---

## 🔄 Fluxo Completo de Atendimento

```
RECEPÇÃO                          MÉDICO                           IA + BACKEND
─────────                         ──────                           ───────────
Login (recepção)                  Login (médico)
    │                                 │
Cadastra paciente ──────────────► Paciente aparece na fila
                                      │
                                  Clica no paciente
                                      │
                                  ┌─ GRAVAÇÃO ─┐
                                  │ Gravar áudio │
                                  │ Pausar/Retomar│
                                  │ Parar        │
                                  └──────────────┘
                                      │
                                  "Analisar com IA" ──────────► Whisper (transcrição)
                                      │                              │
                                      │                         GPT-4.1-mini (extração)
                                      │                              │
                                  Campos preenchidos ◄──────── JSON estruturado
                                      │
                                  Revisa e edita
                                      │
                                  "Aprovar e Gerar" ──────────► Salva no banco
                                      │                         Gera HTML → PDF
                                      │                         Upload para Storage
                                      │
                                  Download do PDF ◄──────────── Signed URL (5 min)
                                      │
                                  Paciente "Finalizado" ✅
```

---

## 🤖 Pipeline de IA

| Etapa | Tecnologia | Entrada | Saída |
|-------|-----------|---------|-------|
| **1. Captura** | MediaRecorder API | Áudio do navegador | Blob (webm/mp4) |
| **2. Transcrição** | Groq Whisper (large-v3) | Blob de áudio | Texto bruto |
| **3. Extração** | GPT-4.1-mini | Texto da transcrição | JSON estruturado |
| **4. Revisão** | Médico (humano) | Campos preenchidos | Prontuário aprovado |
| **5. PDF** | Gotenberg | HTML renderizado | Arquivo PDF |

**Regras da IA:**
- Extrai **apenas** informações explicitamente presentes na fala
- **Nunca inventa** dados clínicos
- Retorna `null` para campos não mencionados
- Blacklist de termos genéricos que invalidam a extração

---

## 🌐 Acesso

O sistema está disponível em produção:

🔗 **https://convertmedical.com.br**

## 📜 Propriedade Intelectual

**Versão registrada:** 2.0  
**Data de criação:** 02/02/2026  
**Data de fechamento para registro:** 23/03/2026  
**Documentação INPI:** disponível na pasta `/INPI`

---

## 🧰 Dependências Externas (CDN)

| Biblioteca | Uso |
|-----------|-----|
| Tailwind CSS | Estilização |
| Supabase JS v2 | Auth, Database, Storage |
| Phosphor Icons | Ícones |
| Google Fonts (Inter, Outfit) | Tipografia |

> Todas as dependências são via CDN. Sem `npm`, sem bundler. HTML estático puro.

---

**Autor técnico:** Paulo Guilherme Goldner Ribeiro  
**Última atualização:** 23/03/2026
