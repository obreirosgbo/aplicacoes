// ============================================
// LÓGICA DE LOGIN E REGISTRO
// ============================================

/**
 * Inicializa eventos da página de login
 */
async function inicializarLoginPage() {
    console.log('[LOGIN] Inicializando página de login...');

    // Verificar se já há sessão ativa e redirecionar conforme role
    try {
        const session = await supabaseGetSession();
        if (session) {
            const perfil = await supabaseGetProfile(session.user.id);
            if (perfil && perfil.status === 'approved') {
                if (perfil.role === 'admin') redirecionarParaDashboard();
                else redirecionarParaTransparencia();
                return;
            }
        }
    } catch (e) {
        // Sem sessão — continua normalmente na página de login
    }
    
    // Configurar abas
    configurarAbas();
    
    // Configurar formulários
    configurarFormularios();
    
    // Configurar modal de recuperação
    configurarModalRecuperacao();
    
    // Configurar toggle de senha
    configurarToggleSenha();
    
    // Configurar força de senha
    configurarForcaSenha();
    
    // Configurar alertas
    configurarAlertas();
    
    console.log('[LOGIN] Página de login inicializada');
}

// ============================================
// ABAS
// ============================================

/**
 * Configura navegação entre abas
 */
function configurarAbas() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Remover ativa de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.form-container').forEach(c => {
                c.classList.remove('active');
            });
            
            // Adicionar ativa ao clicado
            btn.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
            
            // Limpar erros
            limparErrosFormulario(tabName);
        });
    });
}

// ============================================
// FORMULÁRIOS
// ============================================

/**
 * Configura eventos dos formulários
 */
function configurarFormularios() {
    // Formulário de login
    document.getElementById('form-login').addEventListener('submit', handleLoginSubmit);
    
    // Formulário de registro
    document.getElementById('form-registro').addEventListener('submit', handleRegistroSubmit);
    
    // Formulário de recuperação
    document.getElementById('form-recuperar').addEventListener('submit', handleRecuperacaoSubmit);
}

/**
 * Handler do formulário de login
 */
async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const lembrarMe = document.getElementById('lembrar-me').checked;
    
    // Validar
    if (!validarEmail(email)) {
        mostrarErro('login', 'email', 'Email inválido');
        return;
    }
    
    if (!senha || senha.length < 3) {
        mostrarErro('login', 'senha', 'Senha inválida');
        return;
    }
    
    try {
        // Mostrar carregamento
        const btn = document.querySelector('.btn-login-submit');
        mostrarCarregamento(btn);
        
        // Fazer login
        const usuario = await login(email, senha);
        
        // Salvar preferência de lembrar
        if (lembrarMe) {
            localStorage.setItem('lembrar_email', email);
        }
        
        // Redirecionar conforme role
        mostrarSucesso('login', 'Login realizado com sucesso! Redirecionando...');
        setTimeout(() => {
            if (usuario.role === 'admin') redirecionarParaDashboard();
            else redirecionarParaTransparencia();
        }, 1500);
        
    } catch (erro) {
        ocultarCarregamento(document.querySelector('.btn-login-submit'));
        mostrarErroAlert('login', erro.message);
    }
}

/**
 * Handler do formulário de registro
 */
async function handleRegistroSubmit(e) {
    e.preventDefault();
    
    const nome = document.getElementById('registro-nome').value.trim();
    const email = document.getElementById('registro-email').value.trim();
    const senha = document.getElementById('registro-senha').value;
    const confirmacao = document.getElementById('registro-confirmacao').value;
    const aceitarTermos = document.getElementById('aceitar-termos').checked;
    
    // Validar
    const erros = validarDadosRegistro({
        nome,
        email,
        senha,
        confirmacaoSenha: confirmacao
    });
    
    if (erros.length > 0) {
        mostrarErroAlert('registro', erros[0]);
        return;
    }
    
    if (!aceitarTermos) {
        mostrarErro('registro', 'termos', 'Você deve aceitar os termos');
        return;
    }
    
    try {
        // Mostrar carregamento
        const btn = document.querySelector('.btn-registro-submit');
        mostrarCarregamento(btn);
        
        // Registrar
        await registrar({
            nome,
            email,
            senha,
            confirmacaoSenha: confirmacao
        });
        
        // Limpar formulário e mostrar mensagem de aguardo
        document.getElementById('form-registro').reset();
        mostrarSucesso('registro',
            'Solicitação enviada! Seu acesso será analisado pelo administrador. Você será notificado quando for aprovado.'
        );
        
    } catch (erro) {
        ocultarCarregamento(document.querySelector('.btn-registro-submit'));
        mostrarErroAlert('registro', erro.message);
    }
}

/**
 * Handler do formulário de recuperação
 */
async function handleRecuperacaoSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('recuperar-email').value.trim();
    
    if (!validarEmail(email)) {
        mostrarErro('recuperar', 'email', 'Email inválido');
        return;
    }
    
    try {
        const btn = document.querySelector('#form-recuperar .btn-submit');
        mostrarCarregamento(btn);
        
        await solicitarRecuperacaoSenha(email);
        
        mostrarSucesso('recuperar', 'Email de recuperação enviado! Verifique sua caixa de entrada.');
        
        setTimeout(() => {
            fecharModalRecuperacao();
            document.getElementById('form-recuperar').reset();
        }, 2000);
        
    } catch (erro) {
        ocultarCarregamento(document.querySelector('#form-recuperar .btn-submit'));
        mostrarErroAlert('recuperar', erro.message);
    }
}

