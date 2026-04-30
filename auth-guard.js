
// Configurações do Supabase
const SUPABASE_URL = 'https://bkkdexuzrjouafrwzdsw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJra2RleHV6cmpvdWFmcnd6ZHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzMwOTUsImV4cCI6MjA4NTYwOTA5NX0.yxnTQ9CuQKcOrY4aPoWCUpJxFwusHHwHV2fVc5jzVkI';

// ===========================================================
// Inicializa o cliente Supabase COM PROTEÇÃO contra CDN offline
// ===========================================================
let supabaseClient = null;
try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('[auth-guard] SDK Supabase não carregou do CDN. Funcionalidades de auth limitadas.');
    }
} catch (e) {
    console.error('[auth-guard] Erro ao criar cliente Supabase:', e);
}
window.supabaseClient = supabaseClient;

/**
 * Função global para proteger as rotas.
 * Se o usuário não tiver uma sessão ativa, redireciona para login.html
 */
async function checkAuth() {
    const isLoginPage = window.location.pathname.includes('login.html');

    // Se o SDK não carregou, usa localStorage como fallback
    if (!supabaseClient || !supabaseClient.auth) {
        console.warn('[auth-guard] Supabase client indisponível, usando localStorage.');
        const secretariaAtiva = localStorage.getItem('secretaria_ativa');
        if (!secretariaAtiva && !isLoginPage) {
            window.location.href = 'login.html';
        }
        return null;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (!session) {
            if (!isLoginPage) {
                console.warn("Sessão não encontrada. Redirecionando para login...");
                window.location.href = 'login.html';
            }
            return null;
        }

        // Usuário está logado — se tentar acessar login, redireciona para a área correta
        if (isLoginPage) {
            const userRole = localStorage.getItem('user_role');
            if (userRole === 'medico') {
                window.location.href = 'medico-dashboard.html';
            } else {
                window.location.href = 'recepcao.html';
            }
            return session;
        }

        return session;
    } catch (err) {
        console.error('[auth-guard] Erro em checkAuth:', err);
        // Fallback: usa localStorage
        const secretariaAtiva = localStorage.getItem('secretaria_ativa');
        if (!secretariaAtiva && !isLoginPage) {
            window.location.href = 'login.html';
        }
        return null;
    }
}

/**
 * Busca os dados do médico logado na tabela 'medicos' do banco de dados.
 * Usa o auth_user_id (UUID do Supabase Auth) para encontrar o registro correto.
 * @returns {Promise<Object|null>} - Dados do médico ou null
 */
async function fetchMedicoData(userId) {
    if (!supabaseClient) return null;
    try {
        const { data, error } = await supabaseClient
            .from('medicos')
            .select('id, nome, crm, especialidade, auth_user_id, tipo_clinica')
            .eq('auth_user_id', userId)
            .single();

        if (error) {
            console.warn('Não encontrou médico pelo auth_user_id, tentando pelo id:', error.message);
            const { data: data2, error: error2 } = await supabaseClient
                .from('medicos')
                .select('id, nome, crm, especialidade, tipo_clinica')
                .eq('id', userId)
                .single();
            
            if (error2) {
                console.warn('Médico não encontrado na tabela medicos:', error2.message);
                return null;
            }
            return data2;
        }
        return data;
    } catch (err) {
        console.error('Erro ao buscar dados do médico:', err);
        return null;
    }
}

/**
 * Gera uma URL assinada temporária para arquivos privados no bucket Supabase.
 * Retorna null se o arquivo não existir ou houver erro.
 */
async function getSignedUrl(bucket, path) {
    if (!supabaseClient) return null;
    try {
        const fileName = path.includes('/') ? path.split('/').pop() : path;
        const { data, error } = await supabaseClient
            .storage
            .from(bucket)
            .createSignedUrl(fileName, 300);

        if (error) throw error;
        return data.signedUrl;
    } catch (err) {
        console.error(`Erro ao assinar URL (${bucket}/${path}):`, err.message);
        return null;
    }
}

/**
 * Verifica se um arquivo EXISTE no bucket e retorna URL assinada somente se existir.
 * Usa storage.list() para checar — mais confiável que createSignedUrl (que retorna URL mesmo sem arquivo).
 */
async function getSignedUrlIfExists(bucket, path) {
    if (!supabaseClient) return null;
    try {
        const fileName = path.includes('/') ? path.split('/').pop() : path;

        // Verifica existência via list (busca exata pelo nome)
        const { data: listData, error: listError } = await supabaseClient
            .storage
            .from(bucket)
            .list('', { search: fileName, limit: 1 });

        if (listError || !listData || listData.length === 0) return null;

        // Arquivo existe — gera URL assinada
        const { data, error } = await supabaseClient
            .storage
            .from(bucket)
            .createSignedUrl(fileName, 300);

        if (error) throw error;
        return data.signedUrl;
    } catch (err) {
        // Silencioso — arquivo simplesmente não existe ainda
        return null;
    }
}
window.getSignedUrlIfExists = getSignedUrlIfExists;

/**
 * Retorna os headers de autenticação com o token JWT atual do Supabase
 */
async function getAuthHeaders() {
    if (!supabaseClient || !supabaseClient.auth) return {};
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session && session.access_token) {
            return {
                'Authorization': `Bearer ${session.access_token}`
            };
        }
    } catch (e) {
        console.error("Erro ao obter headers de autenticação:", e);
    }
    return {};
}
window.getAuthHeaders = getAuthHeaders;
window.fetchMedicoData = fetchMedicoData;

/**
 * Retorna o medico_id do localStorage (populado no login)
 * Fonte única de verdade para medico_id no frontend.
 */
function getMedicoId() {
    try {
        const raw = localStorage.getItem('medico_ativo');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.id) return parsed.id;
        }
    } catch (e) {
        console.warn('[auth-guard] Erro ao ler medico_ativo do localStorage:', e);
    }
    return null;
}
window.getMedicoId = getMedicoId;

// Executa a checação imediatamente ao carregar o script
// (Exceto se for a página de login, onde a checagem é manual no form)
if (!window.location.pathname.includes('login.html')) {
    checkAuth();
}
