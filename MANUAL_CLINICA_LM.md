# 📖 Manual Completo — Sistema Prontuar.IO
## Clínica L&M

> **Versão:** 1.0 · Julho/2026
> **Público-alvo:** Equipe da Clínica L&M (Secretária e Médica)

---

## 📑 Índice

1. [Introdução](#1--introdução)
2. [Dados de Acesso](#2--dados-de-acesso)
3. [Tela de Login](#3--tela-de-login)
4. [Painel da Secretária (Daniele)](#4--painel-da-secretária-daniele)
   - [Aba "Agenda & Calendário"](#41-aba-agenda--calendário)
   - [Aba "Gestão de Pacientes"](#42-aba-gestão-de-pacientes)
   - [Cadastrar Paciente](#43-como-cadastrar-um-novo-paciente)
   - [Ficha de Anamnese](#44-ficha-de-anamnese)
   - [Imagens e Documentos](#45-imagens-e-documentos-anexos)
   - [Prontuários e Histórico](#46-prontuários-e-histórico)
   - [Relatório Consolidado](#47-relatório-consolidado)
5. [Painel da Médica (Dra. Mariana)](#5--painel-da-médica-dra-mariana)
   - [Tela Inicial do Dashboard](#51-tela-inicial-do-dashboard)
   - [Agendamentos do Dia](#52-agendamentos-do-dia)
   - [Fila de Pacientes](#53-fila-de-pacientes)
   - [Atendimentos Recentes](#54-atendimentos-recentes)
   - [Histórico do Paciente](#55-histórico-do-paciente)
   - [Perfil Profissional](#56-perfil-profissional)
6. [Tela de Atendimento (Consulta)](#6--tela-de-atendimento-consulta)
   - [Gravação de Áudio](#61-gravação-de-áudio)
   - [Prontuário Estruturado pela IA](#62-prontuário-estruturado-pela-ia)
   - [Finalizar Consulta](#63-finalizar-consulta)
   - [Tela de Conclusão](#64-tela-de-conclusão)
   - [Fotos Clínicas (Opcional)](#65-fotos-clínicas-opcional)
7. [Modo Escuro / Modo Claro](#7--modo-escuro--modo-claro)
8. [Sair do Sistema (Logout)](#8--sair-do-sistema-logout)
9. [Perguntas Frequentes (FAQ)](#9--perguntas-frequentes-faq)

---

## 1. 🏥 Introdução

O **Prontuar.IO** é o sistema de prontuários eletrônicos da Clínica L&M. Ele permite:

- **Secretária (Daniele):** Cadastrar pacientes, agendar consultas, organizar a agenda médica, preencher fichas de anamnese e acessar prontuários finalizados.
- **Médica (Dra. Mariana):** Atender pacientes, gravar consultas por áudio, receber prontuários estruturados por Inteligência Artificial, revisar e finalizar atendimentos com geração automática de PDF.

O sistema é acessado pelo navegador (Chrome, Edge, Safari) — não precisa instalar nada.

---

## 2. 🔑 Dados de Acesso

Cada membro da equipe possui seu próprio login:

| Quem | E-mail | Senha | Função no Sistema |
|------|--------|-------|-------------------|
| **Daniele Corrêa** | `daniele@lm.com` | `clinica@2026` | Secretária |
| **Dra. Mariana Calazans** | `mariana@lm.com` | `clinica@2026` | Médica |

> ⚠️ **Importante:** Nunca compartilhe sua senha. Cada login é pessoal e registra quem fez cada ação no sistema.

---

## 3. 🔐 Tela de Login

Ao abrir o sistema no navegador, você verá a **tela de login**.

### O que aparece na tela:
- Logotipo do **Prontuar.IO**
- Campo **"Usuário"** — para digitar seu e-mail
- Campo **"Senha"** — para digitar sua senha
- Botão de olho 👁 ao lado da senha — clique para ver/esconder o que você digitou
- Botão **"Entrar"** — para acessar o sistema

### Passo a passo para entrar:

1. Digite seu **e-mail** no campo "Usuário"
2. Digite sua **senha** no campo "Senha"
3. Clique em **"Entrar"**
4. Aguarde um instante (o botão vai mostrar "Entrando...")
5. Você será redirecionada automaticamente para o seu painel:
   - **Daniele** → vai para o **Painel da Secretária**
   - **Dra. Mariana** → vai para o **Painel Médico (Dashboard)**

### Se der erro:
- **"E-mail ou senha incorretos"** → Confira se digitou o e-mail e a senha certinhos. A senha diferencia letras maiúsculas de minúsculas.
- **"Erro ao conectar"** → Verifique sua conexão com a internet e tente novamente.

> 💡 **Dica:** Se já estiver logada e fechar o navegador, ao abrir novamente o sistema pode te manter logada automaticamente.

---

## 4. 👩‍💼 Painel da Secretária (Daniele)

Depois de fazer login, a Daniele acessa o **Painel Administrativo da Clínica L&M**. Este é o centro de controle da secretária.

### O que você vê no topo da tela:
- **Logotipo** "Clínica L&M" com o texto "Painel Administrativo"
- **Seu nome** (Daniele Corrêa) com a função "Secretária"
- **Botão de tema** 🌙 — para alternar entre modo claro e escuro
- **Botão "Sair"** 🚪 — para encerrar sua sessão

### Duas abas principais:
O painel possui **duas abas** na parte superior. Você alterna entre elas clicando:

1. 📅 **Agenda & Calendário** — Para ver e gerenciar os agendamentos
2. 👥 **Gestão de Pacientes** — Para cadastrar, buscar e gerenciar pacientes

---

### 4.1 Aba "Agenda & Calendário"

Esta é a aba padrão (abre automaticamente). Aqui você controla **toda a agenda** da clínica.

#### O que aparece na tela:

**Barra superior do calendário:**
- **Título do período** — mostra a semana, mês ou dia que está visualizando (ex: "30 Jun – 06 Jul 2026")
- **Setas ◀ ▶** — para navegar entre períodos (avançar/voltar)
- **Botão "Hoje"** — volta rapidamente para o dia atual
- **Botão de calendário** 📅 — permite ir diretamente para uma data específica
- **Filtro de médico** — um seletor que permite ver a agenda de um médico específico ou de "Todos os Médicos"
- **Botões de visualização:**
  - **Semanal** — mostra a semana inteira com os dias lado a lado (padrão no computador)
  - **Mensal** — visão do mês inteiro, como um calendário de parede
  - **Diária** — mostra apenas um dia, com os horários detalhados (padrão no celular)
  - **Agenda** — lista corrida dos próximos 30 dias de agendamentos
- **Botão verde "+ AGENDAR"** — cria um novo agendamento

#### Como os agendamentos aparecem:
Os agendamentos são exibidos como **cartõezinhos coloridos** no calendário, com cores diferentes para cada situação:

| Cor | Significado |
|-----|-------------|
| 🔵 Azul | Agendado (marcado, mas não confirmado) |
| 🟢 Verde | Confirmado (paciente confirmou presença) |
| 🟡 Amarelo | Em atendimento (consulta em andamento) |
| ✅ Cinza/Verde | Finalizado (consulta concluída) |
| 🔴 Vermelho | Cancelado |

Ao **clicar em um agendamento** no calendário, abre uma tela de detalhes onde você pode gerenciá-lo.

---

#### Como criar um novo agendamento:

1. Clique no botão verde **"+ AGENDAR"** (ou clique em um horário vazio no calendário)
2. Na janela que aparece, preencha:
   - **Paciente** — selecione o paciente na lista (ele precisa estar cadastrado primeiro)
   - **Médico Responsável** — escolha o médico (ex: "Dra. Mariana (Cirurgia Geral)")
   - **Data** — escolha a data da consulta
   - **Horário** — digite o horário no formato HH:MM (ex: 14:30)
   - **Observações** (opcional) — qualquer informação extra sobre a consulta
3. Clique em **"CONFIRMAR AGENDAMENTO"**
4. Uma mensagem verde confirmará: "Agendamento criado com sucesso!"
5. O agendamento aparecerá no calendário automaticamente

---

#### Como gerenciar um agendamento existente:

Clique no agendamento no calendário. Uma janela de detalhes abre com as informações:
- Nome do paciente e telefone
- Médico responsável
- Data, horário e status atual
- Observações (se houver)

**Ações disponíveis:**

| Botão | O que faz |
|-------|-----------|
| **CONFIRMAR PRESENÇA** | Muda o status de "Agendado" para "Confirmado" (aparece quando o paciente liga confirmando) |
| **REMARCAR** | Abre campos para escolher nova data e horário. Clique em "SALVAR REMARCAÇÃO" para confirmar |
| **CANCELAR** | Abre campo para informar o motivo do cancelamento. Clique em "CONFIRMAR CANCELAMENTO" |

> 💡 **Dica:** Você pode filtrar a agenda por médico usando o seletor "Todos os Médicos" na barra superior. Útil quando a clínica tem mais de um médico.

---

### 4.2 Aba "Gestão de Pacientes"

Clique na aba **"Gestão de Pacientes"** para acessar o cadastro completo.

#### O que aparece na tela:
- **Campo de busca** 🔍 — "Buscar paciente por nome ou CPF..."
- **Botão "+ CADASTRAR PACIENTE"** — para adicionar um paciente novo
- **Tabela de pacientes** (no computador) ou **cartões** (no celular) com todos os pacientes cadastrados

#### Informações exibidas para cada paciente:

| Coluna | O que mostra |
|--------|-------------|
| **Nome** | Nome completo do paciente |
| **CPF** | Número do CPF formatado |
| **Telefone** | Telefone de contato |
| **Convênio** | Plano de saúde ou "Particular" |
| **Ações** | Botões para gerenciar o paciente |

#### Botões de ação para cada paciente:

| Botão | Ícone | O que faz |
|-------|-------|-----------|
| **Prontuários** | 📄 | Abre o histórico completo de prontuários (consultas finalizadas) do paciente |
| **Anamnese** | 💓 | Abre/edita a ficha de anamnese do paciente |
| **Docs** | 🖼 | Abre a área de upload de imagens e documentos (exames, relatórios) |
| **Editar** | ✏️ | Permite alterar os dados cadastrais do paciente |
| **Excluir** | 🗑 | Remove o paciente do sistema (pede confirmação antes) |

#### Como buscar um paciente:
1. Digite parte do **nome** ou os **números do CPF** no campo de busca
2. A lista vai filtrando automaticamente enquanto você digita
3. Encontrou? Clique nos botões de ação para gerenciá-lo

---

### 4.3 Como Cadastrar um Novo Paciente

1. Na aba "Gestão de Pacientes", clique em **"+ CADASTRAR PACIENTE"**
2. Preencha o formulário:

| Campo | Obrigatório? | O que preencher |
|-------|-------------|-----------------|
| **Nome Completo** | ✅ Sim | Nome e sobrenome do paciente (ex: "João da Silva") |
| **CPF** | ✅ Sim | Número do CPF — o sistema formata automaticamente (000.000.000-00) |
| **Nascimento** | Sim | Data de nascimento no formato DD/MM/AAAA |
| **Sexo** | Não | Masculino, Feminino ou Outro |
| **Telefone** | ✅ Sim | Celular com DDD — o sistema formata automaticamente (99) 99999-9999 |
| **Convênio** | Não | Selecione o plano: Particular, Unimed, Bradesco Saúde, Medsênior, Best Senior, Samp ou SUS |

3. Clique em **"SALVAR PACIENTE"**
4. Se tudo estiver correto, aparece a mensagem: **"Paciente cadastrado com sucesso!"**
5. **Automaticamente** abre a ficha de anamnese para você preencher a seguir

> ⚠️ **Erros comuns:**
> - **"CPF inválido"** → O CPF digitado não é válido. Verifique os números.
> - **"Paciente já cadastrado com este CPF"** → Já existe um paciente com esse CPF. Use a busca para encontrá-lo.

---

### 4.4 Ficha de Anamnese

A **anamnese** é o levantamento das condições de saúde do paciente. Ela é preenchida pela secretária e depois fica visível para a médica durante a consulta.

#### Como acessar:
- **Automático:** Abre sozinha após cadastrar um paciente novo
- **Manual:** Clique no botão **"Anamnese" (💓)** ao lado do nome do paciente na lista

#### Campos da ficha:

| Campo | Tipo | O que preencher |
|-------|------|-----------------|
| **Doenças Crônicas?** | ☑️ Checkbox | Marque se o paciente tem diabetes, hipertensão, etc. |
| **Alergias Conhecidas?** | ☑️ Checkbox | Marque se tem alguma alergia |
| **Tabagismo / Etilismo?** | ☑️ Checkbox | Marque se o paciente fuma ou consome álcool regularmente |
| **Limitação de Mobilidade?** | ☑️ Checkbox | Marque se tem dificuldade de locomoção |
| **Medicamentos em Uso Contínuo** | 📝 Texto | Liste os remédios que o paciente toma regularmente |
| **Cirurgias / Internações Anteriores** | 📝 Texto | Descreva operações ou internações passadas |
| **Histórico Familiar Relevante** | 📝 Texto | Doenças na família (ex: pai com diabetes, mãe com câncer) |
| **Queixa Principal / Motivo da Consulta** | 📝 Texto | Por que o paciente procurou a clínica |

Clique em **"SALVAR"** para registrar. Se já existir uma anamnese para aquele paciente, os dados serão atualizados.

> 💡 **Dica:** A anamnese pode ser editada a qualquer momento. Basta clicar no botão "Anamnese" novamente para atualizar as informações.

---

### 4.5 Imagens e Documentos Anexos

Aqui você pode anexar exames, relatórios e imagens do paciente.

#### Como acessar:
Clique no botão **"Docs" (🖼)** ao lado do nome do paciente.

#### O que aparece:
- Uma **área de upload** com o texto "Arraste seus exames, imagens ou relatórios aqui"
- Botão **"Selecionar Arquivos"** para escolher do computador
- **Grade de miniaturas** dos arquivos já enviados

#### Como enviar um documento:
1. **Opção 1:** Arraste o arquivo do seu computador e solte na área pontilhada
2. **Opção 2:** Clique em **"Selecionar Arquivos"** e escolha o arquivo desejado

**Formatos aceitos:** JPG, PNG, WEBP, PDF (máximo 10 MB por arquivo)

Você pode enviar **vários arquivos de uma vez**.

#### Como excluir um documento:
1. Clique no arquivo na grade de miniaturas
2. Confirme a exclusão na janela que aparece

> ⚠️ **Atenção:** A exclusão de um documento é **permanente** e não pode ser desfeita.

---

### 4.6 Prontuários e Histórico

Aqui você visualiza todas as consultas finalizadas de um paciente — com acesso aos prontuários em PDF e gravações de áudio.

#### Como acessar:
Clique no botão **"Prontuários" (📄)** ao lado do nome do paciente.

#### O que aparece:
Uma lista com todas as consultas finalizadas, cada uma mostrando:

- **Data e hora** da consulta
- **Médico responsável** que realizou o atendimento
- **Botão "Prontuário"** — abre o PDF do prontuário da consulta (se disponível)
- **Botão "Imagens"** — abre o relatório de imagens em PDF (se houver fotos clínicas)
- **Player de áudio** 🔊 — permite ouvir a gravação da consulta (se houver)

> 💡 Se o relatório de imagens ainda não foi gerado, aparece um botão **"Gerar Imagens"**. Clique nele e aguarde o processamento.

---

### 4.7 Relatório Consolidado

O **relatório consolidado** une **todos os prontuários** de um paciente em um único PDF. É muito útil quando o paciente precisa de um histórico completo.

#### Como gerar:
1. Abra os **Prontuários** de um paciente (botão 📄)
2. Clique no botão verde **"Gerar Consolidado"** no topo da janela
3. Aguarde o processamento (aparece uma tela com "Gerando Consolidado...")
4. O PDF será aberto automaticamente em uma nova aba

---

## 5. 👩‍⚕️ Painel da Médica (Dra. Mariana)

Depois de fazer login, a Dra. Mariana acessa o **Dashboard Médico**. Este é o painel principal da médica.

### O que você vê no topo da tela:
- **Logotipo** "Prontuar.IO — Área Médica"
- **Botão ☰ (menu hamburger)** — abre o menu lateral
- **Botão de tema** 🌙 — modo claro/escuro

### Menu lateral (clique no ☰):
- **Seu nome** — "Dra. Mariana Calazans" (Profissional Conectado)
- **"Meu Perfil"** — para configurar seus dados profissionais
- **"Escolha o Tema"** — alternar entre claro e escuro
- **"Encerrar Sessão"** — para sair do sistema

---

### 5.1 Tela Inicial do Dashboard

A tela principal da médica mostra um panorama do dia:

#### Contadores no topo:
| Indicador | O que mostra |
|-----------|-------------|
| **Aguardando** | Quantidade de pacientes na fila esperando atendimento |
| **Hoje** | Quantidade de pacientes registrados/atendidos hoje |

#### Botão de atualizar 🔄:
Ao lado dos contadores, há um botão para **recarregar** a lista de pacientes manualmente.

#### Busca e filtros:
- **Campo de busca** 🔍 — "Buscar paciente..." — pesquisa por nome
- **Filtros por status:**
  - **Todos** — mostra todos os pacientes
  - **Aguardando** — apenas os que estão na fila
  - **Finalizado** — apenas os já atendidos
  - **Cadastrado** — apenas os recém-cadastrados
- **Ordenação** — Mais recentes, Mais antigos, A→Z, Z→A

---

### 5.2 Agendamentos do Dia

Logo abaixo dos filtros, aparece a seção **"Agendamentos de Hoje"** com um contador mostrando quantos agendamentos existem para o dia.

Cada agendamento mostra:
- **Horário** da consulta (ex: "14:30")
- **Status** (Agendado, Em Consulta, Finalizado)
- **Nome do paciente**
- **Telefone** de contato
- **Botão de ação:**

| Botão | Quando aparece | O que faz |
|-------|---------------|-----------|
| **"Atender"** (verde) | Quando o status é "Agendado" ou "Confirmado" | Inicia a consulta — cria o registro e abre a tela de atendimento |
| **"Em Consulta"** (amarelo, piscando) | Quando a consulta já foi iniciada | Clique para voltar à consulta em andamento |
| **"Finalizado"** (cinza) | Quando a consulta já foi concluída | Desabilitado — a consulta já acabou |

> 💡 **Fluxo ideal:** A secretária agenda → a Dra. Mariana clica em "Atender" quando o paciente chega → a consulta é aberta automaticamente.

---

### 5.3 Fila de Pacientes

Abaixo dos agendamentos, aparece a **grade de pacientes** — cartões com todos os pacientes da clínica.

Cada cartão mostra:
- **Iniciais** do paciente (em círculo verde)
- **Nome** do paciente
- **Horário** de cadastro
- **Convênio** (ou "Particular")
- **Status** (Aguardando, Finalizado, Em Atendimento, Cadastrado)

**Botões em cada cartão:**

| Botão | O que faz |
|-------|-----------|
| **"Histórico"** | Abre o histórico completo de consultas do paciente |
| **"Novo Atend."** | Inicia uma nova consulta para aquele paciente |

> ⚠️ **Perfil incompleto:** Se aparecer um aviso amarelo **"Perfil Profissional Incompleto"** no topo da tela, é necessário configurar seus dados (nome, CRM, especialidade) antes de poder atender. Clique em "Configurar Perfil" para preencher.

---

### 5.4 Atendimentos Recentes

Na parte inferior do dashboard, aparece a seção **"Atendimentos Recentes"** — os últimos 8 atendimentos finalizados.

Cada cartão mostra:
- **Data** do atendimento
- **Nome** do paciente
- **Botões:**
  - **"Ver Laudo"** — abre o PDF do prontuário
  - **"Imagens"** — abre o relatório de imagens (se houver)
  - **"Voz"** — reproduz o áudio da consulta (se houver gravação)

---

### 5.5 Histórico do Paciente

Ao clicar em **"Histórico"** em um cartão de paciente, abre uma janela com **todas as consultas** daquele paciente.

A janela possui **duas abas:**

#### Aba "Consultas":
Lista todas as consultas finalizadas, cada uma com:
- Data e hora
- Botão para ver o **prontuário em PDF**
- Botão para ver o **relatório de imagens** (ou "Gerar Imagens" se ainda não foi gerado)
- **Player de áudio** para ouvir a gravação

#### Aba "Imagens":
Área para enviar e visualizar imagens e documentos do paciente:
- **Arrastar e soltar** arquivos ou clicar em "Selecionar Arquivo"
- Formatos aceitos: JPG, PNG, WebP, HEIC, PDF (máximo 10 MB)
- Grade de miniaturas dos arquivos já enviados

#### Botão "Gerar Consolidado":
No topo da janela, o botão **"Gerar Consolidado"** une todos os prontuários do paciente em um único PDF.

---

### 5.6 Perfil Profissional

O perfil contém os dados profissionais da médica que aparecem nos prontuários e documentos gerados.

#### Como acessar:
- Clique no **menu ☰** → **"Meu Perfil"**
- Ou clique em **"Configurar Perfil"** se o aviso de perfil incompleto aparecer

#### Campos do perfil:

| Campo | O que preencher |
|-------|-----------------|
| **Nome Completo** | Nome completo como deseja que apareça nos documentos |
| **Nome de Exibição** | Nome curto que aparece no sistema (ex: "Dra. Mariana") |
| **Especialidade** | Sua especialidade médica (ex: "Oncologia") |
| **CRM** | Número do seu CRM |
| **UF CRM** | Estado do CRM (selecione na lista: SP, RJ, MG, etc.) |

> 💡 **Assinatura digital:** A seção de assinatura digital aparece, mas **não é obrigatória** para a Clínica L&M. Porém, se quiser, pode desenhar sua assinatura usando o mouse ou caneta stylus.

Clique em **"Salvar Perfil"** para guardar as alterações.

---

## 6. 🩺 Tela de Atendimento (Consulta)

Esta é a tela onde a consulta médica acontece de fato. A Dra. Mariana é levada para cá ao clicar em "Atender" ou "Novo Atend."

### O que você vê no topo:
- **Botão "← Voltar para Fila"** — retorna ao dashboard (cuidado: perderá dados não salvos)
- **Nome da médica** e avatar
- **Botão de tema** 🌙

### Informações do paciente:
- **Nome** do paciente (em destaque)
- **Status** — "Em Atendimento" (bolinha amarela piscando)
- **Convênio** ou "Particular"
- **Botão "Registrar Foto"** 📸 — para tirar fotos clínicas (ver seção 6.5)

### Ficha de Anamnese (painel recolhível):
Logo abaixo do cabeçalho do paciente, aparece um painel com o título **"Histórico de Anamnese (Preenchido pela Recepção)"**. Este painel mostra as informações que a secretária preencheu na ficha de anamnese:

- Doenças Crônicas (Sim/Não)
- Alergias (Sim/Não)
- Medicamentos em uso contínuo
- Tabagismo/Etilismo (Sim/Não)
- E demais campos

Clique na seta para **expandir** ou **recolher** este painel.

> 💡 Este painel é **somente leitura** — a médica visualiza, mas não edita aqui. Para alterar a anamnese, a secretária deve atualizá-la no painel dela.

---

### 6.1 Gravação de Áudio

A principal forma de registrar a consulta é por **gravação de voz**. O sistema transcreve e estrutura automaticamente usando Inteligência Artificial.

#### O que você vê:
- **Visualizador de onda** — mostra o som sendo captado em tempo real
- **Timer** — "00:00" — conta o tempo de gravação
- **Botão do microfone** 🎤 — botão grande verde no centro
- **Status** — "Aguardando início..."

#### Passo a passo:

1. **Clique no botão do microfone** 🎤
   - O navegador pode pedir permissão para usar o microfone → clique em **"Permitir"**
   - O status muda para "Gravando..." e o timer começa a contar
   - A onda sonora se movimenta conforme você fala

2. **Realize a consulta normalmente falando**
   - Descreva a queixa do paciente, exame físico, diagnóstico e conduta
   - Se precisar, use o botão **"Pausar" ⏸** para interromper temporariamente

3. **Clique no botão do microfone novamente** para **parar** a gravação
   - O status muda para "Gravação finalizada"
   - Aparece um **player de áudio** para você ouvir o que foi gravado

4. **Ouça a gravação** (recomendado) para verificar se ficou boa

5. **Se quiser regravar:** Clique em **"Gravar Outro"** 🗑 → confirme que deseja descartar

6. **Se ficou boa:** Clique em **"ANALISAR COM IA"** ✨

7. **Aguarde o processamento** — o sistema envia o áudio para a IA que vai:
   - Transcrever tudo o que foi dito
   - Organizar as informações em campos médicos estruturados
   - Preencher automaticamente o prontuário

---

### 6.2 Prontuário Estruturado pela IA

Após o processamento, aparece a seção **"Prontuário Estruturado pela IA"** com os campos já preenchidos pela inteligência artificial:

| Campo | O que contém |
|-------|-------------|
| **História da Doença Atual (HDA)** | Relato detalhado dos sintomas e evolução |
| **Exame Físico** | Achados do exame clínico |
| **Diagnóstico / Hipótese** | A hipótese diagnóstica identificada |
| **Tratamento e Conduta** | Plano de tratamento, medicações, orientações |

> ⚠️ **MUITO IMPORTANTE:** A IA pode errar! **Sempre revise cada campo cuidadosamente.** Todos os campos são editáveis — corrija, adicione ou remova informações conforme necessário.

Para editar: basta clicar dentro do campo de texto e digitar suas correções.

---

### 6.3 Finalizar Consulta

Quando tudo estiver revisado e correto:

1. Clique no botão verde **"Finalizar e Assinar Prontuário"**
2. O sistema pergunta: **"Tem certeza que deseja finalizar?"** → Confirme
3. Aguarde o processamento
4. Uma mensagem confirma: **"Consulta finalizada com sucesso!"**

> ⚠️ **Atenção:** Após finalizar, o prontuário fica **bloqueado** e não pode mais ser editado. Os campos ficam somente leitura e aparece o texto "Prontuário Assinado e Bloqueado".

---

### 6.4 Tela de Conclusão

Após finalizar com sucesso, aparece a tela de **conclusão** com:

- ✅ **"Atendimento Finalizado!"**
- **"O prontuário foi gerado com sucesso e o paciente foi removido da fila ativa."**

**Botões disponíveis:**

| Botão | O que faz |
|-------|-----------|
| **"PRONTUÁRIO PDF"** | Abre o PDF do prontuário gerado. Pode demorar alguns segundos para ficar pronto (o botão mostra um indicador de carregamento) |
| **"PDF IMAGENS"** | Abre o relatório de imagens (só aparece se você tirou fotos durante a consulta) |
| **"Voltar para Fila"** | Retorna ao dashboard para atender o próximo paciente |

---

### 6.5 Fotos Clínicas (Opcional)

Durante a consulta, você pode registrar fotos clínicas que serão anexadas como relatório separado.

#### Como tirar uma foto:
1. Clique em **"Registrar Foto"** 📸 no cabeçalho do paciente
2. Escolha uma opção:
   - **"Câmera ao Vivo"** — usa a câmera do computador/tablet para tirar foto na hora
   - **"Importar Arquivo"** — seleciona uma imagem já salva no seu dispositivo
3. Se usar a câmera:
   - A câmera liga e mostra a imagem ao vivo
   - Clique em **"Capturar Foto"** quando estiver enquadrado
   - Na pré-visualização, adicione uma **legenda** (opcional, ex: "Lesão braço direito")
   - Clique em **"Confirmar Foto"**
4. A foto aparece na grade de fotos abaixo do cabeçalho
5. Você pode tirar **várias fotos** — o contador mostra quantas foram tiradas

> 💡 As fotos serão incluídas em um **PDF separado** (Relatório de Imagens) ao finalizar o atendimento.

---

## 7. 🌓 Modo Escuro / Modo Claro

O sistema tem dois temas visuais:
- ☀️ **Modo Claro** — fundo branco, textos escuros
- 🌙 **Modo Escuro** — fundo escuro, textos claros (ideal para ambientes com pouca luz)

#### Como alternar:
Clique no botão com ícone de **lua** 🌙 (ou **sol** ☀️) no canto superior direito de qualquer tela.

O sistema **lembra** sua preferência — na próxima vez que abrir, continuará no tema que você escolheu.

---

## 8. 🚪 Sair do Sistema (Logout)

Para encerrar sua sessão e sair do sistema:

**Na tela da Secretária:**
- Clique no botão vermelho **"Sair"** 🚪 no canto superior direito

**Na tela da Médica:**
- Clique no **menu ☰** → **"Encerrar Sessão"**

Ao sair, você será redirecionada para a tela de login. Seus dados ficam salvos no sistema — na próxima vez que entrar, tudo estará lá.

> 💡 **Dica de segurança:** Sempre saia do sistema quando terminar de usar, especialmente em computadores compartilhados.

---

## 9. ❓ Perguntas Frequentes (FAQ)

### "O sistema não aceita minha senha"
- Verifique se o **Caps Lock** está ligado — a senha diferencia maiúsculas e minúsculas
- A senha atual é `clinica@2026` — certifique-se de que está digitando exatamente assim
- Verifique se está usando o e-mail correto (`daniele@lm.com` ou `mariana@lm.com`)

### "O microfone não funciona na consulta"
- O navegador precisa de **permissão** para usar o microfone
- Na primeira vez, aparece uma janela perguntando "Permitir?" → clique em **"Permitir"**
- Se bloqueou sem querer: clique no ícone de cadeado 🔒 ao lado do endereço do site → ative o microfone → recarregue a página

### "O botão 'Finalizar' está desabilitado / cinza"
- Você precisa primeiro **gravar o áudio** e clicar em **"Analisar com IA"** antes de poder finalizar
- Aguarde o processamento da IA terminar — os campos precisam estar preenchidos

### "Posso editar um prontuário depois de finalizado?"
- **Não.** Após a finalização, o prontuário é **bloqueado permanentemente** por segurança e conformidade legal. Isso garante a integridade do documento médico.

### "Onde ficam os PDFs dos prontuários?"
- Os PDFs são gerados automaticamente ao finalizar uma consulta
- Para acessá-los: vá ao **Histórico** do paciente e clique em **"Prontuário"** ou **"Ver Laudo"**
- A secretária também pode acessá-los pelo botão **"Prontuários"** na gestão de pacientes

### "A anamnese que preenchi não aparece para a médica"
- Certifique-se de ter clicado em **"SALVAR"** após preencher a ficha
- A médica verá a anamnese automaticamente na próxima vez que abrir a consulta do paciente

### "Posso usar o sistema no celular?"
- **Sim!** O sistema é responsivo e funciona em celulares e tablets
- No celular, o calendário abre automaticamente na visão **Diária** (mais confortável)
- Os pacientes aparecem em **cartões** em vez de tabela

### "Excluí um paciente sem querer. Tem como recuperar?"
- **Não.** A exclusão de pacientes é **permanente**. O sistema pede confirmação justamente por isso
- Sempre leia a mensagem de confirmação antes de clicar em "Excluir Definitivamente"

### "O que é o Relatório Consolidado?"
- É um PDF único que junta **todas as consultas** de um paciente em um só documento
- Útil para encaminhar para outro médico ou para o paciente levar em outra clínica
- Pode ser gerado tanto pela secretária quanto pela médica

### "Como sei se o paciente confirmou a consulta?"
- No calendário, o agendamento aparece em **azul** quando está apenas "Agendado"
- Quando a secretária clica em **"Confirmar Presença"**, ele muda para **verde** (Confirmado)

### "Quantos arquivos posso anexar a um paciente?"
- Não há limite de quantidade, mas cada arquivo pode ter no máximo **10 MB**
- Formatos aceitos: JPG, PNG, WEBP e PDF

### "O PDF do prontuário demora para aparecer"
- Após finalizar a consulta, o sistema precisa de alguns segundos para gerar o PDF
- O botão "PRONTUÁRIO PDF" mostra um indicador de carregamento enquanto processa
- Se demorar mais de 30 segundos, tente acessar pelo histórico mais tarde

---

> 📞 **Suporte:** Em caso de dúvidas ou problemas, entre em contato com o suporte técnico.

---

*© 2026 Prontuar.IO — O futuro do prontuário médico · Software Registrado INPI: BR512026001957-5*
