
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
        // Mantém a mesma tabela de rotas do login.html:
        //   secretaria (L&M)   → secretaria-dashboard.html
        //   medico (qualquer)  → medico-dashboard.html
        //   recepcao / outro   → recepcao.html
        if (isLoginPage) {
            const userRole   = localStorage.getItem('user_role');
            const medicoAtivo = JSON.parse(localStorage.getItem('medico_ativo') || '{}');
            if (userRole === 'secretaria' || medicoAtivo.cargo === 'secretaria') {
                window.location.href = 'secretaria-dashboard.html';
            } else if (userRole === 'medico') {
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
            .select('id, nome, nome_completo, crm, uf_crm, especialidade, assinatura_url, auth_user_id, tipo_clinica, cargo, clinica_id')
            .eq('auth_user_id', userId)
            .single();

        if (error) {
            console.warn('Não encontrou médico pelo auth_user_id, tentando pelo id:', error.message);
            const { data: data2, error: error2 } = await supabaseClient
                .from('medicos')
                .select('id, nome, nome_completo, crm, uf_crm, especialidade, assinatura_url, tipo_clinica, cargo, clinica_id')
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
        const { data, error } = await supabaseClient
            .storage
            .from(bucket)
            .createSignedUrl(path, 300);

        if (error) throw error;
        return data.signedUrl;
    } catch (err) {
        console.error(`Erro ao assinar URL (${bucket}/${path}):`, err.message);
        return null;
    }
}
window.getSignedUrl = getSignedUrl;

/**
 * Verifica se um arquivo EXISTE no bucket e retorna URL assinada somente se existir.
 * Usa storage.list() para checar — mais confiável que createSignedUrl (que retorna URL mesmo sem arquivo).
 */
async function getSignedUrlIfExists(bucket, path) {
    if (!supabaseClient) return null;
    try {
        const lastSlashIndex = path.lastIndexOf('/');
        const dirPath = lastSlashIndex !== -1 ? path.substring(0, lastSlashIndex) : '';
        const fileName = lastSlashIndex !== -1 ? path.substring(lastSlashIndex + 1) : path;

        // Verifica existência via list na subpasta exata
        const { data: listData, error: listError } = await supabaseClient
            .storage
            .from(bucket)
            .list(dirPath, { search: fileName, limit: 1 });

        if (listError || !listData || !listData.some(f => f.name === fileName)) return null;

        // Arquivo existe — gera URL assinada com o caminho completo
        const { data, error } = await supabaseClient
            .storage
            .from(bucket)
            .createSignedUrl(path, 300);

        if (error) throw error;
        return data.signedUrl;
    } catch (err) {
        // Silencioso — arquivo simplesmente não existe ainda
        return null;
    }
}
window.getSignedUrlIfExists = getSignedUrlIfExists;

/**
 * Converte qualquer caminho ou URL do Supabase Storage (seja pública, assinada ou expirada)
 * em uma URL assinada fresca e válida.
 */
async function getSignedUrlForFile(urlOrPath, defaultBucket = 'prontuarios_pdf') {
    if (!urlOrPath) return null;
    
    // Se for data URI (Base64), retorna diretamente
    if (typeof urlOrPath === 'string' && urlOrPath.startsWith('data:')) {
        return urlOrPath;
    }
    
    let bucket = defaultBucket;
    let path = urlOrPath;
    let isSupabaseUrl = false;
    
    if (typeof urlOrPath === 'string' && (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://'))) {
        try {
            const urlObj = new URL(urlOrPath);
            const pathParts = urlObj.pathname.split('/');
            const objectIndex = pathParts.findIndex(part => part === 'public' || part === 'sign' || part === 'authenticated');
            if (objectIndex !== -1 && pathParts.length > objectIndex + 2) {
                bucket = pathParts[objectIndex + 1];
                const cleanPath = pathParts.slice(objectIndex + 2).join('/').split('?')[0];
                path = decodeURIComponent(cleanPath);
                isSupabaseUrl = true;
            } else {
                return urlOrPath;
            }
        } catch (e) {
            console.error('Erro ao converter URL de armazenamento para assinatura:', e);
            return urlOrPath;
        }
    } else {
        // Caminho relativo
        isSupabaseUrl = true;
    }
    
    if (isSupabaseUrl && window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient.storage
                .from(bucket)
                .download(path);
                
            if (!error && data) {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = (err) => reject(err);
                    reader.readAsDataURL(data);
                });
                return base64;
            } else if (error) {
                console.warn(`[getSignedUrlForFile] Falha no download direto (${bucket}/${path}):`, error.message);
            }
        } catch (e) {
            console.error(`[getSignedUrlForFile] Erro ao baixar diretamente (${bucket}/${path}):`, e);
        }
    }
    
    // Fallback: assinar URL
    return await getSignedUrl(bucket, path);
}
window.getSignedUrlForFile = getSignedUrlForFile;


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
