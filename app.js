// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO E LOCALSTORAGE
// ==========================================
let appData = {
    tipificacoes: [],
    lancamentos: [],
    eventos: [],
    historico: []
};

// Função para salvar no navegador
function salvarDados() {
    localStorage.setItem('erp_financeiro_data', JSON.stringify(appData));
}

// Função para carregar dados do localStorage
function carregarDados() {
    const dadosSalvos = localStorage.getItem('erp_financeiro_data');

    if (dadosSalvos) {
        appData = JSON.parse(dadosSalvos);
    }

    // Garante que todas as listas existem mesmo em dados antigos
    if (!appData.tipificacoes) appData.tipificacoes = [];
    if (!appData.lancamentos)  appData.lancamentos  = [];
    if (!appData.eventos)      appData.eventos      = [];
    if (!appData.historico)    appData.historico     = [];
    if (!appData.irmaos)       appData.irmaos       = [];
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Navegação sempre disponível — independente do estado de auth
    configurarNavegacao();

    // Logout sempre disponível
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

    // Aguarda Supabase resolver a sessão
    if (typeof aguardarInicializacao === 'function') {
        await aguardarInicializacao();
    }

    const perfil = typeof obterPerfilAtual === 'function' ? obterPerfilAtual() : null;

    if (!perfil) {
        console.error('[APP] Perfil não encontrado após inicialização. Redirecionando...');
        window.location.href = 'login.html';
        return;
    }

    if (perfil.role !== 'admin') {
        console.warn('[APP] Usuário não é admin. Redirecionando...');
        window.location.href = 'transparencia.html';
        return;
    }

    // Exibe nome do admin
    const nomeEl = document.getElementById('user-name');
    if (nomeEl) nomeEl.textContent = `Olá, ${perfil.nome}`;

    // Carrega dados e configura formulários
    carregarDados();
    configurarFormularios();

    renderizarTipificacoes();
    renderizarIrmaos();
    atualizarSelectTipificacoes();
    renderizarLancamentos();
    renderizarHistorico();
    atualizarDashboardPremium();
    renderizarEventos();
    inicializarControle();
    await carregarPlanoContasSupabase();
    await carregarOrcamento();
    carregarControleAcessos();
});

// ==========================================
// NAVEGAÇÃO DA SIDEBAR
// ==========================================
function configurarNavegacao() {
    const links = document.querySelectorAll('.nav-link');
    const title = document.getElementById('page-title');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
            
            title.textContent = link.textContent.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}/gu, '').trim();
        });
    });
}

function configurarFormularios() {
    document.getElementById('form-tipificacao').addEventListener('submit', salvarTipificacao);
    document.getElementById('form-lancamento').addEventListener('submit', salvarLancamento);
    document.getElementById('form-evento').addEventListener('submit', salvarEvento);
}

