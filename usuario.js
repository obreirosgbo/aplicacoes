// ============================================
// MÓDULO DE AUTENTICAÇÃO — SUPABASE
// ============================================

const USUARIO_CONFIG = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
};

let usuarioState = {
    autenticado: false,
    usuario: null,
    perfil: null,
    carregando: false,
    erro: null
};

// ============================================
// INICIALIZAÇÃO
// ============================================

async function inicializarUsuario() {
    console.log('[USUARIO] Inicializando...');

    try {
        const session = await supabaseGetSession();

        if (!session) {
            redirecionarParaLogin();
            return;
        }

        const perfil = await supabaseGetProfile(session.user.id);

        usuarioState.autenticado = true;
        usuarioState.usuario = session.user;
        usuarioState.perfil = perfil;

        // Guard de rota
        const pagina = window.location.pathname;

        if (pagina.includes('index.html') || pagina.endsWith('/')) {
            if (perfil.role !== 'admin') {
                redirecionarParaTransparencia();
                return;
            }
        }

        if (pagina.includes('transparencia.html')) {
            if (perfil.role !== 'user' || perfil.status !== 'approved') {
                redirecionarParaLogin();
                return;
            }
        }

        // Exibir nome do usuário na sidebar, se existir o elemento
        const nomeEl = document.getElementById('user-name');
        if (nomeEl) nomeEl.textContent = perfil.nome;

        console.log('[USUARIO] Sessão ativa:', perfil.email, '| role:', perfil.role);

    } catch (erro) {
        console.error('[USUARIO] Erro ao inicializar:', erro);
        redirecionarParaLogin();
    }
}

// ============================================
// LOGIN
// ============================================

async function login(email, senha) {
    try {
        usuarioState.carregando = true;

        if (!validarEmail(email)) throw new Error('Email inválido');
        if (!senha || senha.length < 3) throw new Error('Senha inválida');

        const dados = await supabaseSignIn(email, senha);
        const perfil = await supabaseGetProfile(dados.user.id);

        if (perfil.status === 'pending') {
            await supabaseSignOut();
            throw new Error('Seu acesso ainda não foi aprovado. Aguarde a liberação pelo administrador.');
        }

        if (perfil.status === 'rejected') {
            await supabaseSignOut();
            throw new Error('Seu acesso foi negado. Entre em contato com o administrador.');
        }

        usuarioState.autenticado = true;
        usuarioState.usuario = dados.user;
        usuarioState.perfil = perfil;

        return perfil;

    } catch (erro) {
        usuarioState.erro = erro.message;
        throw erro;
    } finally {
        usuarioState.carregando = false;
    }
}

// ============================================
// REGISTRO
// ============================================

async function registrar(dados) {
    try {
        usuarioState.carregando = true;

        const erros = validarDadosRegistro(dados);
        if (erros.length > 0) throw new Error(erros[0]);

        // consentimentoLGPD deve ser true — o form exige o aceite antes de chegar aqui
        await supabaseSignUp(
            dados.email.toLowerCase().trim(),
            dados.senha,
            dados.nome.trim(),
            true  // consentimento LGPD — Art. 7 e 8
        );

        // O trigger no Supabase cria o perfil automaticamente com status='pending'
        console.log('[USUARIO] Cadastro enviado. Aguardando aprovação.');

    } catch (erro) {
        usuarioState.erro = erro.message;
        throw erro;
    } finally {
        usuarioState.carregando = false;
    }
}

// ============================================
// LOGOUT
// ============================================

async function logout(mensagem = null) {
    try {
        await supabaseSignOut();
    } catch (e) {
        console.warn('[USUARIO] Erro no signOut:', e);
    } finally {
        usuarioState.autenticado = false;
        usuarioState.usuario = null;
        usuarioState.perfil = null;
        if (mensagem) alert(mensagem);
        redirecionarParaLogin();
    }
}

// ============================================
// VALIDAÇÕES
// ============================================

function validarEmail(email) {
    return USUARIO_CONFIG.EMAIL_REGEX.test(email);
}

function validarSenha(senha) {
    if (!senha || senha.length < USUARIO_CONFIG.PASSWORD_MIN_LENGTH) return false;
    return USUARIO_CONFIG.PASSWORD_REGEX.test(senha);
}

function validarDadosRegistro(dados) {
    const erros = [];
    if (!dados.email || !validarEmail(dados.email)) erros.push('Email inválido');
    if (!dados.nome || dados.nome.trim().length < 3) erros.push('Nome deve ter pelo menos 3 caracteres');
    if (!validarSenha(dados.senha)) {
        erros.push('Senha deve ter mínimo 8 caracteres, letra maiúscula, minúscula, número e caractere especial (@$!%*?&)');
    }
    if (dados.senha !== dados.confirmacaoSenha) erros.push('As senhas não coincidem');
    return erros;
}

// ============================================
// GETTERS
// ============================================

function estaAutenticado() {
    return usuarioState.autenticado;
}

function obterUsuarioAtual() {
    return usuarioState.usuario;
}

function obterPerfilAtual() {
    return usuarioState.perfil;
}

function obterNomeUsuario() {
    return usuarioState.perfil ? usuarioState.perfil.nome : null;
}

function obterEmailUsuario() {
    return usuarioState.usuario ? usuarioState.usuario.email : null;
}

function obterIdUsuario() {
    return usuarioState.usuario ? usuarioState.usuario.id : null;
}

function temPapel(papel) {
    return usuarioState.perfil ? usuarioState.perfil.role === papel : false;
}

function obterEstadoUsuario() {
    return {
        autenticado: usuarioState.autenticado,
        usuario: usuarioState.usuario,
        perfil: usuarioState.perfil,
        carregando: usuarioState.carregando,
        erro: usuarioState.erro
    };
}

// ============================================
// REDIRECIONAMENTO
// ============================================

function redirecionarParaLogin() {
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
}

function redirecionarParaDashboard() {
    window.location.href = 'index.html';
}

function redirecionarParaTransparencia() {
    window.location.href = 'transparencia.html';
}

// ============================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================

// Promise compartilhada — app.js e transparencia.js aguardam esta promise
// em vez de usar setTimeout, eliminando a race condition
let _inicializacaoPromise = null;

function aguardarInicializacao() {
    return _inicializacaoPromise;
}

// Só inicializa nas páginas protegidas (não na login.html)
if (!window.location.pathname.includes('login.html')) {
    if (document.readyState === 'loading') {
        _inicializacaoPromise = new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', () =>
                inicializarUsuario().then(resolve).catch(resolve)
            );
        });
    } else {
        _inicializacaoPromise = inicializarUsuario();
    }
}
