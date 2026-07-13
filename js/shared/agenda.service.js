/**
 * js/shared/agenda.service.js
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade: CRUD completo de agendamentos no Supabase.
 * Isolamento multi-tenant garantido pelas políticas de RLS.
 */

(function () {
    'use strict';

    var TABELA = 'agendamentos';

    function _getSupabase() {
        if (!window.supabaseClient) {
            throw new Error('Supabase client não inicializado.');
        }
        return window.supabaseClient;
    }

    /**
     * Lista os agendamentos com filtros específicos.
     * @param {Object} filtros 
     * @param {string} [filtros.medicoId] 
     * @param {string} [filtros.dataInicio] - Data formato YYYY-MM-DD
     * @param {string} [filtros.dataFim] - Data formato YYYY-MM-DD
     * @returns {Promise<Array>} Lista de agendamentos
     */
    async function listar(filtros) {
        var supabase = _getSupabase();
        filtros = filtros || {};

        var query = supabase
            .from(TABELA)
            .select('*, pacientes(id, nome, telefone), medicos(id, nome)');

        if (filtros.medicoId) {
            query = query.eq('medico_id', filtros.medicoId);
        }
        if (filtros.dataInicio) {
            query = query.gte('data_agendamento', filtros.dataInicio);
        }
        if (filtros.dataFim) {
            query = query.lte('data_agendamento', filtros.dataFim);
        }

        // Ordenar por data e hora do agendamento
        query = query.order('data_agendamento', { ascending: true })
                     .order('horario', { ascending: true });

        var res = await query;
        if (res.error) throw res.error;
        return res.data || [];
    }

    /**
     * Cria um novo agendamento.
     * @param {Object} dados 
     * @param {string} dados.pacienteId
     * @param {string} dados.medicoId
     * @param {string} dados.dataAgendamento - YYYY-MM-DD
     * @param {string} dados.horario - HH:MM
     * @param {string} [dados.observacoes]
     * @returns {Promise<Object>} Agendamento criado
     */
    async function criar(dados) {
        var supabase = _getSupabase();
        var medicoLocal = JSON.parse(localStorage.getItem('medico_ativo') || '{}');

        var payload = {
            paciente_id:      dados.pacienteId,
            medico_id:        dados.medicoId,
            data_agendamento: dados.dataAgendamento,
            horario:          dados.horario,
            observacoes:      dados.observacoes || null,
            status:           'agendado',
            created_by:       medicoLocal.id || null,
            clinica_id:       medicoLocal.clinica_id || null,  // obrigatório para RLS tenant isolation
            tipo_agendamento: dados.tipoAgendamento || null
        };

        var res = await supabase
            .from(TABELA)
            .insert(payload)
            .select('*, pacientes(id, nome), medicos(id, nome)')
            .single();

        if (res.error) throw res.error;
        return res.data;
    }

    /**
     * Atualiza dados de um agendamento.
     * @param {string} id 
     * @param {Object} dados 
     * @returns {Promise<Object>}
     */
    async function atualizar(id, dados) {
        var supabase = _getSupabase();
        
        var res = await supabase
            .from(TABELA)
            .update(dados)
            .eq('id', id)
            .select()
            .single();

        if (res.error) throw res.error;
        return res.data;
    }

    /**
     * Confirma a presença do paciente no agendamento.
     * @param {string} id 
     * @returns {Promise<Object>}
     */
    async function confirmar(id) {
        return atualizar(id, { status: 'confirmado' });
    }

    /**
     * Inicia o atendimento médico associado a um agendamento.
     * @param {string} id 
     * @param {string} consultaId - ID da consulta gerada
     * @returns {Promise<Object>}
     */
    async function iniciarAtendimento(id, consultaId) {
        return atualizar(id, { 
            status: 'em_atendimento',
            consulta_id: consultaId 
        });
    }

    /**
     * Finaliza o atendimento médico.
     * @param {string} id 
     * @returns {Promise<Object>}
     */
    async function finalizarAtendimento(id) {
        return atualizar(id, { status: 'finalizado' });
    }

    /**
     * Cancela um agendamento.
     * @param {string} id 
     * @param {string} motivo 
     * @returns {Promise<Object>}
     */
    async function cancelar(id, motivo) {
        return atualizar(id, {
            status:           'cancelado',
            cancelado_em:     new Date().toISOString(),
            cancelado_motivo: motivo || null
        });
    }

    /**
     * Remarca um agendamento para nova data e horário.
     * Cria um novo registro mantendo o vínculo com o original.
     * @param {string} id - ID do agendamento original
     * @param {Object} novosDados 
     * @param {string} novosDados.dataAgendamento - YYYY-MM-DD
     * @param {string} novosDados.horario - HH:MM
     * @param {string} [novosDados.observacoes]
     * @returns {Promise<Object>} O novo agendamento criado
     */
    async function remarcar(id, novosDados) {
        var supabase = _getSupabase();

        // 1. Buscar agendamento original para duplicar
        var resOrig = await supabase
            .from(TABELA)
            .select('*')
            .eq('id', id)
            .single();

        if (resOrig.error) throw resOrig.error;
        var original = resOrig.data;

        // 2. Criar novo agendamento apontando para o original
        var medicoLocal = JSON.parse(localStorage.getItem('medico_ativo') || '{}');
        var novoPayload = {
            clinica_id:       original.clinica_id,
            paciente_id:      original.paciente_id,
            medico_id:        original.medico_id,
            data_agendamento: novosDados.dataAgendamento,
            horario:          novosDados.horario,
            observacoes:      novosDados.observacoes || original.observacoes,
            status:           'agendado',
            remarcado_de:     id,
            created_by:       medicoLocal.id || null
        };

        var resNovo = await supabase
            .from(TABELA)
            .insert(novoPayload)
            .select('*, pacientes(id, nome), medicos(id, nome)')
            .single();

        if (resNovo.error) throw resNovo.error;

        // 3. Atualizar status do original para 'remarcado'
        await atualizar(id, { status: 'remarcado' });

        return resNovo.data;
    }

    window.AgendaService = {
        listar:             listar,
        criar:              criar,
        atualizar:          atualizar,
        confirmar:          confirmar,
        iniciarAtendimento: iniciarAtendimento,
        finalizarAtendimento: finalizarAtendimento,
        cancelar:           cancelar,
        remarcar:           remarcar
    };
})();
