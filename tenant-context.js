/**
 * tenant-context.js — Multi-Tenant Isolation Layer
 * =================================================
 * Resolves whether the authenticated doctor is:
 *   (A) STANDALONE — operates alone, owns their own patients & schedule
 *   (B) CLINIC     — belongs to a clinic, shares clinic patients & schedule
 *
 * Exposes a single global: window.TenantContext
 *
 * ISOLATION RULES (enforced here AND in Supabase RLS):
 *  - Standalone: scope ALL queries to medico_id only, clinica_id IS NULL
 *  - Clinic:     scope ALL queries to clinica_id only
 *  - NEVER mix contexts. A clinic doctor cannot access standalone data.
 *  - Different clinics CANNOT see each other's data.
 */

console.log('[tenant-context.js] Multi-tenant isolation module loaded.');

(function () {
  'use strict';

  // ── Constants ───────────────────────────────────────────────────────
  const CONTEXT_TYPE = Object.freeze({
    STANDALONE: 'STANDALONE',
    CLINIC:     'CLINIC',
  });

  // ── Internal state ──────────────────────────────────────────────────
  let _resolved = false;
  let _context  = null;

  /**
   * Resolves and caches the tenant context from Supabase.
   * Must be called after supabaseClient and fetchMedicoData are available.
   *
   * @returns {Promise<TenantContext>}
   */
  async function resolve() {
    if (_resolved && _context) return _context;

    if (!window.supabaseClient) {
      throw new Error('[tenant-context] supabaseClient not available. Load auth-guard.js first.');
    }

    // 1. Get auth session
    const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();
    if (sessionError || !session?.user?.id) {
      throw new Error('[tenant-context] No valid auth session. Redirect to login.');
    }

    // 2. Fetch medico record (includes clinica_id if set)
    const authUserId = session.user.id;
    const { data: medico, error: medicoError } = await window.supabaseClient
      .from('medicos')
      .select('id, nome, crm, especialidade, clinica_id, auth_user_id')
      .eq('auth_user_id', authUserId)
      .single();

    if (medicoError || !medico?.id) {
      throw new Error('[tenant-context] Doctor record not found. Contact support.');
    }

    // 3. Determine context type
    const isClinic = !!medico.clinica_id;

    let clinicaInfo = null;
    if (isClinic) {
      // Fetch clinic record — RLS will block if doctor doesn't belong to it
      const { data: clinica, error: clinicaError } = await window.supabaseClient
        .from('clinicas')
        .select('id, nome, cidade, uf')
        .eq('id', medico.clinica_id)
        .single();

      if (clinicaError || !clinica) {
        console.error('[tenant-context] Could not load clinic — RLS blocked or missing record.', clinicaError);
        throw new Error('[tenant-context] Clinic access denied. Possible isolation violation.');
      }
      clinicaInfo = clinica;
    }

    // 4. Build context object
    _context = Object.freeze({
      // Type identifier
      type: isClinic ? CONTEXT_TYPE.CLINIC : CONTEXT_TYPE.STANDALONE,

      // Doctor info
      medicoId:   medico.id,
      medicoNome: medico.nome,
      medicoCrm:  medico.crm,

      // Clinic info (null if standalone)
      clinicaId:   isClinic ? medico.clinica_id : null,
      clinicaNome: isClinic ? clinicaInfo.nome  : null,

      // Convenience flags
      isStandalone: !isClinic,
      isClinic:      isClinic,

      /**
       * Returns the Supabase query filter object to scope ANY query
       * to this tenant's data.
       *
       * Usage (standalone):   .eq('medico_id', ctx.scopeFilter().medico_id)
       * Usage (clinic):       .eq('clinica_id', ctx.scopeFilter().clinica_id)
       */
      scopeFilter() {
        if (isClinic) {
          return { field: 'clinica_id', value: medico.clinica_id };
        }
        return { field: 'medico_id', value: medico.id };
      },

      /**
       * Applies the tenant scope to a supabase query builder.
       * @param {object} query - A supabase query (e.g. supabaseClient.from('table').select('*'))
       * @returns {object} - The same query with .eq() applied
       */
      applyScope(query) {
        const { field, value } = this.scopeFilter();
        return query.eq(field, value);
      },

      /**
       * Validates that a data record belongs to this tenant.
       * Use before rendering any patient/consult data.
       *
       * @param {object} record - A data record (paciente, consulta, etc.)
       * @returns {boolean}
       */
      validateRecord(record) {
        if (!record) return false;
        if (isClinic) {
          return record.clinica_id === medico.clinica_id;
        }
        // Standalone: record must belong to this doctor AND have no clinic
        return record.medico_id === medico.id && !record.clinica_id;
      },

      /**
       * Returns a human-readable context label for debugging/display.
       */
      label() {
        if (isClinic) return `Clínica: ${clinicaInfo.nome} (ID: ${medico.clinica_id})`;
        return `Médico Autônomo: ${medico.nome} (ID: ${medico.id})`;
      },
    });

    _resolved = true;
    console.log(`[tenant-context] ✅ Context resolved → ${_context.label()}`);

    // Persist minimum info to localStorage for fast access
    _persistToLocalStorage(_context);

    return _context;
  }

  /**
   * Returns the already-resolved context (synchronous).
   * Throws if resolve() hasn't been called yet.
   */
  function get() {
    if (!_resolved || !_context) {
      throw new Error('[tenant-context] Context not resolved yet. Call await TenantContext.resolve() first.');
    }
    return _context;
  }

  /**
   * Clears the cached context (call on logout).
   */
  function clear() {
    _resolved = false;
    _context  = null;
    localStorage.removeItem('tenant_context_cache');
    console.log('[tenant-context] Context cleared (logout).');
  }

  /**
   * Validates and rejects cross-tenant access attempts.
   * Call this before any operation that accepts external data.
   *
   * @param {string} operationName - Descriptive name for logging
   * @param {object} record - The record being accessed
   * @throws {Error} if isolation is violated
   */
  function assertIsolation(operationName, record) {
    const ctx = get();
    if (!ctx.validateRecord(record)) {
      const msg = `[tenant-context] ❌ ISOLATION VIOLATION in "${operationName}"
        Context: ${ctx.label()}
        Record medico_id: ${record?.medico_id}
        Record clinica_id: ${record?.clinica_id}`;
      console.error(msg);
      throw new Error(`Acesso negado: dados fora do escopo do seu contexto (${ctx.label()}).`);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  function _persistToLocalStorage(ctx) {
    try {
      const cache = {
        type:       ctx.type,
        medicoId:   ctx.medicoId,
        medicoNome: ctx.medicoNome,
        clinicaId:  ctx.clinicaId,
        clinicaNome: ctx.clinicaNome,
        cachedAt:   Date.now(),
      };
      localStorage.setItem('tenant_context_cache', JSON.stringify(cache));
    } catch (e) {
      console.warn('[tenant-context] Could not persist to localStorage:', e);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.TenantContext = Object.freeze({
    CONTEXT_TYPE,
    resolve,
    get,
    clear,
    assertIsolation,
  });

})();
