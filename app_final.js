// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
const appData = {
    tipificacoes: [
        { id: 1, nome: 'Aplicação financeira' },
        { id: 2, nome: 'Assistência' },
        { id: 3, nome: 'Conta Corrente' },
        { id: 4, nome: 'Depósito Irmão' },
        { id: 5, nome: 'Despesas Fixas' },
        { id: 6, nome: 'Despesas Variáveis' },
        { id: 7, nome: 'Festas e Eventos' },
        { id: 8, nome: 'Tronco de Beneficência' }
    ],
    lancamentos: [],
    eventos: [], // Prestação de Contas
    historico: []
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica autenticação (depende do usuario.js)
    if (typeof estaAutenticado === 'function' && !estaAutenticado()) { 
        if(typeof redirecionarParaLogin === 'function') redirecionarParaLogin(); 
        return; 
    }
    
    const usuario = typeof obterUsuarioAtual === 'function' ? obterUsuarioAtual() : null;
    document.getElementById('user-name').textContent = usuario ? `Olá, ${usuario.nome}` : 'Usuário Admin';

    configurarNavegacao();
    configurarFormularios();
    
    // Renderizações Iniciais
    renderizarTipificacoes();
    atualizarSelectTipificacoes();
    renderizarLancamentos();
    renderizarHistorico();
    atualizarDashboardPremium();
    renderizarEventos();
    inicializarControle(); // Inicializa a tela de Relatórios

    const btnLogout = document.getElementById('logout-btn');
    if(btnLogout) btnLogout.addEventListener('click', typeof logout === 'function' ? logout : () => console.log('Logout'));
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
// MÓDULO: CONFIGURAÇÕES (Categoria)
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
}

function excluirTipificacao(id) {
    if (confirm('Tem certeza que deseja excluir esta Categoria?')) {
        appData.tipificacoes = appData.tipificacoes.filter(t => t.id !== id);
        renderizarTipificacoes();
    }
}

function atualizarSelectTipificacoes() {
    const options = '<option value="">Selecione...</option>' + appData.tipificacoes.map(t => `<option value="${t.nome}">${t.nome}</option>`).join('');
    document.getElementById('lancamento-tipificacao').innerHTML = options;
    document.getElementById('evento-tipificacao').innerHTML = options;
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
    aplicarFiltrosControle(); // Atualiza relatórios
    
    // Se o modal de evento estiver aberto, atualiza a lista de vínculos
    if(document.getElementById('modal-evento').classList.contains('show')) {
        carregarLancamentosParaVinculo();
    }
}

function excluirLancamento(id) {
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
        const lanc = appData.lancamentos.find(l => l.id === id);
        appData.lancamentos = appData.lancamentos.filter(l => l.id !== id);
        
        // Remove o vínculo deste lançamento de qualquer evento
        appData.eventos.forEach(ev => {
            ev.lancamentosVinculados = ev.lancamentosVinculados.filter(vId => vId !== id);
        });

        registrarHistorico('EXCLUSÃO', `${lanc.tipo} | R$ ${lanc.valor.toFixed(2)} | ${lanc.historico}`);
        renderizarLancamentos();
        atualizarDashboardPremium();
        aplicarFiltrosControle();
        renderizarEventos();
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
}

function excluirEvento(id) {
    if (confirm('Excluir este evento de prestação de contas? Os lançamentos não serão apagados, apenas desvinculados.')) {
        const ev = appData.eventos.find(e => e.id === id);
        appData.eventos = appData.eventos.filter(e => e.id !== id);
        registrarHistorico('EXCLUSÃO', `Evento: ${ev.nome}`);
        renderizarEventos();
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
                <small class="text-muted">Lançamentos vinculados: ${ev.lancamentosVinculados.length}</small>
            </div>
        </div>
    `}).join('');
}

// ==========================================
// MÓDULO: DASHBOARD PREMIUM
// ==========================================
let graficoDashboard = null;

function atualizarDashboardPremium() {
    let receitas = 0, despesas = 0, maiorDespesa = 0;
    
    // Filtro para o mês atual
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();

    appData.lancamentos.forEach(l => {
        const dataLanc = new Date(l.data);
        // Ajuste de fuso horário para garantir o mês correto
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

    // 1. Gráfico de Evolução Diária
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

    // 2. Gráfico de Composição por Categoria
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