// ==========================================
// MÓDULO: CONFIGURAÇÕES (Categorias)
// ==========================================
function renderizarTipificacoes() {
    const tbody = document.getElementById('tipificacoes-body');
    tbody.innerHTML = appData.tipificacoes.map(t => `
        <tr>
            <td>${t.nome}</td>
            <td>
                <button class="btn-icon" onclick="excluirTipificacao(${t.id})" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
    atualizarSelectTipificacoes();
    atualizarSelectTipificacoesFiltro();
}

function salvarTipificacao(e) {
    e.preventDefault();
    const nomeInput = document.getElementById('nova-tipificacao').value.trim();
    const novoId = appData.tipificacoes.length > 0 ? Math.max(...appData.tipificacoes.map(t => t.id)) + 1 : 1;
    
    appData.tipificacoes.push({ id: novoId, nome: nomeInput });
    document.getElementById('form-tipificacao').reset();
    renderizarTipificacoes();
    salvarDados();
}

function excluirTipificacao(id) {
    if (confirm('Tem certeza que deseja excluir esta Categoria?')) {
        appData.tipificacoes = appData.tipificacoes.filter(t => t.id !== id);
        renderizarTipificacoes();
        salvarDados();
    }
}

function atualizarSelectTipificacoes() {
    // Evento usa tipificações antigas
    const options = '<option value="">Selecione...</option>' + appData.tipificacoes.map(t => `<option value="${t.nome}">${t.nome}</option>`).join('');
    document.getElementById('evento-tipificacao').innerHTML = options;
    // Lançamento: contas do plano (filtradas pelo tipo selecionado)
    filtrarContasPorTipo();
}

function filtrarContasPorTipo() {
    const tipo = document.getElementById('lancamento-tipo')?.value;
    const select = document.getElementById('lancamento-tipificacao');
    if (!select) return;

    if (!tipo) {
        select.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
        return;
    }

    const contas = [];
    (appData.planoContas || []).forEach(grupo => {
        if (grupo.nome === tipo) {
            (grupo.contas || grupo.categorias || []).forEach(c => {
                contas.push(c.nome);
            });
        }
    });

    if (contas.length === 0) {
        select.innerHTML = '<option value="">Nenhuma conta cadastrada para este tipo</option>';
    } else {
        select.innerHTML = '<option value="">Selecione...</option>' + contas.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

// ==========================================
// MÓDULO: LANÇAMENTOS
// ==========================================
function abrirModalLancamento(id = null) {
    document.getElementById('form-lancamento').reset();
    document.getElementById('lancamento-id').value = '';
    document.getElementById('modal-lancamento-title').textContent = 'Novo Lançamento';

    if (id) {
        const lanc = appData.lancamentos.find(l => l.id === id);
        document.getElementById('lancamento-id').value = lanc.id;
        document.getElementById('lancamento-tipo').value = lanc.tipo;
        filtrarContasPorTipo();
        document.getElementById('lancamento-tipificacao').value = lanc.tipificacao;
        document.getElementById('lancamento-data').value = lanc.data;
        document.getElementById('lancamento-historico').value = lanc.historico;
        document.getElementById('lancamento-descricao').value = lanc.descricao || '';
        document.getElementById('lancamento-valor').value = lanc.valor;
        document.getElementById('modal-lancamento-title').textContent = 'Editar Lançamento';
    } else {
        document.getElementById('lancamento-data').valueAsDate = new Date();
    }
    document.getElementById('modal-lancamento').classList.add('show');
}

function fecharModalLancamento() { 
    document.getElementById('modal-lancamento').classList.remove('show'); 
}

function salvarLancamento(e) {
    e.preventDefault();
    const id = document.getElementById('lancamento-id').value;
    const dados = {
        tipo: document.getElementById('lancamento-tipo').value,
        tipificacao: document.getElementById('lancamento-tipificacao').value,
        data: document.getElementById('lancamento-data').value,
        historico: document.getElementById('lancamento-historico').value,
        descricao: document.getElementById('lancamento-descricao').value,
        valor: parseFloat(document.getElementById('lancamento-valor').value)
    };

    if (id) {
        const index = appData.lancamentos.findIndex(l => l.id == id);
        appData.lancamentos[index] = { ...dados, id: parseInt(id) };
        registrarHistorico('EDIÇÃO', `${dados.tipo} | R$ ${dados.valor.toFixed(2)} | ${dados.historico}`);
    } else {
        appData.lancamentos.push({ ...dados, id: Date.now() });
        registrarHistorico('INSERÇÃO', `${dados.tipo} | R$ ${dados.valor.toFixed(2)} | ${dados.historico}`);
    }

    fecharModalLancamento();
    renderizarLancamentos();
    atualizarDashboardPremium();
    aplicarFiltrosControle();
    
    if(document.getElementById('modal-evento').classList.contains('show')) {
        carregarLancamentosParaVinculo();
    }
    
    salvarDados();
}

function excluirLancamento(id) {
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
        const lanc = appData.lancamentos.find(l => l.id === id);
        appData.lancamentos = appData.lancamentos.filter(l => l.id !== id);
        
        appData.eventos.forEach(ev => {
            ev.lancamentosVinculados = ev.lancamentosVinculados.filter(vId => vId !== id);
        });

        registrarHistorico('EXCLUSÃO', `${lanc.tipo} | R$ ${lanc.valor.toFixed(2)} | ${lanc.historico}`);
        renderizarLancamentos();
        atualizarDashboardPremium();
        aplicarFiltrosControle();
        renderizarEventos();
        salvarDados();
    }
}

function renderizarLancamentos() {
    const tbody = document.getElementById('lancamentos-body');
    if (appData.lancamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem;">Nenhum lançamento encontrado.</td></tr>';
        return;
    }
    
    const ordenados = [...appData.lancamentos].sort((a, b) => new Date(b.data) - new Date(a.data));
    
    tbody.innerHTML = ordenados.map(l => `
        <tr>
            <td>${formatarData(l.data)}</td>
            <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
            <td>${l.tipificacao}</td>
            <td><strong>${l.historico}</strong></td>
            <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${l.descricao || ''}">${l.descricao || '-'}</td>
            <td><strong>${formatarMoeda(l.valor)}</strong></td>
            <td>
                <button class="btn-icon" onclick="abrirModalLancamento(${l.id})" title="Editar">✏️</button>
                <button class="btn-icon" onclick="excluirLancamento(${l.id})" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// MÓDULO: PRESTAÇÃO DE CONTAS (EVENTOS)
// ==========================================
function abrirModalEvento(id = null) {
    document.getElementById('form-evento').reset();
    document.getElementById('evento-id').value = '';
    document.getElementById('modal-evento-title').textContent = 'Criar Evento para Prestação';
    document.getElementById('evento-lancamentos-body').innerHTML = '<tr><td colspan="5" class="text-center">Selecione uma categoria acima.</td></tr>';
    
    if (id) {
        const ev = appData.eventos.find(e => e.id === id);
        document.getElementById('evento-id').value = ev.id;
        document.getElementById('evento-nome').value = ev.nome;
        document.getElementById('evento-tipificacao').value = ev.tipificacao;
        document.getElementById('evento-informacoes').value = ev.informacoes;
        document.getElementById('modal-evento-title').textContent = 'Editar Evento';
        carregarLancamentosParaVinculo(ev.lancamentosVinculados);
    }
    document.getElementById('modal-evento').classList.add('show');
}

function fecharModalEvento() { 
    document.getElementById('modal-evento').classList.remove('show'); 
}

function carregarLancamentosParaVinculo(vinculadosPreviamente = []) {
    const tipificacao = document.getElementById('evento-tipificacao').value;
    const tbody = document.getElementById('evento-lancamentos-body');
    
    if (!tipificacao) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Selecione uma categoria.</td></tr>';
        return;
    }

    const lancamentosCategoria = appData.lancamentos.filter(l => l.tipificacao === tipificacao);
    
    if (lancamentosCategoria.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum lançamento encontrado nesta categoria.</td></tr>';
        return;
    }

    tbody.innerHTML = lancamentosCategoria.map(l => {
        const isChecked = vinculadosPreviamente.includes(l.id) ? 'checked' : '';
        return `
        <tr>
            <td><input type="checkbox" class="chk-vinculo" value="${l.id}" ${isChecked}></td>
            <td>${formatarData(l.data)}</td>
            <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
            <td>${l.historico}</td>
            <td>${formatarMoeda(l.valor)}</td>
        </tr>
    `}).join('');
}

function salvarEvento(e) {
    e.preventDefault();
    const id = document.getElementById('evento-id').value;
    
    const checkboxes = document.querySelectorAll('.chk-vinculo:checked');
    const lancamentosVinculados = Array.from(checkboxes).map(chk => parseInt(chk.value));

    const dados = {
        nome: document.getElementById('evento-nome').value,
        tipificacao: document.getElementById('evento-tipificacao').value,
        informacoes: document.getElementById('evento-informacoes').value,
        lancamentosVinculados: lancamentosVinculados,
        dataCriacao: new Date().toISOString()
    };

    if (id) {
        const index = appData.eventos.findIndex(ev => ev.id == id);
        appData.eventos[index] = { ...dados, id: parseInt(id) };
        registrarHistorico('EDIÇÃO', `Evento: ${dados.nome}`);
    } else {
        appData.eventos.push({ ...dados, id: Date.now() });
        registrarHistorico('INSERÇÃO', `Evento: ${dados.nome}`);
    }

    fecharModalEvento();
    renderizarEventos();
    salvarDados();
}

function excluirEvento(id) {
    if (confirm('Excluir este evento de prestação de contas? Os lançamentos não serão apagados, apenas desvinculados.')) {
        const ev = appData.eventos.find(e => e.id === id);
        appData.eventos = appData.eventos.filter(e => e.id !== id);
        registrarHistorico('EXCLUSÃO', `Evento: ${ev.nome}`);
        renderizarEventos();
        salvarDados();
    }
}

function renderizarEventos() {
    const grid = document.getElementById('eventos-grid');
    if (appData.eventos.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Nenhum evento criado. Clique em "Criar Novo Evento" para começar.</p>';
        return;
    }

    grid.innerHTML = appData.eventos.map(ev => {
        let rec = 0, desp = 0;
        ev.lancamentosVinculados.forEach(idLanc => {
            const l = appData.lancamentos.find(x => x.id === idLanc);
            if(l) {
                if(l.tipo === 'RECEITA') rec += l.valor;
                if(l.tipo === 'DESPESA') desp += l.valor;
            }
        });
        
        const saldo = rec - desp;
        const corSaldo = saldo >= 0 ? 'text-success' : 'text-danger';
        
        let classBotao = 'btn-detalhes saldo-neutro';
        if (saldo > 0) classBotao = 'btn-detalhes saldo-positivo';
        if (saldo < 0) classBotao = 'btn-detalhes saldo-negativo';
        
        const qtdLancamentos = ev.lancamentosVinculados.length;

        return `
        <div class="evento-card">
            <div class="evento-header">
                <div>
                    <h3 style="margin-bottom: 5px;">${ev.nome}</h3>
                    <span class="badge badge-acao-inserir">${ev.tipificacao}</span>
                </div>
                <div>
                    <button class="btn-icon" onclick="abrirModalEvento(${ev.id})" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="excluirEvento(${ev.id})" title="Excluir">🗑️</button>
                </div>
            </div>
            <div class="evento-body">
                <p class="evento-info">${ev.informacoes}</p>
                <div class="evento-stats">
                    <div class="stat-item">
                        <span class="stat-label">Arrecadado</span>
                        <span class="stat-val text-success">${formatarMoeda(rec)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Gasto</span>
                        <span class="stat-val text-danger">${formatarMoeda(desp)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Balanço</span>
                        <span class="stat-val ${corSaldo}">${formatarMoeda(saldo)}</span>
                    </div>
                </div>
                <small class="text-muted">Lançamentos vinculados: ${qtdLancamentos}</small>
                <button class="${classBotao}" onclick="abrirModalVisualizarEvento(${ev.id})">
                    <span class="btn-detalhes-icon">👁️</span>
                    <span>Visualizar Completo</span>
                    <span class="btn-detalhes-badge">${qtdLancamentos}</span>
                </button>
            </div>
        </div>
    `}).join('');
}

// ==========================================
// VISUALIZAÇÃO COMPLETA DO EVENTO
// ==========================================
function abrirModalVisualizarEvento(eventoId) {
    const evento = appData.eventos.find(e => e.id === eventoId);
    if (!evento) return;

    document.getElementById('modal-vis-titulo').textContent = evento.nome;
    document.getElementById('modal-vis-informacoes').textContent = evento.informacoes;
    document.getElementById('modal-vis-categoria').textContent = evento.tipificacao;
    document.getElementById('modal-vis-data-criacao').textContent = formatarData(evento.dataCriacao.split('T')[0]);

    let receitas = 0, despesas = 0;
    const lancamentosDoEvento = [];

    evento.lancamentosVinculados.forEach(idLanc => {
        const l = appData.lancamentos.find(x => x.id === idLanc);
        if (l) {
            lancamentosDoEvento.push(l);
            if (l.tipo === 'RECEITA') receitas += l.valor;
            if (l.tipo === 'DESPESA') despesas += l.valor;
        }
    });

    const saldo = receitas - despesas;

    document.getElementById('modal-vis-receitas').textContent = formatarMoeda(receitas);
    document.getElementById('modal-vis-despesas').textContent = formatarMoeda(despesas);
    
    const elSaldo = document.getElementById('modal-vis-saldo');
    elSaldo.textContent = formatarMoeda(saldo);
    elSaldo.className = saldo >= 0 ? 'resumo-valor text-success' : 'resumo-valor text-danger';

    const statusDiv = document.getElementById('modal-vis-status');
    const statusTexto = document.getElementById('modal-vis-status-texto');
    
    if (saldo > 0) {
        statusDiv.style.background = '#f0fdf4';
        statusDiv.style.borderLeftColor = '#10b981';
        statusTexto.textContent = '✅ Evento com saldo positivo - Arrecadação maior que despesas';
    } else if (saldo < 0) {
        statusDiv.style.background = '#fef2f2';
        statusDiv.style.borderLeftColor = '#ef4444';
        statusTexto.textContent = '⚠️ Evento com saldo negativo - Despesas maiores que arrecadação';
    } else {
        statusDiv.style.background = '#f0f9ff';
        statusDiv.style.borderLeftColor = '#3b82f6';
        statusTexto.textContent = '➖ Evento equilibrado - Arrecadação igual às despesas';
    }
    statusDiv.style.display = 'block';

    const tbody = document.getElementById('modal-vis-lancamentos-body');
    document.getElementById('modal-vis-qtd-lancamentos').textContent = lancamentosDoEvento.length;
    
    if (lancamentosDoEvento.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum lançamento vinculado a este evento.</td></tr>';
    } else {
        lancamentosDoEvento.sort((a, b) => new Date(a.data) - new Date(b.data));
        
        tbody.innerHTML = lancamentosDoEvento.map(l => `
            <tr>
                <td>${formatarData(l.data)}</td>
                <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
                <td>${l.tipificacao}</td>
                <td><strong>${l.historico}</strong></td>
                <td>${l.descricao || '-'}</td>
                <td><strong>${formatarMoeda(l.valor)}</strong></td>
            </tr>
        `).join('');
    }

    document.getElementById('modal-visualizar-evento').classList.add('show');
}

function fecharModalVisualizarEvento() {
    document.getElementById('modal-visualizar-evento').classList.remove('show');
}

function imprimirEventoDetalhes() {
    window.print();
}

function exportarEventoCSV() {
    const tbody = document.getElementById('modal-vis-lancamentos-body');
    const linhas = tbody.querySelectorAll('tr');
    
    if (linhas.length === 0 || linhas[0].cells.length === 1) {
        alert('Não há lançamentos para exportar.');
        return;
    }

    const titulo = document.getElementById('modal-vis-titulo').textContent;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Evento: ${titulo}\n`;
    csvContent += `Data de Exportação: ${new Date().toLocaleString('pt-BR')}\n\n`;
    csvContent += "Data;Tipo;Tipificacao;Historico;Descricao;Valor\n";

    linhas.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length > 1) {
            const data = cols[0].innerText;
            const tipo = cols[1].innerText;
            const tipificacao = cols[2].innerText;
            const historico = cols[3].innerText.replace(/;/g, "");
            const descricao = cols[4].innerText.replace(/;/g, "");
            const valor = cols[5].innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            
            csvContent += `${data};${tipo};${tipificacao};${historico};${descricao};${valor}\n`;
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `evento_${titulo.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// MÓDULO: DASHBOARD PREMIUM
// ==========================================
let graficoDashboard = null;

function atualizarDashboardPremium() {
    let receitas = 0, despesas = 0, maiorDespesa = 0;
    
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();

    appData.lancamentos.forEach(l => {
        const dataLanc = new Date(l.data);
        dataLanc.setMinutes(dataLanc.getMinutes() + dataLanc.getTimezoneOffset());
        
        if (dataLanc.getMonth() === mesAtual && dataLanc.getFullYear() === anoAtual) {
            if (l.tipo === 'RECEITA') receitas += l.valor;
            if (l.tipo === 'DESPESA') {
                despesas += l.valor;
                if (l.valor > maiorDespesa) maiorDespesa = l.valor;
            }
        }
    });

    const saldo = receitas - despesas;
    const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const mediaDiaria = despesas / diasNoMes;

    document.getElementById('dash-saldo-geral').textContent = formatarMoeda(saldo);
    document.getElementById('dash-total-receitas').textContent = formatarMoeda(receitas);
    document.getElementById('dash-total-despesas').textContent = formatarMoeda(despesas);
    document.getElementById('dash-maior-despesa').textContent = formatarMoeda(maiorDespesa);
    document.getElementById('dash-media-diaria').textContent = formatarMoeda(mediaDiaria);
    document.getElementById('dash-qtd-lancamentos').textContent = appData.lancamentos.length;

    renderizarGraficoDashboard(receitas, despesas);
    renderizarGraficosAdicionaisDashboard();
    renderizarOrcadoRealizado();

}

function renderizarGraficoDashboard(receitas, despesas) {
    const ctx = document.getElementById('chart-receita-despesa');
    if (graficoDashboard) graficoDashboard.destroy();
    
    graficoDashboard = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Receitas do Mês', 'Despesas do Mês'],
            datasets: [{ 
                data: [receitas, despesas], 
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// ==========================================
// MÓDULO: RELATÓRIOS E CONTROLE (ENTERPRISE)
// ==========================================
let chartEvolucao = null;
let chartComposicao = null;

function inicializarControle() {
    atualizarSelectTipificacoesFiltro();
    aplicarFiltrosControle();
}

function atualizarSelectTipificacoesFiltro() {
    const select = document.getElementById('filtro-tipificacao');
    if(select) {
        select.innerHTML = '<option value="">Todas</option>' + 
            appData.tipificacoes.map(t => `<option value="${t.nome}">${t.nome}</option>`).join('');
    }
}

function aplicarFiltrosControle() {
    const dataInicio = document.getElementById('filtro-data-inicio')?.value;
    const dataFim = document.getElementById('filtro-data-fim')?.value;
    const tipo = document.getElementById('filtro-tipo')?.value;
    const tipificacao = document.getElementById('filtro-tipificacao')?.value;

    let dadosFiltrados = [...appData.lancamentos];

    if (dataInicio) dadosFiltrados = dadosFiltrados.filter(l => l.data >= dataInicio);
    if (dataFim) dadosFiltrados = dadosFiltrados.filter(l => l.data <= dataFim);
    if (tipo) dadosFiltrados = dadosFiltrados.filter(l => l.tipo === tipo);
    if (tipificacao) dadosFiltrados = dadosFiltrados.filter(l => l.tipificacao === tipificacao);

    dadosFiltrados.sort((a, b) => new Date(a.data) - new Date(b.data));

    renderizarTabelaControle(dadosFiltrados);
    atualizarResumoControle(dadosFiltrados);
    renderizarGraficosControle(dadosFiltrados);
}

function limparFiltrosControle() {
    document.getElementById('filtro-data-inicio').value = '';
    document.getElementById('filtro-data-fim').value = '';
    document.getElementById('filtro-tipo').value = '';
    document.getElementById('filtro-tipificacao').value = '';
    aplicarFiltrosControle();
}

function renderizarTabelaControle(dados) {
    const tbody = document.getElementById('controle-tabela-body');
    if(!tbody) return;

    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhum dado encontrado para os filtros aplicados.</td></tr>';
        return;
    }

    tbody.innerHTML = dados.map(l => `
        <tr>
            <td>${formatarData(l.data)}</td>
            <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
            <td>${l.tipificacao}</td>
            <td>${l.historico}</td>
            <td><strong>${formatarMoeda(l.valor)}</strong></td>
        </tr>
    `).join('');
}

function atualizarResumoControle(dados) {
    let receitas = 0, despesas = 0;

    dados.forEach(l => {
        if (l.tipo === 'RECEITA') receitas += l.valor;
        if (l.tipo === 'DESPESA') despesas += l.valor;
    });

    const resultado = receitas - despesas;

    const elRec = document.getElementById('relatorio-receitas');
    const elDesp = document.getElementById('relatorio-despesas');
    const elRes = document.getElementById('relatorio-resultado');

    if(elRec) elRec.textContent = formatarMoeda(receitas);
    if(elDesp) elDesp.textContent = formatarMoeda(despesas);
    if(elRes) {
        elRes.textContent = formatarMoeda(resultado);
        elRes.className = resultado >= 0 ? 'text-success card-value' : 'text-danger card-value';
    }
}

function renderizarGraficosControle(dados) {
    const ctxEvolucao = document.getElementById('chart-evolucao');
    const ctxComposicao = document.getElementById('chart-composicao');
    if(!ctxEvolucao || !ctxComposicao) return;

    // Gráfico de Evolução Diária
    const dadosPorData = {};
    dados.forEach(l => {
        if (!dadosPorData[l.data]) dadosPorData[l.data] = { r: 0, d: 0 };
        if (l.tipo === 'RECEITA') dadosPorData[l.data].r += l.valor;
        if (l.tipo === 'DESPESA') dadosPorData[l.data].d += l.valor;
    });

    const datas = Object.keys(dadosPorData).sort();
    const receitasEvolucao = datas.map(d => dadosPorData[d].r);
    const despesasEvolucao = datas.map(d => dadosPorData[d].d);
    const labelsDatas = datas.map(d => formatarData(d));

    if (chartEvolucao) chartEvolucao.destroy();
    chartEvolucao = new Chart(ctxEvolucao, {
        type: 'line',
        data: {
            labels: labelsDatas,
            datasets: [
                { label: 'Receitas', data: receitasEvolucao, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                { label: 'Despesas', data: despesasEvolucao, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Gráfico de Composição por Categoria
    const tipificacoesLabels = [...new Set(dados.map(l => l.tipificacao))];
    const receitasPorTip = tipificacoesLabels.map(t => dados.filter(l => l.tipificacao === t && l.tipo === 'RECEITA').reduce((acc, curr) => acc + curr.valor, 0));
    const despesasPorTip = tipificacoesLabels.map(t => dados.filter(l => l.tipificacao === t && l.tipo === 'DESPESA').reduce((acc, curr) => acc + curr.valor, 0));

    if (chartComposicao) chartComposicao.destroy();
    chartComposicao = new Chart(ctxComposicao, {
        type: 'bar',
        data: {
            labels: tipificacoesLabels,
            datasets: [
                { label: 'Receitas', data: receitasPorTip, backgroundColor: '#10b981' },
                { label: 'Despesas', data: despesasPorTip, backgroundColor: '#ef4444' }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });
}

function exportarRelatorioCSV() {
    const tbody = document.getElementById('controle-tabela-body');
    const linhas = tbody.querySelectorAll('tr');
    
    if (linhas.length === 0 || linhas[0].cells.length === 1) {
        alert('Não há dados para exportar.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data;Tipo;Tipificacao;Historico;Valor\n";

    linhas.forEach(row => {
        const cols = row.querySelectorAll('td');
        const data = cols[0].innerText;
        const tipo = cols[1].innerText;
        const tipificacao = cols[2].innerText;
        const historico = cols[3].innerText.replace(/;/g, ""); 
        const valor = cols[4].innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        
        csvContent += `${data};${tipo};${tipificacao};${historico};${valor}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_financeiro.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function imprimirRelatorio() {
    window.print();
}

// ==========================================
// MÓDULO: HISTÓRICO DE AUDITORIA
// ==========================================
function registrarHistorico(acao, detalhes) {
    const usuario = typeof obterUsuarioAtual === 'function' ? (obterUsuarioAtual()?.nome || 'Administrador') : 'Administrador';
    const dataHora = new Date().toLocaleString('pt-BR');
    
    appData.historico.unshift({ dataHora, acao, detalhes, usuario });
    renderizarHistorico();
}

function renderizarHistorico() {
    const tbody = document.getElementById('historico-body');
    if (!tbody) return;

    if (appData.historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem;">Nenhum registro no histórico.</td></tr>';
        return;
    }

    tbody.innerHTML = appData.historico.map(h => {
        let badgeClass = 'badge-acao-inserir';
        if (h.acao === 'EDIÇÃO') badgeClass = 'badge-acao-editar';
        if (h.acao === 'EXCLUSÃO') badgeClass = 'badge-acao-excluir';

        return `
        <tr>
            <td>${h.dataHora}</td>
            <td><span class="badge ${badgeClass}">${h.acao}</span></td>
            <td>${h.detalhes}</td>
            <td>👤 ${h.usuario}</td>
        </tr>
    `}).join('');
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarData(dataString) {
    const data = new Date(dataString);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return data.toLocaleDateString('pt-BR');
}

// ==========================================
// ORÇADO X REALIZADO — DASHBOARD
// ==========================================
let chartOrcRealizado = null;

function renderizarOrcadoRealizado() {
    if (!appData.planoContas || appData.planoContas.length === 0) return;

    const M = [1,2,3,4,5,6,7,8,9,10,11,12];
    const receitas = appData.planoContas.filter(g => g.nome === 'RECEITA');
    const despesas = appData.planoContas.filter(g => g.nome === 'DESPESA');

    // Orçado por mês (usa funções do módulo de orçamento)
    const orcRecMes  = m => receitas.reduce((a,g) => a + calcMesGrupo(g, m), 0);
    const orcDesMes  = m => despesas.reduce((a,g) => a + calcMesGrupo(g, m), 0);
    const orcRecAnual = M.reduce((a,m) => a + orcRecMes(m), 0);
    const orcDesAnual = M.reduce((a,m) => a + orcDesMes(m), 0);

    // Realizado por mês (lançamentos 2026)
    const realRecMes = Array(13).fill(0);
    const realDesMes = Array(13).fill(0);
    (appData.lancamentos || []).forEach(l => {
        const d = new Date(l.data);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        if (d.getFullYear() !== ORC_EXERCICIO) return;
        const m = d.getMonth() + 1;
        if (l.tipo === 'RECEITA') realRecMes[m] += l.valor;
        if (l.tipo === 'DESPESA') realDesMes[m] += l.valor;
    });
    const realRecAnual = realRecMes.reduce((a,v) => a+v, 0);
    const realDesAnual = realDesMes.reduce((a,v) => a+v, 0);

    // Atualizar cards
    const el = id => document.getElementById(id);
    if (el('dash-orc-receitas'))  el('dash-orc-receitas').textContent  = formatarMoeda(orcRecAnual);
    if (el('dash-orc-despesas'))  el('dash-orc-despesas').textContent  = formatarMoeda(orcDesAnual);
    if (el('dash-real-receitas')) el('dash-real-receitas').textContent = formatarMoeda(realRecAnual);
    if (el('dash-real-despesas')) el('dash-real-despesas').textContent = formatarMoeda(realDesAnual);
    if (el('dash-pct-receita'))   el('dash-pct-receita').textContent   = orcRecAnual > 0 ? ((realRecAnual/orcRecAnual)*100).toFixed(1)+'%' : '—';
    if (el('dash-pct-despesa'))   el('dash-pct-despesa').textContent   = orcDesAnual > 0 ? ((realDesAnual/orcDesAnual)*100).toFixed(1)+'%' : '—';

    // Gráfico
    const ctx = document.getElementById('chart-orc-realizado');
    if (!ctx) return;
    if (chartOrcRealizado) chartOrcRealizado.destroy();
    chartOrcRealizado = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ORC_MESES_LABELS,
            datasets: [
                {
                    label: 'Receita Orçada',
                    data: M.map(m => orcRecMes(m)),
                    backgroundColor: 'rgba(34,197,94,0.3)',
                    borderColor: 'rgba(34,197,94,1)',
                    borderWidth: 1
                },
                {
                    label: 'Receita Realizada',
                    data: M.map(m => realRecMes[m]),
                    backgroundColor: 'rgba(34,197,94,0.8)',
                    borderColor: 'rgba(34,197,94,1)',
                    borderWidth: 1
                },
                {
                    label: 'Despesa Orçada',
                    data: M.map(m => orcDesMes(m)),
                    backgroundColor: 'rgba(239,68,68,0.3)',
                    borderColor: 'rgba(239,68,68,1)',
                    borderWidth: 1
                },
                {
                    label: 'Despesa Realizada',
                    data: M.map(m => realDesMes[m]),
                    backgroundColor: 'rgba(239,68,68,0.8)',
                    borderColor: 'rgba(239,68,68,1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { ticks: { callback: v => 'R$ '+v.toLocaleString('pt-BR') } }
            }
        }
    });
}

// ==========================================
// GRÁFICOS ADICIONAIS DO DASHBOARD
// ==========================================
let chartEvolucaoDashboard = null;
let chartComposicaoDashboard = null;
let chartTipificacaoDashboard = null;

function renderizarGraficosAdicionaisDashboard() {
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();

    // Filtrar lançamentos do mês atual
    const lancamentosMes = appData.lancamentos.filter(l => {
        const dataLanc = new Date(l.data);
        dataLanc.setMinutes(dataLanc.getMinutes() + dataLanc.getTimezoneOffset());
        return dataLanc.getMonth() === mesAtual && dataLanc.getFullYear() === anoAtual;
    });

    // 1. GRÁFICO DE EVOLUÇÃO MENSAL (Linha)
    const dadosPorData = {};
    lancamentosMes.forEach(l => {
        if (!dadosPorData[l.data]) dadosPorData[l.data] = { r: 0, d: 0 };
        if (l.tipo === 'RECEITA') dadosPorData[l.data].r += l.valor;
        if (l.tipo === 'DESPESA') dadosPorData[l.data].d += l.valor;
    });

    const datas = Object.keys(dadosPorData).sort();
    const receitasEvolucao = datas.map(d => dadosPorData[d].r);
    const despesasEvolucao = datas.map(d => dadosPorData[d].d);
    const labelsDatas = datas.map(d => formatarData(d));

    const ctxEvolucao = document.getElementById('chart-evolucao-dashboard');
    if (ctxEvolucao) {
        if (chartEvolucaoDashboard) chartEvolucaoDashboard.destroy();
        chartEvolucaoDashboard = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: labelsDatas,
                datasets: [
                    { label: 'Receitas', data: receitasEvolucao, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                    { label: 'Despesas', data: despesasEvolucao, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 2. GRÁFICO DE COMPOSIÇÃO POR Categoria (Pizza)
    const tipificacoesLabels = [...new Set(lancamentosMes.map(l => l.tipificacao))];
    const valoresPorTip = tipificacoesLabels.map(t => 
        lancamentosMes.filter(l => l.tipificacao === t).reduce((acc, curr) => acc + curr.valor, 0)
    );

    const ctxComposicao = document.getElementById('chart-composicao-dashboard');
    if (ctxComposicao) {
        if (chartComposicaoDashboard) chartComposicaoDashboard.destroy();
        chartComposicaoDashboard = new Chart(ctxComposicao, {
            type: 'doughnut',
            data: {
                labels: tipificacoesLabels,
                datasets: [{
                    data: valoresPorTip,
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3. GRÁFICO DE RECEITAS VS DESPESAS POR Categoria (Barras Horizontais)
    const receitasPorTip = tipificacoesLabels.map(t => 
        lancamentosMes.filter(l => l.tipificacao === t && l.tipo === 'RECEITA').reduce((acc, curr) => acc + curr.valor, 0)
    );
    const despesasPorTip = tipificacoesLabels.map(t => 
        lancamentosMes.filter(l => l.tipificacao === t && l.tipo === 'DESPESA').reduce((acc, curr) => acc + curr.valor, 0)
    );

    const ctxTipificacao = document.getElementById('chart-tipificacao-dashboard');
    if (ctxTipificacao) {
        if (chartTipificacaoDashboard) chartTipificacaoDashboard.destroy();
        chartTipificacaoDashboard = new Chart(ctxTipificacao, {
            type: 'bar',
            data: {
                labels: tipificacoesLabels,
                datasets: [
                    { label: 'Receitas', data: receitasPorTip, backgroundColor: '#10b981' },
                    { label: 'Despesas', data: despesasPorTip, backgroundColor: '#ef4444' }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    }

    // Atualizar Resumo Executivo
    atualizarResumoExecutivo(lancamentosMes);
}

function atualizarResumoExecutivo(lancamentos) {
    const mesAtual = new Date().getMonth();
    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    document.getElementById('dash-periodo').textContent = nomesMeses[mesAtual];

    let receitas = 0, despesas = 0;
    lancamentos.forEach(l => {
        if (l.tipo === 'RECEITA') receitas += l.valor;
        if (l.tipo === 'DESPESA') despesas += l.valor;
    });

    const taxaCobertura = receitas > 0 ? ((receitas / (receitas + despesas)) * 100).toFixed(1) : 0;
    document.getElementById('dash-taxa-cobertura').textContent = `${taxaCobertura}%`;

    // Categoria com maior receita
    const tipificacoes = [...new Set(lancamentos.map(l => l.tipificacao))];
    let maiorReceitaCat = '-';
    let maiorReceitaVal = 0;
    tipificacoes.forEach(t => {
        const val = lancamentos.filter(l => l.tipificacao === t && l.tipo === 'RECEITA').reduce((acc, curr) => acc + curr.valor, 0);
        if (val > maiorReceitaVal) {
            maiorReceitaVal = val;
            maiorReceitaCat = t;
        }
    });
    document.getElementById('dash-maior-receita-cat').textContent = maiorReceitaCat;

    // Categoria com maior despesa
    let maiorDespesaCat = '-';
    let maiorDespesaVal = 0;
    tipificacoes.forEach(t => {
        const val = lancamentos.filter(l => l.tipificacao === t && l.tipo === 'DESPESA').reduce((acc, curr) => acc + curr.valor, 0);
        if (val > maiorDespesaVal) {
            maiorDespesaVal = val;
            maiorDespesaCat = t;
        }
    });
    document.getElementById('dash-maior-despesa-cat').textContent = maiorDespesaCat;
}

// 
// FILTROS DO DASHBOARD
// 
function aplicarFiltrosDashboard() {
    const dataInicio = document.getElementById('dash-filtro-data-inicio').value;
    const dataFim = document.getElementById('dash-filtro-data-fim').value;

    let lancamentosFiltrados = [...appData.lancamentos];

    if (dataInicio) lancamentosFiltrados = lancamentosFiltrados.filter(l => l.data >= dataInicio);
    if (dataFim) lancamentosFiltrados = lancamentosFiltrados.filter(l => l.data <= dataFim);

    atualizarDashboardComFiltro(lancamentosFiltrados);
}

function limparFiltrosDashboard() {
    document.getElementById('dash-filtro-data-inicio').value = '';
    document.getElementById('dash-filtro-data-fim').value = '';
    atualizarDashboardPremium();
}

function atualizarDashboardComFiltro(lancamentos) {
    let receitas = 0, despesas = 0, maiorDespesa = 0;

    lancamentos.forEach(l => {
        if (l.tipo === 'RECEITA') receitas += l.valor;
        if (l.tipo === 'DESPESA') {
            despesas += l.valor;
            if (l.valor > maiorDespesa) maiorDespesa = l.valor;
        }
    });

    const saldo = receitas - despesas;
    const diasNoMes = lancamentos.length > 0 ? 
        (new Date(Math.max(...lancamentos.map(l => new Date(l.data)))) - 
         new Date(Math.min(...lancamentos.map(l => new Date(l.data))))) / (1000 * 60 * 60 * 24) + 1 : 1;
    const mediaDiaria = despesas / diasNoMes;

    document.getElementById('dash-saldo-geral').textContent = formatarMoeda(saldo);
    document.getElementById('dash-total-receitas').textContent = formatarMoeda(receitas);
    document.getElementById('dash-total-despesas').textContent = formatarMoeda(despesas);
    document.getElementById('dash-maior-despesa').textContent = formatarMoeda(maiorDespesa);
    document.getElementById('dash-media-diaria').textContent = formatarMoeda(mediaDiaria);
    document.getElementById('dash-qtd-lancamentos').textContent = lancamentos.length;

    renderizarGraficoDashboard(receitas, despesas);
    renderizarGraficosAdicionaisDashboardComFiltro(lancamentos);
}

function renderizarGraficosAdicionaisDashboardComFiltro(lancamentos) {
    // 1. GRÁFICO DE EVOLUÇÃO
    const dadosPorData = {};
    lancamentos.forEach(l => {
        if (!dadosPorData[l.data]) dadosPorData[l.data] = { r: 0, d: 0 };
        if (l.tipo === 'RECEITA') dadosPorData[l.data].r += l.valor;
        if (l.tipo === 'DESPESA') dadosPorData[l.data].d += l.valor;
    });

    const datas = Object.keys(dadosPorData).sort();
    const receitasEvolucao = datas.map(d => dadosPorData[d].r);
    const despesasEvolucao = datas.map(d => dadosPorData[d].d);
    const labelsDatas = datas.map(d => formatarData(d));

    const ctxEvolucao = document.getElementById('chart-evolucao-dashboard');
    if (ctxEvolucao) {
        if (chartEvolucaoDashboard) chartEvolucaoDashboard.destroy();
        chartEvolucaoDashboard = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: labelsDatas,
                datasets: [
                    { label: 'Receitas', data: receitasEvolucao, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                    { label: 'Despesas', data: despesasEvolucao, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 2. GRÁFICO DE COMPOSIÇÃO
    const tipificacoesLabels = [...new Set(lancamentos.map(l => l.tipificacao))];
    const valoresPorTip = tipificacoesLabels.map(t => 
        lancamentos.filter(l => l.tipificacao === t).reduce((acc, curr) => acc + curr.valor, 0)
    );

    const ctxComposicao = document.getElementById('chart-composicao-dashboard');
    if (ctxComposicao) {
        if (chartComposicaoDashboard) chartComposicaoDashboard.destroy();
        chartComposicaoDashboard = new Chart(ctxComposicao, {
            type: 'doughnut',
            data: {
                labels: tipificacoesLabels,
                datasets: [{
                    data: valoresPorTip,
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3. GRÁFICO DE RECEITAS VS DESPESAS
    const receitasPorTip = tipificacoesLabels.map(t => 
        lancamentos.filter(l => l.tipificacao === t && l.tipo === 'RECEITA').reduce((acc, curr) => acc + curr.valor, 0)
    );
    const despesasPorTip = tipificacoesLabels.map(t => 
        lancamentos.filter(l => l.tipificacao === t && l.tipo === 'DESPESA').reduce((acc, curr) => acc + curr.valor, 0)
    );

    const ctxTipificacao = document.getElementById('chart-tipificacao-dashboard');
    if (ctxTipificacao) {
        if (chartTipificacaoDashboard) chartTipificacaoDashboard.destroy();
        chartTipificacaoDashboard = new Chart(ctxTipificacao, {
            type: 'bar',
            data: {
                labels: tipificacoesLabels,
                datasets: [
                    { label: 'Receitas', data: receitasPorTip, backgroundColor: '#10b981' },
                    { label: 'Despesas', data: despesasPorTip, backgroundColor: '#ef4444' }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    }

    atualizarResumoExecutivoComFiltro(lancamentos);
}

function atualizarResumoExecutivoComFiltro(lancamentos) {
    const dataInicio = document.getElementById('dash-filtro-data-inicio').value;
    const dataFim = document.getElementById('dash-filtro-data-fim').value;
    
    let periodo = 'Período Customizado';
    if (dataInicio && dataFim) {
        periodo = `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
    } else if (dataInicio) {
        periodo = `A partir de ${formatarData(dataInicio)}`;
    } else if (dataFim) {
        periodo = `Até ${formatarData(dataFim)}`;
    }
    
    document.getElementById('dash-periodo').textContent = periodo;

    let receitas = 0, despesas = 0;
    lancamentos.forEach(l => {
        if (l.tipo === 'RECEITA') receitas += l.valor;
        if (l.tipo === 'DESPESA') despesas += l.valor;
    });

    const taxaCobertura = receitas > 0 ? ((receitas / (receitas + despesas)) * 100).toFixed(1) : 0;
    document.getElementById('dash-taxa-cobertura').textContent = `${taxaCobertura}%`;

    const tipificacoes = [...new Set(lancamentos.map(l => l.tipificacao))];
    let maiorReceitaCat = '-';
    let maiorReceitaVal = 0;
    tipificacoes.forEach(t => {
        const val = lancamentos.filter(l => l.tipificacao === t && l.tipo === 'RECEITA').reduce((acc, curr) => acc + curr.valor, 0);
        if (val > maiorReceitaVal) {
            maiorReceitaVal = val;
            maiorReceitaCat = t;
        }
    });
    document.getElementById('dash-maior-receita-cat').textContent = maiorReceitaCat;

    let maiorDespesaCat = '-';
    let maiorDespesaVal = 0;
    tipificacoes.forEach(t => {
        const val = lancamentos.filter(l => l.tipificacao === t && l.tipo === 'DESPESA').reduce((acc, curr) => acc + curr.valor, 0);
        if (val > maiorDespesaVal) {
            maiorDespesaVal = val;
            maiorDespesaCat = t;
        }
    });
    document.getElementById('dash-maior-despesa-cat').textContent = maiorDespesaCat;
}

// 
// VALIDAÇÃO: EVITAR DUPLICAÇÃO DE LANÇAMENTOS EM EVENTOS
// 
function validarVinculoLancamento(lancamentoId, eventoIdAtual = null) {
    for (let evento of appData.eventos) {
        // Se for edição, ignora o evento atual
        if (eventoIdAtual && evento.id === eventoIdAtual) continue;
        
        if (evento.lancamentosVinculados.includes(lancamentoId)) {
            return false; // Lançamento já está vinculado a outro evento
        }
    }
    return true; // Lançamento pode ser vinculado
}

// Atualizar carregarLancamentosParaVinculo para validar
function carregarLancamentosParaVincuLoComValidacao(vinculadosPreviamente = [], eventoIdAtual = null) {
    const tipificacao = document.getElementById('evento-tipificacao').value;
    const tbody = document.getElementById('evento-lancamentos-body');
    
    if (!tipificacao) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Selecione uma categoria.</td></tr>';
        return;
    }

    const lancamentosCategoria = appData.lancamentos.filter(l => l.tipificacao === tipificacao);
    
    if (lancamentosCategoria.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum lançamento encontrado nesta categoria.</td></tr>';
        return;
    }

    tbody.innerHTML = lancamentosCategoria.map(l => {
        const isChecked = vinculadosPreviamente.includes(l.id) ? 'checked' : '';
        const jaVinculado = !validarVinculoLancamento(l.id, eventoIdAtual) && !vinculadosPreviamente.includes(l.id);
        const disabled = jaVinculado ? 'disabled' : '';
        const title = jaVinculado ? 'Este lançamento já está vinculado a outro evento' : '';

        return `
        <tr ${jaVinculado ? 'style="opacity: 0.5;"' : ''}>
            <td><input type="checkbox" class="chk-vinculo" value="${l.id}" ${isChecked} ${disabled} title="${title}"></td>
            <td>${formatarData(l.data)}</td>
            <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
            <td>${l.historico}</td>
            <td>${formatarMoeda(l.valor)}</td>
        </tr>
    `}).join('');
}

// Atualizar a função carregarLancamentosParaVinculo original
function carregarLancamentosParaVinculo(vinculadosPreviamente = [], eventoIdAtual = null) {
    carregarLancamentosParaVincuLoComValidacao(vinculadosPreviamente, eventoIdAtual);
}

// Atualizar abrirModalEvento para passar o ID do evento
function abrirModalEvento(id = null) {
    document.getElementById('form-evento').reset();
    document.getElementById('evento-id').value = '';
    document.getElementById('modal-evento-title').textContent = 'Criar Evento para Prestação';
    document.getElementById('evento-lancamentos-body').innerHTML = '<tr><td colspan="5" class="text-center">Selecione uma categoria acima.</td></tr>';
    
    if (id) {
        const ev = appData.eventos.find(e => e.id === id);
        document.getElementById('evento-id').value = ev.id;
        document.getElementById('evento-nome').value = ev.nome;
        document.getElementById('evento-tipificacao').value = ev.tipificacao;
        document.getElementById('evento-informacoes').value = ev.informacoes;
        document.getElementById('modal-evento-title').textContent = 'Editar Evento';
        carregarLancamentosParaVinculo(ev.lancamentosVinculados, ev.id);
    }
    document.getElementById('modal-evento').classList.add('show');
}

// 
// GERAÇÃO DE PRESTAÇÃO DE CONTAS
// 
let chartPrestacaoEvolucao = null;
let chartPrestacaoComposicao = null;

function abrirModalGerarPrestacao() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    document.getElementById('prestacao-data-inicio').valueAsDate = primeiroDia;
    document.getElementById('prestacao-data-fim').valueAsDate = hoje;
    
    document.getElementById('modal-gerar-prestacao').classList.add('show');
}

function fecharModalGerarPrestacao() {
    document.getElementById('modal-gerar-prestacao').classList.remove('show');
}

function fecharModalRelatorioPrestacao() {
    document.getElementById('modal-relatorio-prestacao').classList.remove('show');
}

document.getElementById('form-gerar-prestacao').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const dataInicio = document.getElementById('prestacao-data-inicio').value;
    const dataFim = document.getElementById('prestacao-data-fim').value;
    
    if (!dataInicio || !dataFim) {
        alert('Selecione o período completo.');
        return;
    }
    
    if (dataInicio > dataFim) {
        alert('A data inicial não pode ser maior que a data final.');
        return;
    }
    
    gerarRelatorioPrestacao(dataInicio, dataFim);
    fecharModalGerarPrestacao();
});

function gerarRelatorioPrestacao(dataInicio, dataFim) {
    // Filtrar lançamentos do período
    const lancamentosPeriodo = appData.lancamentos.filter(l => l.data >= dataInicio && l.data <= dataFim);
    
    // Separar lançamentos vinculados e não vinculados
    const lancamentosVinculados = [];
    const lancamentosNaoVinculados = [];
    const eventosComLancamentos = [];
    
    lancamentosPeriodo.forEach(lanc => {
        let encontrado = false;
        appData.eventos.forEach(evento => {
            if (evento.lancamentosVinculados.includes(lanc.id)) {
                encontrado = true;
                if (!eventosComLancamentos.find(e => e.id === evento.id)) {
                    eventosComLancamentos.push(evento);
                }
                lancamentosVinculados.push(lanc);
            }
        });
        if (!encontrado) {
            lancamentosNaoVinculados.push(lanc);
        }
    });
    
    // Calcular totais
    let receitas = 0, despesas = 0;
    lancamentosPeriodo.forEach(l => {
        if (l.tipo === 'RECEITA') receitas += l.valor;
        if (l.tipo === 'DESPESA') despesas += l.valor;
    });
    
    const resultado = receitas - despesas;
    
    // Preencher modal
    document.getElementById('relatorio-prestacao-titulo').textContent = `Prestação de Contas: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
    document.getElementById('relatorio-prestacao-periodo').textContent = `De ${formatarData(dataInicio)} a ${formatarData(dataFim)} (${lancamentosPeriodo.length} lançamentos)`;
    document.getElementById('relatorio-prestacao-receitas').textContent = formatarMoeda(receitas);
    document.getElementById('relatorio-prestacao-despesas').textContent = formatarMoeda(despesas);
    
    const elResultado = document.getElementById('relatorio-prestacao-resultado');
    elResultado.textContent = formatarMoeda(resultado);
    elResultado.className = resultado >= 0 ? 'resumo-valor text-success' : 'resumo-valor text-danger';
    
    // Renderizar eventos vinculados
    const eventosHtml = eventosComLancamentos.map(evento => {
        let recEvento = 0, despEvento = 0;
        evento.lancamentosVinculados.forEach(idLanc => {
            const l = lancamentosPeriodo.find(x => x.id === idLanc);
            if (l) {
                if (l.tipo === 'RECEITA') recEvento += l.valor;
                if (l.tipo === 'DESPESA') despEvento += l.valor;
            }
        });
        const saldoEvento = recEvento - despEvento;
        const corSaldo = saldoEvento >= 0 ? 'text-success' : 'text-danger';
        
        const lancamentosEvento = evento.lancamentosVinculados
            .map(id => lancamentosPeriodo.find(l => l.id === id))
            .filter(l => l !== undefined)
            .sort((a, b) => new Date(a.data) - new Date(b.data));
        
        return `
        <div class="evento-card" style="margin-bottom: 1.5rem;">
            <div class="evento-header">
                <div>
                    <h4 style="margin-bottom: 5px;">${evento.nome}</h4>
                    <span class="badge badge-acao-inserir">${evento.tipificacao}</span>
                </div>
            </div>
            <div class="evento-body">
                <p class="evento-info">${evento.informacoes}</p>
                <div class="evento-stats">
                    <div class="stat-item">
                        <span class="stat-label">Arrecadado</span>
                        <span class="stat-val text-success">${formatarMoeda(recEvento)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Gasto</span>
                        <span class="stat-val text-danger">${formatarMoeda(despEvento)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Balanço</span>
                        <span class="stat-val ${corSaldo}">${formatarMoeda(saldoEvento)}</span>
                    </div>
                </div>
                <div class="table-container" style="margin-top: 1rem;">
                    <table class="table-data">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Histórico</th>
                                <th>Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lancamentosEvento.map(l => `
                                <tr>
                                    <td>${formatarData(l.data)}</td>
                                    <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
                                    <td>${l.historico}</td>
                                    <td><strong>${formatarMoeda(l.valor)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    document.getElementById('relatorio-prestacao-eventos').innerHTML = eventosHtml || '<p class="text-muted">Nenhum evento vinculado neste período.</p>';
    
    // Renderizar lançamentos não vinculados
    const lancamentosNaoVinculadosHtml = lancamentosNaoVinculados.length > 0 ? 
        lancamentosNaoVinculados.map(l => `
            <tr>
                <td>${formatarData(l.data)}</td>
                <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
                <td>${l.tipificacao}</td>
                <td>${l.historico}</td>
                <td><strong>${formatarMoeda(l.valor)}</strong></td>
            </tr>
        `).join('') : '<tr><td colspan="5" class="text-center">Nenhum lançamento não vinculado neste período.</td></tr>';
    
    document.getElementById('relatorio-prestacao-lancamentos-body').innerHTML = lancamentosNaoVinculadosHtml;
    
    // Renderizar gráficos
    renderizarGraficosPrestacao(lancamentosPeriodo);
    
    // Abrir modal
    document.getElementById('modal-relatorio-prestacao').classList.add('show');
}

function renderizarGraficosPrestacao(lancamentos) {
    // Gráfico de Evolução
    const dadosPorData = {};
    lancamentos.forEach(l => {
        if (!dadosPorData[l.data]) dadosPorData[l.data] = { r: 0, d: 0 };
        if (l.tipo === 'RECEITA') dadosPorData[l.data].r += l.valor;
        if (l.tipo === 'DESPESA') dadosPorData[l.data].d += l.valor;
    });

    const datas = Object.keys(dadosPorData).sort();
    const receitasEvolucao = datas.map(d => dadosPorData[d].r);
    const despesasEvolucao = datas.map(d => dadosPorData[d].d);
    const labelsDatas = datas.map(d => formatarData(d));

    const ctxEvolucao = document.getElementById('chart-prestacao-evolucao');
    if (ctxEvolucao) {
        if (chartPrestacaoEvolucao) chartPrestacaoEvolucao.destroy();
        chartPrestacaoEvolucao = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: labelsDatas,
                datasets: [
                    { label: 'Receitas', data: receitasEvolucao, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                    { label: 'Despesas', data: despesasEvolucao, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Gráfico de Composição
    const tipificacoesLabels = [...new Set(lancamentos.map(l => l.tipificacao))];
    const valoresPorTip = tipificacoesLabels.map(t => 
        lancamentos.filter(l => l.tipificacao === t).reduce((acc, curr) => acc + curr.valor, 0)
    );

    const ctxComposicao = document.getElementById('chart-prestacao-composicao');
    if (ctxComposicao) {
        if (chartPrestacaoComposicao) chartPrestacaoComposicao.destroy();
        chartPrestacaoComposicao = new Chart(ctxComposicao, {
            type: 'doughnut',
            data: {
                labels: tipificacoesLabels,
                datasets: [{
                    data: valoresPorTip,
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function imprimirRelatorioPrestacao() {
    window.print();
}

function exportarRelatorioPrestacaoCSV() {
    const titulo = document.getElementById('relatorio-prestacao-titulo').textContent;
    const tbody = document.getElementById('relatorio-prestacao-lancamentos-body');
    const linhas = tbody.querySelectorAll('tr');
    
    if (linhas.length === 0) {
        alert('Não há dados para exportar.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `${titulo}\n\n`;
    csvContent += "Data;Tipo;Categoria;Historico;Valor\n";

    linhas.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length > 1) {
            const data = cols[0].innerText;
            const tipo = cols[1].innerText;
            const categoria = cols[2].innerText;
            const historico = cols[3].innerText.replace(/;/g, "");
            const valor = cols[4].innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            
            csvContent += `${data};${tipo};${categoria};${historico};${valor}\n`;
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prestacao_contas_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 
// MÓDULO: CADASTRO DE IRMÃOS
// 
function renderizarIrmaos() {
    const tbody = document.getElementById('irmaos-body');
    
    if (!appData.irmaos) appData.irmaos = [];
    
    if (appData.irmaos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">Nenhum irmão cadastrado. Clique em "Adicionar Irmão" para começar.</td></tr>';
        return;
    }

    tbody.innerHTML = appData.irmaos.map(irmao => `
        <tr>
            <td><strong>${irmao.nome}</strong></td>
            <td>${irmao.email}</td>
            <td>${irmao.whatsapp}</td>
            <td>
                <span class="badge ${irmao.ativo ? 'badge-acao-inserir' : 'badge-acao-excluir'}">
                    ${irmao.ativo ? '✓ Ativo' : '✗ Inativo'}
                </span>
            </td>
            <td>
                <button class="btn-icon" onclick="abrirModalIrmao(${irmao.id})" title="Editar">✏️</button>
                <button class="btn-icon" onclick="excluirIrmao(${irmao.id})" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function abrirModalIrmao(id = null) {
    document.getElementById('form-irmao').reset();
    document.getElementById('irmao-id').value = '';
    document.getElementById('modal-irmao-title').textContent = '👥 Adicionar Irmão';
    document.getElementById('irmao-ativo').checked = true;
    atualizarToggleIrmao();

    if (id) {
        const irmao = appData.irmaos.find(i => i.id === id);
        document.getElementById('irmao-id').value = irmao.id;
        document.getElementById('irmao-nome').value = irmao.nome;
        document.getElementById('irmao-email').value = irmao.email;
        document.getElementById('irmao-whatsapp').value = irmao.whatsapp;
        document.getElementById('irmao-ativo').checked = irmao.ativo;
        document.getElementById('modal-irmao-title').textContent = '👥 Editar Irmão';
        atualizarToggleIrmao();
    }

    document.getElementById('modal-irmao').classList.add('show');
}

function atualizarToggleIrmao() {
    const checkbox = document.getElementById('irmao-ativo');
    const toggle = document.getElementById('toggle-irmao');
    const circle = document.getElementById('toggle-circle-irmao');
    const text = document.getElementById('toggle-text-irmao');

    if (checkbox.checked) {
        toggle.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        toggle.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
        circle.style.left = '2px';
        text.textContent = 'Ativo';
    } else {
        toggle.style.background = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)';
        toggle.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        circle.style.left = '30px';
        text.textContent = 'Inativo';
    }
}

// Adicione listener para o toggle
document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('irmao-ativo');
    if (checkbox) {
        checkbox.addEventListener('change', atualizarToggleIrmao);
    }
});

function fecharModalIrmao() {
    document.getElementById('modal-irmao').classList.remove('show');
}

document.getElementById('form-irmao').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('irmao-id').value;
    const dados = {
        nome: document.getElementById('irmao-nome').value,
        email: document.getElementById('irmao-email').value,
        whatsapp: document.getElementById('irmao-whatsapp').value,
        ativo: document.getElementById('irmao-ativo').checked
    };

    if (!appData.irmaos) appData.irmaos = [];

    if (id) {
        const index = appData.irmaos.findIndex(i => i.id == id);
        appData.irmaos[index] = { ...dados, id: parseInt(id) };
        registrarHistorico('EDIÇÃO', `Irmão: ${dados.nome}`);
    } else {
        const novoId = appData.irmaos.length > 0 ? Math.max(...appData.irmaos.map(i => i.id)) + 1 : 1;
        appData.irmaos.push({ ...dados, id: novoId });
        registrarHistorico('INSERÇÃO', `Irmão: ${dados.nome}`);
    }

    fecharModalIrmao();
    renderizarIrmaos();
    salvarDados();
});

function excluirIrmao(id) {
    if (confirm('Tem certeza que deseja excluir este irmão?')) {
        const irmao = appData.irmaos.find(i => i.id === id);
        appData.irmaos = appData.irmaos.filter(i => i.id !== id);
        registrarHistorico('EXCLUSÃO', `Irmão: ${irmao.nome}`);
        renderizarIrmaos();
        salvarDados();
    }
}

// 
// ENVIO DE PRESTAÇÃO DE CONTAS
// 
let prestacaoAtualParaEnvio = null;

function abrirModalEnviarPrestacao() {
    if (!appData.irmaos || appData.irmaos.length === 0) {
        alert('Nenhum irmão cadastrado. Acesse a seção "Irmãos" para adicionar contatos.');
        return;
    }

    const tbody = document.getElementById('envio-irmaos-body');
    tbody.innerHTML = appData.irmaos.map(irmao => `
        <tr>
            <td><input type="checkbox" class="chk-envio-irmao" value="${irmao.id}" checked></td>
            <td>${irmao.nome}</td>
            <td>${irmao.email}</td>
            <td>${irmao.whatsapp}</td>
        </tr>
    `).join('');

    document.getElementById('modal-enviar-prestacao').classList.add('show');
}

function fecharModalEnviarPrestacao() {
    document.getElementById('modal-enviar-prestacao').classList.remove('show');
}

function selecionarTodosIrmaos() {
    document.querySelectorAll('.chk-envio-irmao').forEach(chk => chk.checked = true);
}

function desmarcarTodosIrmaos() {
    document.querySelectorAll('.chk-envio-irmao').forEach(chk => chk.checked = false);
}

function enviarPrestacaoSelecionados() {
    const checkboxes = document.querySelectorAll('.chk-envio-irmao:checked');
    const irmaosIds = Array.from(checkboxes).map(chk => parseInt(chk.value));
    const enviarEmail = document.getElementById('envio-email').checked;
    const enviarWhatsapp = document.getElementById('envio-whatsapp').checked;

    if (irmaosIds.length === 0) {
        alert('Selecione pelo menos um irmão para enviar.');
        return;
    }

    if (!enviarEmail && !enviarWhatsapp) {
        alert('Selecione pelo menos um canal de envio (Email ou WhatsApp).');
        return;
    }

    const irmaosParaEnviar = appData.irmaos.filter(i => irmaosIds.includes(i.id));
    
    // Simular envio
    let mensagem = '✅ Prestação de Contas enviada com sucesso para:\n\n';
    
    irmaosParaEnviar.forEach(irmao => {
        const canais = [];
        if (enviarEmail) canais.push(`📧 ${irmao.email}`);
        if (enviarWhatsapp) canais.push(`💬 ${irmao.whatsapp}`);
        mensagem += `${irmao.nome}\n${canais.join(' | ')}\n\n`;
    });

    alert(mensagem);
    
    // Registrar no histórico
    registrarHistorico('ENVIO', `Prestação de Contas enviada para ${irmaosParaEnviar.length} irmão(s)`);
    
    fecharModalEnviarPrestacao();
    fecharModalRelatorioPrestacao();
}

// ==========================================
// CONTROLE DE ACESSOS (Admin)
// ==========================================

let todosOsUsuarios = [];

async function carregarControleAcessos() {
    try {
        todosOsUsuarios = await supabaseGetAllProfiles();
        filtrarControleAcessos();
        atualizarBadgePendentes();
    } catch (erro) {
        console.error('[ACESSOS] Erro ao carregar usuários:', erro);
    }
}

function filtrarControleAcessos() {
    const filtro = document.getElementById('filtro-status-acesso')?.value || '';
    const lista = filtro ? todosOsUsuarios.filter(u => u.status === filtro) : todosOsUsuarios;
    renderizarControleAcessos(lista);
}

function renderizarControleAcessos(usuarios) {
    const tbody = document.getElementById('controle-acessos-body');
    if (!tbody) return;

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem;">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    const statusLabel = {
        pending:  '<span class="status-badge status-pending">🟡 Pendente</span>',
        approved: '<span class="status-badge status-approved">✅ Aprovado</span>',
        rejected: '<span class="status-badge status-rejected">❌ Rejeitado</span>'
    };

    tbody.innerHTML = usuarios.map(u => {
        const roleAtual = u.role || 'user';
        const roleSelect = `
            <select id="role-select-${u.id}" style="padding:0.2rem 0.5rem;font-size:0.8rem;border-radius:4px;border:1px solid var(--color-border);">
                <option value="user" ${roleAtual === 'user' ? 'selected' : ''}>Usuário</option>
                <option value="admin" ${roleAtual === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
        `;

        let acoes = '';
        if (u.status === 'pending') {
            acoes = `
                <button class="btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="atualizarAcesso('${u.id}','approved')">✔ Aprovar</button>
                <button class="btn-secondary" style="padding:0.3rem 0.8rem;font-size:0.8rem;margin-left:4px;" onclick="atualizarAcesso('${u.id}','rejected')">✘ Rejeitar</button>
            `;
        } else if (u.status === 'approved') {
            acoes = `
                <button class="btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="salvarPerfil('${u.id}')">💾 Salvar</button>
                <button class="btn-secondary" style="padding:0.3rem 0.8rem;font-size:0.8rem;margin-left:4px;" onclick="atualizarAcesso('${u.id}','rejected')">🚫 Revogar</button>
            `;
        } else {
            acoes = `<button class="btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="atualizarAcesso('${u.id}','approved')">✔ Aprovar</button>`;
        }

        const data = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-';

        return `
            <tr>
                <td><strong>${u.nome || '-'}</strong></td>
                <td>${u.email}</td>
                <td>${data}</td>
                <td>${statusLabel[u.status] || u.status}</td>
                <td>${roleSelect}</td>
                <td>${acoes}</td>
            </tr>
        `;
    }).join('');
}

async function atualizarAcesso(userId, novoStatus) {
    const labels = { approved: 'aprovado', rejected: 'rejeitado/revogado' };
    if (!confirm(`Confirma marcar este acesso como ${labels[novoStatus] || novoStatus}?`)) return;

    try {
        if (novoStatus === 'approved') {
            const roleSelect = document.getElementById(`role-select-${userId}`);
            if (roleSelect) {
                await supabaseUpdateProfileRole(userId, roleSelect.value);
            }
        }
        await supabaseUpdateProfileStatus(userId, novoStatus);
        await carregarControleAcessos();
        registrarHistorico('ACESSO', `Acesso ${novoStatus} para usuário ID ${userId}`);
    } catch (erro) {
        alert('Erro ao atualizar acesso: ' + erro.message);
    }
}

async function salvarPerfil(userId) {
    const roleSelect = document.getElementById(`role-select-${userId}`);
    if (!roleSelect) return;
    const role = roleSelect.value;
    const label = role === 'admin' ? 'Administrador' : 'Usuário';
    if (!confirm(`Confirma alterar o perfil deste usuário para "${label}"?`)) return;

    try {
        await supabaseUpdateProfileRole(userId, role);
        await carregarControleAcessos();
        registrarHistorico('ACESSO', `Perfil alterado para ${role} — usuário ID ${userId}`);
    } catch (erro) {
        alert('Erro ao atualizar perfil: ' + erro.message);
    }
}

function atualizarBadgePendentes() {
    const badge = document.getElementById('badge-pendentes');
    if (!badge) return;
    const pendentes = todosOsUsuarios.filter(u => u.status === 'pending').length;
    if (pendentes > 0) {
        badge.textContent = pendentes;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// ==========================================
// IMPORTAR IRMÃOS VIA EXCEL (SheetJS)
// ==========================================

function importarIrmaosExcel(inputEl) {
    const arquivo = inputEl.files[0];
    if (!arquivo) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const linhas = XLSX.utils.sheet_to_json(sheet);

            if (!linhas.length) {
                alert('Planilha vazia ou formato não reconhecido.');
                return;
            }

            // Normalizar nomes de colunas (case-insensitive)
            const normalizar = obj => {
                const n = {};
                for (const k in obj) n[k.toLowerCase().trim()] = obj[k];
                return n;
            };

            let importados = 0;
            let ignorados = 0;
            const emailsExistentes = new Set((appData.irmaos || []).map(i => i.email.toLowerCase()));

            linhas.forEach(linha => {
                const l = normalizar(linha);
                const nome = (l['nome'] || l['name'] || '').toString().trim();
                const email = (l['email'] || '').toString().trim().toLowerCase();
                const whatsapp = (l['whatsapp'] || l['telefone'] || l['phone'] || '').toString().trim();

                if (!nome || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    ignorados++;
                    return;
                }

                if (emailsExistentes.has(email)) {
                    ignorados++;
                    return;
                }

                const novoId = appData.irmaos.length > 0
                    ? Math.max(...appData.irmaos.map(i => i.id)) + 1
                    : 1;

                appData.irmaos.push({ id: novoId, nome, email, whatsapp: whatsapp || '-', ativo: true });
                emailsExistentes.add(email);
                importados++;
            });

            salvarDados();
            renderizarIrmaos();
            registrarHistorico('IMPORTAÇÃO', `${importados} irmão(s) importado(s) via Excel`);
            alert(`✅ ${importados} irmão(s) importado(s) com sucesso!\n${ignorados > 0 ? `⚠️ ${ignorados} linha(s) ignorada(s) (email inválido ou duplicado).` : ''}`);

        } catch (erro) {
            alert('Erro ao ler o arquivo: ' + erro.message);
        } finally {
            inputEl.value = '';
        }
    };
    reader.readAsArrayBuffer(arquivo);
}
function importarLancamentosExcel(inputEl) {
    const arquivo = inputEl.files[0];
    if (!arquivo) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const linhas = XLSX.utils.sheet_to_json(sheet, { raw: false });

            if (!linhas.length) {
                alert('Planilha vazia ou formato nao reconhecido.');
                return;
            }

            const normalizar = obj => {
                const n = {};
                for (const k in obj) n[k.toLowerCase().trim()] = obj[k];
                return n;
            };

            const tipificacoesValidas = new Set((appData.tipificacoes || []).map(t => t.nome.toLowerCase()));

            let importados = 0;
            let ignorados = 0;
            const erros = [];

            const proximoId = appData.lancamentos.length > 0
                ? Math.max(...appData.lancamentos.map(l => l.id)) + 1
                : 1;
            let idAtual = proximoId;

            linhas.forEach((linha, idx) => {
                const l = normalizar(linha);

                const dataRaw = (l['data'] || '').toString().trim();
                const tipoRaw = (l['tipo'] || '').toString().trim().toUpperCase();
                const categoriaRaw = (l['categoria'] || l['tipificacao'] || '').toString().trim();
                const historico = (l['historico'] || '').toString().trim();
                const descricao = (l['descricao'] || '').toString().trim();
                const valorRaw = (l['valor'] || '').toString().replace(',', '.').trim();

                if (!dataRaw) { ignorados++; erros.push('Linha ' + (idx + 2) + ': data ausente'); return; }
                if (tipoRaw !== 'RECEITA' && tipoRaw !== 'DESPESA') {
                    ignorados++;
                    erros.push('Linha ' + (idx + 2) + ': tipo invalido ("' + tipoRaw + '") - use RECEITA ou DESPESA');
                    return;
                }

                const valor = parseFloat(valorRaw);
                if (isNaN(valor) || valor <= 0) {
                    ignorados++;
                    erros.push('Linha ' + (idx + 2) + ': valor invalido ("' + valorRaw + '")');
                    return;
                }

                if (categoriaRaw && !tipificacoesValidas.has(categoriaRaw.toLowerCase())) {
                    ignorados++;
                    erros.push('Linha ' + (idx + 2) + ': categoria "' + categoriaRaw + '" nao encontrada nas tipificacoes');
                    return;
                }

                appData.lancamentos.push({ id: idAtual++, data: dataRaw, tipo: tipoRaw, categoria: categoriaRaw, historico, descricao, valor });
                importados++;
            });

            if (importados > 0) {
                salvarDados();
                renderizarLancamentos();
                registrarHistorico('IMPORTACAO', importados + ' lancamento(s) importado(s) via Excel');
            }

            let msg = importados + ' lancamento(s) importado(s) com sucesso!';
            if (ignorados > 0) {
                msg += '\n' + ignorados + ' linha(s) ignorada(s):\n' + erros.slice(0, 5).join('\n');
                if (erros.length > 5) msg += '\n... e mais ' + (erros.length - 5) + ' erros.';
            }
            alert(msg);

        } catch (erro) {
            alert('Erro ao ler o arquivo: ' + erro.message);
        } finally {
            inputEl.value = '';
        }
    };
    reader.readAsArrayBuffer(arquivo);
}
//
// MÓDULO: PLANO DE CONTAS E ORÇAMENTO
//

appData.planoContas = [];
if (!appData.orcamentos) appData.orcamentos = [];

async function carregarPlanoContasSupabase() {
    const { data: planos, error: ePlanos } = await supabaseClient
        .from('plano_contas')
        .select('id, tipo, descricao')
        .order('id');

    if (ePlanos) { console.error('Erro ao carregar plano_contas:', ePlanos); return; }

    const { data: contas, error: eContas } = await supabaseClient
        .from('contas')
        .select('id, plano_id, nome')
        .order('id');

    if (eContas) { console.error('Erro ao carregar contas:', eContas); return; }

    const { data: descricoes, error: eDesc } = await supabaseClient
        .from('conta_descricoes')
        .select('conta_id, descricao');

    if (eDesc) { console.error('Erro ao carregar conta_descricoes:', eDesc); return; }

    appData.planoContas = planos.map(p => ({
        id: p.id,
        nome: p.tipo,
        descricao: p.descricao || '',
        contas: contas
            .filter(c => c.plano_id === p.id)
            .map(c => ({
                id: c.id,
                nome: c.nome,
                descricoes: descricoes
                    .filter(d => d.conta_id === c.id)
                    .map(d => d.descricao)
            }))
    }));

    renderizarPlanoContas();
    atualizarSelectsPlanosContas();
}

// Renderizar Plano de Contas
function renderizarPlanoContas() {
    const container = document.getElementById('grupos-contas-container');

    if (!appData.planoContas || appData.planoContas.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem;">Nenhum grupo configurado.</p>';
        return;
    }

    const tipos = ['RECEITA', 'DESPESA'];

    container.innerHTML = tipos.map(tipo => {
        const gruposDeTipo = appData.planoContas
            .map((g, idx) => ({ ...g, _idx: idx }))
            .filter(g => g.nome === tipo);

        if (gruposDeTipo.length === 0) return '';

        const cor = tipo === 'RECEITA' ? 'receita' : 'despesa';
        const bgHeader = tipo === 'RECEITA' ? '#e8f5e9' : '#fdecea';
        const borderColor = tipo === 'RECEITA' ? '#4caf50' : '#f44336';

        const gruposHTML = gruposDeTipo.map(grupo => `
            <div style="margin-bottom: 1.5rem; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f8fafc;">
                    <strong style="font-size: 0.95rem;">${grupo.descricao || grupo.nome}</strong>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon" onclick="abrirModalGrupoContas(${grupo._idx})" title="Editar">✏️</button>
                        <button class="btn-icon" onclick="excluirGrupoContas(${grupo._idx})" title="Excluir">🗑️</button>
                    </div>
                </div>
                <div style="padding: 0.75rem 1rem;">
                    ${(grupo.contas || []).length === 0
                        ? '<p class="text-muted" style="margin:0; font-size:0.85rem;">Nenhuma conta cadastrada.</p>'
                        : (grupo.contas || []).map((cat, catIdx) => `
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.4rem 0; border-bottom: 1px solid #f0f0f0;">
                                <div>
                                    <span style="font-size: 0.9rem;">${cat.nome}</span>
                                    ${(cat.descricoes || []).length > 0
                                        ? `<div style="font-size:0.78rem; color: var(--color-text-muted); margin-top:0.2rem;">${cat.descricoes.join(' · ')}</div>`
                                        : ''}
                                </div>
                                <button class="btn-icon" onclick="editarCategoriaContas(${grupo._idx}, ${catIdx})" title="Editar" style="flex-shrink:0; margin-left:0.5rem;">✏️</button>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `).join('');

        return `
            <div style="margin-bottom: 2.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding: 0.75rem 1rem; background: ${bgHeader}; border-left: 4px solid ${borderColor}; border-radius: 4px;">
                    <span class="badge badge-${cor}" style="font-size: 1rem; padding: 0.3rem 1rem;">${tipo}</span>
                    <span class="text-muted" style="font-size: 0.85rem;">${gruposDeTipo.reduce((acc, g) => acc + (g.contas || []).length, 0)} contas cadastradas</span>
                </div>
                ${gruposHTML}
            </div>
        `;
    }).join('');

    atualizarSelectsPlanosContas();
}

function atualizarSelectsPlanosContas() {
    // selects removidos com a nova tela de orçamento — mantido vazio para compatibilidade
}

// ============================================================
// ORÇAMENTO 2026 — Planilha interativa
// ============================================================
let orcExercicioAtivo = 2026;
let orcExerciciosDisponiveis = [];
const ORC_MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CONTA_MENSALIDADES_ID = 4;
const CONTA_INADIMPLENCIA_ID = 3;

let orcParam = {};
let orcValores = {};

async function carregarExercicios() {
    const { data, error } = await supabaseClient
        .from('orcamento_parametros')
        .select('ano')
        .order('ano', { ascending: true });
    if (error) { console.error('carregarExercicios:', error); return; }
    const anos = [...new Set((data || []).map(r => r.ano))];
    orcExerciciosDisponiveis = anos;
    if (anos.length > 0 && !anos.includes(orcExercicioAtivo)) {
        orcExercicioAtivo = anos[0];
    }
    if (anos.length === 0) {
        orcExercicioAtivo = new Date().getFullYear();
    }
}

function renderizarSidebarExercicios() {
    const lista = document.getElementById('orcamento-exercicios-lista');
    const titulo = document.getElementById('orcamento-titulo');
    if (!lista) return;

    lista.innerHTML = orcExerciciosDisponiveis.map(ano => {
        const ativo = ano === orcExercicioAtivo;
        return `<button onclick="trocarExercicio(${ano})" style="
            width:100%; text-align:left; padding:0.4rem 0.6rem;
            border-radius:6px; border:none; cursor:pointer; font-size:0.9rem;
            background:${ativo ? 'var(--color-primary)' : 'transparent'};
            color:${ativo ? 'white' : '#334155'};
            font-weight:${ativo ? '700' : '400'};
        ">${ativo ? '● ' : ''}${ano}</button>`;
    }).join('');

    if (titulo) titulo.textContent = `Planejamento Orçamentário — ${orcExercicioAtivo}`;
}

async function trocarExercicio(ano) {
    orcExercicioAtivo = ano;
    orcParam = {};
    orcValores = {};
    const container = document.getElementById('orcamento-planilha-container');
    if (container) container.innerHTML = '<p class="text-muted" style="padding:2rem;">Carregando...</p>';

    for (let m = 1; m <= 12; m++) {
        orcParam[m] = { ano: orcExercicioAtivo, mes: m,
            obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
            mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
            taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 };
    }

    const { data: params } = await supabaseClient
        .from('orcamento_parametros').select('*').eq('ano', orcExercicioAtivo);
    (params || []).forEach(p => { orcParam[p.mes] = p; });

    const { data: valores } = await supabaseClient
        .from('orcamento_valores').select('*').eq('ano', orcExercicioAtivo);
    orcValores = {};
    (valores || []).forEach(v => { orcValores[`${v.mes}_${v.conta_id}`] = parseFloat(v.valor) || 0; });

    renderizarSidebarExercicios();
    renderizarParametros();
    renderizarPlanilha();
}

async function carregarOrcamento() {
    const container = document.getElementById('orcamento-planilha-container');
    if (container) container.innerHTML = '<p class="text-muted" style="padding:2rem;">Carregando...</p>';

    await carregarExercicios();

    for (let m = 1; m <= 12; m++) {
        orcParam[m] = { ano: orcExercicioAtivo, mes: m,
            obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
            mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
            taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 };
    }

    const { data: params, error: ep } = await supabaseClient
        .from('orcamento_parametros').select('*').eq('ano', orcExercicioAtivo);
    if (ep) { console.error('orcamento_parametros:', ep); }
    (params || []).forEach(p => { orcParam[p.mes] = p; });

    const { data: valores, error: ev } = await supabaseClient
        .from('orcamento_valores').select('*').eq('ano', orcExercicioAtivo);
    if (ev) { console.error('orcamento_valores:', ev); }
    orcValores = {};
    (valores || []).forEach(v => { orcValores[`${v.mes}_${v.conta_id}`] = parseFloat(v.valor) || 0; });

    renderizarSidebarExercicios();
    renderizarParametros();
    renderizarPlanilha();
}

async function salvarParametro(mes, campo, rawVal) {
    const isPct = campo === 'taxa_inadimplencia';
    const val = isPct ? (parseFloat(rawVal) || 0) / 100 : parseFloat(rawVal) || 0;
    orcParam[mes] = { ...orcParam[mes], [campo]: val };
    await supabaseClient.from('orcamento_parametros')
        .upsert({ ...orcParam[mes] }, { onConflict: 'ano,mes' });
    // Atualiza total de obreiros e recalcula planilha
    const p = orcParam[mes];
    const totEl = document.getElementById(`param-total-obreiros-${mes}`);
    if (totEl) totEl.textContent = (p.obreiros_normal||0)+(p.obreiros_remido||0)+(p.obreiros_licenciado||0);
    renderizarPlanilha();
}

async function salvarValorConta(contaId, mes, rawVal) {
    const val = parseFloat(rawVal) || 0;
    orcValores[`${mes}_${contaId}`] = val;
    await supabaseClient.from('orcamento_valores')
        .upsert({ ano: orcExercicioAtivo, mes, conta_id: contaId, valor: val },
                 { onConflict: 'ano,mes,conta_id' });
    renderizarPlanilha();
}

function calcMensalidades(mes) {
    const p = orcParam[mes] || {};
    return ((p.obreiros_normal||0)*(p.mensalidade_normal||0))
         + ((p.obreiros_remido||0)*(p.mensalidade_remido||0))
         + ((p.obreiros_licenciado||0)*(p.mensalidade_licenciado||0));
}

function calcInadimplencia(mes) {
    return -(calcMensalidades(mes) * (orcParam[mes]?.taxa_inadimplencia || 0));
}

function getValorConta(contaId, mes) {
    if (contaId === CONTA_MENSALIDADES_ID) return calcMensalidades(mes);
    if (contaId === CONTA_INADIMPLENCIA_ID) return calcInadimplencia(mes);
    return orcValores[`${mes}_${contaId}`] || 0;
}

function calcAnualConta(contaId) {
    let t = 0; for (let m=1;m<=12;m++) t += getValorConta(contaId, m); return t;
}

function calcMesGrupo(grupo, mes) {
    return (grupo.contas||[]).reduce((a,c) => a + getValorConta(c.id, mes), 0);
}

function calcAnualGrupo(grupo) {
    let t = 0; for (let m=1;m<=12;m++) t += calcMesGrupo(grupo, m); return t;
}

function renderizarParametros() {
    const container = document.getElementById('orcamento-parametros-container');
    if (!container) return;
    const M = [1,2,3,4,5,6,7,8,9,10,11,12];
    const rows = [
        { key:'obreiros_normal',      label:'Nº Obreiros — Normal',            step:'1',    pct:false },
        { key:'obreiros_remido',      label:'Nº Obreiros — Remido',            step:'1',    pct:false },
        { key:'obreiros_licenciado',  label:'Nº Obreiros — Licenciado',        step:'1',    pct:false },
        { key:'mensalidade_normal',   label:'Mensalidade Normal (R$)',          step:'0.01', pct:false },
        { key:'mensalidade_remido',   label:'Mensalidade Remido (R$)',          step:'0.01', pct:false },
        { key:'mensalidade_licenciado',label:'Mensalidade Licenciado (R$)',     step:'0.01', pct:false },
        { key:'taxa_inadimplencia',   label:'Taxa de Inadimplência (%)',        step:'0.1',  pct:true  },
        { key:'taxa_gob',             label:'Taxa GOB (R$)',                    step:'0.01', pct:false },
        { key:'taxa_godf',            label:'Taxa GODF (R$)',                   step:'0.01', pct:false },
    ];
    const th = 'padding:0.45rem 0.5rem; border:1px solid #cbd5e1; text-align:center; font-size:0.8rem;';
    const tdLabel = 'padding:0.35rem 0.75rem; border:1px solid #e2e8f0; background:#f8fafc; white-space:nowrap; font-size:0.8rem;';
    const tdInput = 'padding:0.1rem; border:1px solid #e2e8f0;';
    const inputStyle = 'width:100%;border:none;text-align:right;padding:0.25rem;font-size:0.8rem;background:transparent;';

    container.innerHTML = `
        <p style="font-weight:600; margin-bottom:0.75rem; color:var(--color-primary);">Parâmetros Mensais — ${orcExercicioAtivo}</p>
        <div style="overflow-x:auto;">
        <table style="border-collapse:collapse; min-width:1100px; width:100%;">
            <thead><tr style="background:#f1f5f9;">
                <th style="text-align:left;${th} min-width:220px;">Variável</th>
                ${ORC_MESES_LABELS.map(l=>`<th style="${th} min-width:78px;">${l}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${rows.map(r=>`<tr>
                    <td style="${tdLabel}">${r.label}</td>
                    ${M.map(mes=>{
                        const raw = orcParam[mes]?.[r.key] ?? 0;
                        const disp = r.pct ? (raw*100).toFixed(1) : raw;
                        return `<td style="${tdInput}"><input type="number" step="${r.step}" value="${disp}"
                            style="${inputStyle}" onfocus="this.select()"
                            onblur="salvarParametro(${mes},'${r.key}',this.value)"></td>`;
                    }).join('')}
                </tr>`).join('')}
                <tr style="background:#dbeafe; font-weight:600;">
                    <td style="${tdLabel} background:#dbeafe;">Total de Obreiros Contribuintes</td>
                    ${M.map(mes=>{
                        const p=orcParam[mes]||{};
                        const tot=(p.obreiros_normal||0)+(p.obreiros_remido||0)+(p.obreiros_licenciado||0);
                        return `<td id="param-total-obreiros-${mes}" style="text-align:right;padding:0.35rem 0.5rem;border:1px solid #bfdbfe;">${tot}</td>`;
                    }).join('')}
                </tr>
            </tbody>
        </table></div>`;
}

function renderizarPlanilha() {
    const container = document.getElementById('orcamento-planilha-container');
    if (!container || !appData.planoContas || appData.planoContas.length === 0) return;

    const M = [1,2,3,4,5,6,7,8,9,10,11,12];
    const receitas = appData.planoContas.filter(g => g.nome === 'RECEITA');
    const despesas = appData.planoContas.filter(g => g.nome === 'DESPESA');

    const totRecMes  = m => receitas.reduce((a,g)=>a+calcMesGrupo(g,m),0);
    const totRecAnual = M.reduce((a,m)=>a+totRecMes(m),0);
    const totDesMes  = m => despesas.reduce((a,g)=>a+calcMesGrupo(g,m),0);
    const totDesAnual = M.reduce((a,m)=>a+totDesMes(m),0);
    const resMes  = m => totRecMes(m) - totDesMes(m);
    const resAnual = totRecAnual - totDesAnual;

    const fv = v => (v===0||!v) ? '—' : v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const fp = (v,b) => (!b||b===0) ? '—' : ((v/b)*100).toFixed(2)+'%';

    const S = {
        th: 'padding:0.5rem 0.4rem; border:1px solid #475569; text-align:right; font-size:0.78rem;',
        n1: 'background:#1e293b; color:white; font-weight:700; padding:0.5rem 0.4rem; text-align:right; border:1px solid #334155; font-size:0.78rem;',
        n1d: 'background:#1e293b; color:white; font-weight:700; padding:0.5rem 0.75rem; border:1px solid #334155; white-space:nowrap; font-size:0.78rem;',
        n2: 'background:#e2e8f0; font-weight:700; padding:0.4rem 0.4rem; text-align:right; border:1px solid #cbd5e1; font-size:0.78rem;',
        n2d: 'background:#e2e8f0; font-weight:700; padding:0.4rem 1rem; border:1px solid #cbd5e1; white-space:nowrap; font-size:0.78rem;',
        n3: 'background:white; padding:0.3rem 0.4rem; text-align:right; border:1px solid #e2e8f0; font-size:0.78rem;',
        n3d: 'background:white; padding:0.3rem 1.5rem; border:1px solid #e2e8f0; white-space:nowrap; font-size:0.78rem;',
        fc: 'background:#eff6ff; padding:0.3rem 0.4rem; text-align:right; border:1px solid #bfdbfe; font-size:0.78rem;',
        inp: 'width:100%;border:none;text-align:right;padding:0.2rem;font-size:0.78rem;background:transparent;',
        cellinp: 'padding:0.1rem; border:1px solid #e2e8f0;',
    };

    const rowN1 = (cod, label, getMes, anual) => `<tr>
        <td style="${S.n1d}">${cod}  ${label}</td>
        <td style="${S.n1}">${fv(anual/12)}</td>
        <td style="${S.n1}">${fp(anual,totRecAnual)}</td>
        ${M.map(m=>`<td style="${S.n1}">${fv(getMes(m))}</td>`).join('')}
        <td style="${S.n1}">${fv(anual)}</td>
    </tr>`;

    const rowN2 = (cod, label, getMes, anual) => `<tr>
        <td style="${S.n2d}">${cod}  ${label}</td>
        <td style="${S.n2}">${fv(anual/12)}</td>
        <td style="${S.n2}">${fp(anual,totRecAnual)}</td>
        ${M.map(m=>`<td style="${S.n2}">${fv(getMes(m))}</td>`).join('')}
        <td style="${S.n2}">${fv(anual)}</td>
    </tr>`;

    const rowConta = (conta, isFormula) => {
        const anual = calcAnualConta(conta.id);
        return `<tr>
            <td style="${S.n3d}">${conta.nome}</td>
            <td style="${isFormula?S.fc:S.n3}">${fv(anual/12)}</td>
            <td style="${isFormula?S.fc:S.n3}">${fp(anual,totRecAnual)}</td>
            ${M.map(m => {
                const v = getValorConta(conta.id, m);
                if (isFormula) return `<td style="${S.fc}">${fv(v)}</td>`;
                return `<td style="${S.cellinp}"><input type="number" step="0.01"
                    value="${v||''}" style="${S.inp}" onfocus="this.select()"
                    onblur="salvarValorConta(${conta.id},${m},this.value)"></td>`;
            }).join('')}
            <td style="${isFormula?S.fc:S.n3}">${fv(anual)}</td>
        </tr>`;
    };

    const rowResultado = () => {
        const cor = resAnual >= 0 ? '#16a34a' : '#dc2626';
        const st = `background:#0f172a; color:${cor}; font-weight:700; padding:0.5rem 0.4rem; text-align:right; border:1px solid #1e293b; font-size:0.78rem;`;
        return `<tr>
            <td style="background:#0f172a;color:${cor};font-weight:700;padding:0.5rem 0.75rem;border:1px solid #1e293b;white-space:nowrap;font-size:0.78rem;">RESULTADO FINAL</td>
            <td style="${st}">${fv(resAnual/12)}</td>
            <td style="${st}">${fp(resAnual,totRecAnual)}</td>
            ${M.map(m=>{const v=resMes(m);const c=v>=0?'#16a34a':'#dc2626';
                return `<td style="background:#0f172a;color:${c};font-weight:700;padding:0.5rem 0.4rem;text-align:right;border:1px solid #1e293b;font-size:0.78rem;">${fv(v)}</td>`;
            }).join('')}
            <td style="background:#0f172a;color:${cor};font-weight:700;padding:0.5rem 0.4rem;text-align:right;border:1px solid #1e293b;font-size:0.78rem;">${fv(resAnual)}</td>
        </tr>`;
    };

    container.innerHTML = `
        <p style="font-weight:600; margin-bottom:0.75rem; color:var(--color-primary);">Projeção de Receitas e Despesas — ${ORC_EXERCICIO}</p>
        <div style="overflow-x:auto;">
        <table style="border-collapse:collapse; min-width:1500px; width:100%;">
            <thead><tr style="background:#334155; color:white;">
                <th style="text-align:left;${S.th} min-width:260px; position:sticky; left:0; z-index:2; background:#334155;">Descrição</th>
                <th style="${S.th} min-width:90px;">Média Mensal</th>
                <th style="${S.th} min-width:60px;">%</th>
                ${ORC_MESES_LABELS.map(l=>`<th style="${S.th} min-width:78px;">${l}</th>`).join('')}
                <th style="${S.th} min-width:90px;">Total</th>
            </tr></thead>
            <tbody>
                ${rowN1('1','TOTAL DAS RECEITAS', totRecMes, totRecAnual)}
                ${receitas.map((g,i)=>`
                    ${rowN2(`1.${i+1}`, g.descricao, m=>calcMesGrupo(g,m), calcAnualGrupo(g))}
                    ${(g.contas||[]).map(c=>rowConta(c, c.id===CONTA_MENSALIDADES_ID||c.id===CONTA_INADIMPLENCIA_ID)).join('')}
                `).join('')}
                ${rowN1('2','TOTAL DAS DESPESAS', totDesMes, totDesAnual)}
                ${despesas.map((g,i)=>`
                    ${rowN2(`2.${i+1}`, g.descricao, m=>calcMesGrupo(g,m), calcAnualGrupo(g))}
                    ${(g.contas||[]).map(c=>rowConta(c, false)).join('')}
                `).join('')}
                ${rowResultado()}
            </tbody>
        </table></div>`;
}

// Funções de Plano de Contas
function abrirModalGrupoContas(idx = null) {
    document.getElementById('form-grupo-contas').reset();
    document.getElementById('grupo-id').value = '';
    document.getElementById('modal-grupo-title').textContent = 'Novo Grupo de Contas';
    document.getElementById('categorias-grupo-container').innerHTML = '';

    if (idx !== null) {
        const grupo = appData.planoContas[idx];
        document.getElementById('grupo-id').value = idx;
        document.getElementById('grupo-nome').value = grupo.nome;
        document.getElementById('grupo-descricao').value = grupo.descricao;
        document.getElementById('modal-grupo-title').textContent = 'Editar Grupo de Contas';

        (grupo.contas || grupo.categorias || []).forEach((cat, catIdx) => {
            adicionarCategoriaGrupo(cat, catIdx);
        });
    } else {
        adicionarCategoriaGrupo();
    }

    document.getElementById('modal-grupo-contas').classList.add('show');
}

function fecharModalGrupoContas() {
    document.getElementById('modal-grupo-contas').classList.remove('show');
}

function adicionarCategoriaGrupo(categoria = null, catIdx = null) {
    const container = document.getElementById('categorias-grupo-container');
    const novoIdx = container.children.length;
    const html = `
        <div class="categoria-grupo-item" style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--color-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <input type="text" class="categoria-nome" placeholder="Nome da Conta" value="${categoria ? categoria.nome : ''}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px; margin-right: 0.5rem;">
                <button type="button" class="btn-icon" onclick="this.parentElement.parentElement.remove()" title="Remover">🗑️</button>
            </div>
            <div class="descricoes-categoria" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                ${categoria ? categoria.descricoes.map((desc, descIdx) => `
                    <div style="background: #f0f4ff; padding: 0.5rem 1rem; border-radius: 4px; display: flex; align-items: center; gap: 0.5rem;">
                        <span>${desc}</span>
                        <button type="button" class="btn-icon" style="margin: 0; font-size: 0.9rem;" onclick="this.parentElement.remove()" title="Remover">✕</button>
                    </div>
                `).join('') : ''}
            </div>
            <button type="button" class="btn-secondary" style="width: 100%; padding: 0.5rem;" onclick="adicionarDescricaoGrupo(this)">+ Descrição</button>
        </div>
    `;
    container.innerHTML += html;
}

function adicionarDescricaoGrupo(btn) {
    const descricao = prompt('Digite a descrição:');
    if (descricao) {
        const container = btn.parentElement.querySelector('.descricoes-categoria');
        const html = `
            <div style="background: #f0f4ff; padding: 0.5rem 1rem; border-radius: 4px; display: flex; align-items: center; gap: 0.5rem;">
                <span>${descricao}</span>
                <button type="button" class="btn-icon" style="margin: 0; font-size: 0.9rem;" onclick="this.parentElement.remove()" title="Remover">✕</button>
            </div>
        `;
        container.innerHTML += html;
    }
}

document.getElementById('form-grupo-contas').addEventListener('submit', function(e) {
    e.preventDefault();

    const idx = document.getElementById('grupo-id').value;
    const nome = document.getElementById('grupo-nome').value;
    const descricao = document.getElementById('grupo-descricao').value;

    const contas = Array.from(document.querySelectorAll('.categoria-grupo-item')).map(item => {
        const nomeCat = item.querySelector('.categoria-nome').value;
        const descricoes = Array.from(item.querySelectorAll('.descricoes-categoria > div')).map(d => d.textContent.trim().replace('✕', '').trim());
        return { nome: nomeCat, descricoes };
    });

    const dados = { nome, descricao, contas };

    if (idx !== '') {
        appData.planoContas[parseInt(idx)] = { ...appData.planoContas[parseInt(idx)], ...dados };
        registrarHistorico('EDIÇÃO', `Plano de Contas: ${nome}`);
    } else {
        const novoId = Math.max(...appData.planoContas.map(p => p.id), 0) + 1;
        appData.planoContas.push({ id: novoId, ...dados });
        registrarHistorico('INSERÇÃO', `Plano de Contas: ${nome}`);
    }

    fecharModalGrupoContas();
    renderizarPlanoContas();
    renderizarOrcamentos();
    salvarDados();
});

function excluirGrupoContas(idx) {
    if (confirm('Tem certeza que deseja excluir este grupo?')) {
        appData.planoContas.splice(idx, 1);
        registrarHistorico('EXCLUSÃO', `Grupo de Contas removido`);
        renderizarPlanoContas();
        renderizarOrcamentos();
        salvarDados();
    }
}

function editarCategoriaContas(grupoIdx, catIdx) {
    const grupo = appData.planoContas[grupoIdx];
    const categoria = (grupo.contas || grupo.categorias || [])[catIdx];

    document.getElementById('categoria-grupo-id').value = grupoIdx;
    document.getElementById('categoria-index').value = catIdx;
    document.getElementById('categoria-nome').value = categoria.nome;

    const container = document.getElementById('descricoes-categoria-container');
    container.innerHTML = categoria.descricoes.map((desc, idx) => `
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" class="descricao-item" value="${desc}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px;">
            <button type="button" class="btn-icon" onclick="this.parentElement.remove()" title="Remover">🗑️</button>
        </div>
    `).join('');

    document.getElementById('modal-categoria-contas').classList.add('show');
}

function fecharModalCategoriaContas() {
    document.getElementById('modal-categoria-contas').classList.remove('show');
}

function adicionarDescricaoCategoria() {
    const container = document.getElementById('descricoes-categoria-container');
    const html = `
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" class="descricao-item" placeholder="Nova descrição" style="flex: 1; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px;">
            <button type="button" class="btn-icon" onclick="this.parentElement.remove()" title="Remover">🗑️</button>
        </div>
    `;
    container.innerHTML += html;
}

document.getElementById('form-categoria-contas').addEventListener('submit', function(e) {
    e.preventDefault();

    const grupoIdx = parseInt(document.getElementById('categoria-grupo-id').value);
    const catIdx = parseInt(document.getElementById('categoria-index').value);
    const nome = document.getElementById('categoria-nome').value;
    const descricoes = Array.from(document.querySelectorAll('.descricao-item')).map(input => input.value.trim()).filter(v => v);

    if (!appData.planoContas[grupoIdx].contas) appData.planoContas[grupoIdx].contas = appData.planoContas[grupoIdx].categorias || [];
    appData.planoContas[grupoIdx].contas[catIdx] = { nome, descricoes };

    registrarHistorico('EDIÇÃO', `Categoria: ${nome}`);
    fecharModalCategoriaContas();
    renderizarPlanoContas();
    renderizarOrcamentos();
    salvarDados();
});