// ============================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================
// Substitua os valores abaixo após criar seu projeto:
// https://app.supabase.com → Settings → API

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// AUTH — ENTRAR / SAIR / REGISTRAR
// ============================================

async function supabaseSignIn(email, senha) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message);
    return data;
}

async function supabaseSignUp(email, senha, nome, consentimentoLGPD) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: senha,
        options: {
            data: {
                nome,
                consentimento_lgpd: consentimentoLGPD,      // Art. 7 e 8 LGPD
                data_consentimento: new Date().toISOString()  // Registro do momento do consentimento
            }
        }
    });
    if (error) throw new Error(error.message);
    return data;
}

async function supabaseSignOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw new Error(error.message);
}

async function supabaseGetSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

// ============================================
// PERFIS — LER
// ============================================

async function supabaseGetProfile(userId) {
    // Seleciona apenas os campos necessários — Art. 6, III LGPD (Necessidade)
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, nome, email, role, status, consentimento_lgpd, created_at')
        .eq('id', userId)
        .single();
    if (error) throw new Error(error.message);
    return data;
}

async function supabaseGetAllProfiles() {
    // Admin vê apenas o necessário para gerir acessos — Art. 6, III LGPD
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, nome, email, status, created_at')
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
}

// ============================================
// STATUS — ATUALIZAÇÃO VIA RPC AUDITADA
// ============================================

// Toda alteração de status passa pela função SQL admin_update_user_status,
// que registra o audit_log e impede modificação de outros campos.
// Isso garante Art. 6 (Finalidade/Necessidade) e Art. 46 (Segurança) da LGPD.
async function supabaseUpdateProfileStatus(userId, novoStatus) {
    const { error } = await supabaseClient.rpc('admin_update_user_status', {
        p_user_id: userId,
        p_new_status: novoStatus
    });
    if (error) throw new Error(error.message);
}

// ============================================
// DIREITO AO ESQUECIMENTO — Art. 18, IV LGPD
// ============================================

async function supabaseSolicitarExclusaoDados() {
    const { error } = await supabaseClient.rpc('solicitar_exclusao_dados');
    if (error) throw new Error(error.message);
}