// ============================================
// MODAL DE RECUPERAÇÃO
// ============================================

/**
 * Configura modal de recuperação de senha
 */
function configurarModalRecuperacao() {
    const linkRecuperar = document.getElementById('link-recuperar-login');
    const modal = document.getElementById('modal-recuperar');
    const overlay = document.getElementById('modal-overlay');
    const fecharBtn = document.getElementById('fechar-modal-recuperar');
    
    linkRecuperar.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModalRecuperacao();
    });
    
    fecharBtn.addEventListener('click', fecharModalRecuperacao);
    overlay.addEventListener('click', fecharModalRecuperacao);
}

/**
 * Abre modal de recuperação
 */
function abrirModalRecuperacao() {
    document.getElementById('modal-recuperar').classList.add('show');
    document.getElementById('modal-overlay').classList.add('show');
}

/**
 * Fecha modal de recuperação
 */
function fecharModalRecuperacao() {
    document.getElementById('modal-recuperar').classList.remove('show');
    document.getElementById('modal-overlay').classList.remove('show');
}

// ============================================
// TOGGLE DE SENHA
// ============================================

/**
 * Configura botões de mostrar/ocultar senha
 */
function configurarToggleSenha() {
    const toggleBtns = document.querySelectorAll('.toggle-password');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const inputId = btn.dataset.target;
            const input = document.getElementById(inputId);
            
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });
    });
}

// ============================================
// FORÇA DE SENHA
// ============================================

/**
 * Configura indicador de força de senha
 */
function configurarForcaSenha() {
    const senhaInput = document.getElementById('registro-senha');
    
    senhaInput.addEventListener('input', () => {
        const forca = calcularForcaSenha(senhaInput.value);
        atualizarIndicadorForca(forca);
    });
}

/**
 * Calcula força da senha
 */
function calcularForcaSenha(senha) {
    let forca = 0;
    
    if (senha.length >= 8) forca++;
    if (senha.length >= 12) forca++;
    if (/[a-z]/.test(senha)) forca++;
    if (/[A-Z]/.test(senha)) forca++;
    if (/\d/.test(senha)) forca++;
    if (/[@$!%*?&]/.test(senha)) forca++;
    
    return forca;
}

/**
 * Atualiza indicador de força
 */
function atualizarIndicadorForca(forca) {
    const input = document.getElementById('registro-senha');
    const forcaDiv = document.getElementById('forca-senha');
    const forcaText = forcaDiv.querySelector('.strength-text');
    
    // Remover classes anteriores
    input.classList.remove('strength-fraca', 'strength-media', 'strength-forte', 'strength-muito-forte');
    
    if (forca <= 2) {
        input.classList.add('strength-fraca');
        forcaText.textContent = 'Força: Fraca';
    } else if (forca <= 4) {
        input.classList.add('strength-media');
        forcaText.textContent = 'Força: Média';
    } else if (forca <= 5) {
        input.classList.add('strength-forte');
        forcaText.textContent = 'Força: Forte';
    } else {
        input.classList.add('strength-muito-forte');
        forcaText.textContent = 'Força: Muito Forte';
    }
}

// ============================================
// ALERTAS
// ============================================

/**
 * Configura eventos dos alertas
 */
function configurarAlertas() {
    document.querySelectorAll('.alert-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.alert').style.display = 'none';
        });
    });
}

/**
 * Mostra erro em campo específico
 */
function mostrarErro(formulario, campo, mensagem) {
    const erroEl = document.getElementById(`erro-${campo}-${formulario}`);
    if (erroEl) {
        erroEl.textContent = mensagem;
        erroEl.classList.add('show');
    }
}

/**
 * Mostra erro em alerta
 */
function mostrarErroAlert(formulario, mensagem) {
    const alertEl = document.getElementById(`alerta-${formulario}`);
    if (alertEl) {
        alertEl.querySelector('.alert-text').textContent = mensagem;
        alertEl.style.display = 'flex';
    }
}

/**
 * Mostra sucesso
 */
function mostrarSucesso(formulario, mensagem) {
    const alertEl = document.getElementById(`alerta-sucesso-${formulario}`);
    if (alertEl) {
        alertEl.querySelector('.alert-text').textContent = mensagem;
        alertEl.style.display = 'flex';
    }
}

/**
 * Limpa erros do formulário
 */
function limparErrosFormulario(formulario) {
    document.querySelectorAll(`#alerta-${formulario}, #alerta-sucesso-${formulario}`).forEach(el => {
        el.style.display = 'none';
    });
    
    document.querySelectorAll(`[id*="erro-"][id*="-${formulario}"]`).forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

// ============================================
// CARREGAMENTO
// ============================================

/**
 * Mostra estado de carregamento
 */
function mostrarCarregamento(btn) {
    btn.disabled = true;
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'flex';
}

/**
 * Oculta estado de carregamento
 */
function ocultarCarregamento(btn) {
    btn.disabled = false;
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loader').style.display = 'none';
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarLoginPage);
} else {
    inicializarLoginPage();
}

// Expõe redirecionarParaTransparencia para uso no login.js
function redirecionarParaTransparencia() {
    window.location.href = 'transparencia.html';
}