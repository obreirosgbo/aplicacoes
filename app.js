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

// Função para carregar dados ou gerar MOCK
function carregarDados() {
    const dadosSalvos = localStorage.getItem('erp_financeiro_data');
    
    if (dadosSalvos) {
        appData = JSON.parse(dadosSalvos);
    } else {
        // GERANDO DADOS SIMULADOS PARA APRESENTAÇÃO
        appData.tipificacoes = [
            { id: 1, nome: 'Festas e Eventos' },
            { id: 2, nome: 'Assistência Social' },
            { id: 3, nome: 'Despesas Fixas' },
            { id: 4, nome: 'Doações' }
        ];

        appData.lancamentos = [
            { id: 101, data: '2025-10-10', tipo: 'RECEITA', tipificacao: 'Festas e Eventos', historico: 'Venda de Ingressos', descricao: 'Lote 1 - Jantar', valor: 5000.00 },
            { id: 102, data: '2025-10-12', tipo: 'DESPESA', tipificacao: 'Festas e Eventos', historico: 'Pagamento Buffet', descricao: 'Sinal de 50%', valor: 2000.00 },
            { id: 103, data: '2025-10-15', tipo: 'DESPESA', tipificacao: 'Festas e Eventos', historico: 'Decoração', descricao: 'Flores e toalhas', valor: 800.00 },
            { id: 104, data: '2025-11-05', tipo: 'RECEITA', tipificacao: 'Doações', historico: 'Campanha do Agasalho', descricao: 'Arrecadação PIX', valor: 3500.00 },
            { id: 105, data: '2025-11-10', tipo: 'DESPESA', tipificacao: 'Assistência Social', historico: 'Compra Cestas Básicas', descricao: 'Atacadão', valor: 3000.00 },
            { id: 106, data: '2025-11-15', tipo: 'DESPESA', tipificacao: 'Despesas Fixas', historico: 'Conta de Luz', descricao: 'Enel', valor: 450.00 },
            { id: 107, data: '2025-12-01', tipo: 'RECEITA', tipificacao: 'Doações', historico: 'Doação Anônima', descricao: 'Transferência Bancária', valor: 2000.00 },
            { id: 108, data: '2025-12-05', tipo: 'DESPESA', tipificacao: 'Despesas Fixas', historico: 'Aluguel Sala', descricao: 'Dezembro', valor: 1500.00 }
        ];

        appData.eventos = [
            {
                id: 1,
                nome: 'Jantar Beneficente de Outubro',
                tipificacao: 'Festas e Eventos',
                informacoes: 'Evento realizado para arrecadação de fundos para a reforma do telhado. Contou com a presença de 150 pessoas.',
                lancamentosVinculados: [101, 102, 103],
                dataCriacao: '2025-10-01T10:00:00.000Z'
            },
            {
                id: 2,
                nome: 'Ação Solidária de Novembro',
                tipificacao: 'Assistência Social',
                informacoes: 'Distribuição de cestas básicas para 50 famílias cadastradas na comunidade.',
                lancamentosVinculados: [104, 105],
                dataCriacao: '2025-11-01T10:00:00.000Z'
            }
        ];

        appData.historico = [
            { dataHora: new Date().toLocaleString('pt-BR'), acao: 'SISTEMA', detalhes: 'Geração de dados simulados', usuario: 'Admin' }
        ];

      appData.irmaos = []; // Adicione esta linha
        salvarDados();
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Aguarda inicializarUsuario() concluir (promise real, sem setTimeout)
    if (typeof aguardarInicializacao === 'function') {
        await aguardarInicializacao();
    }

    const perfil = typeof obterPerfilAtual === 'function' ? obterPerfilAtual() : null;
    if (!perfil || perfil.role !== 'admin') return; // guard extra: só admin continua

    carregarDados();

    const nomeEl = document.getElementById('user-name');
    if (nomeEl) nomeEl.textContent = perfil ? `Olá, ${perfil.nome}` : 'Admin';

    configurarNavegacao();
    configurarFormularios();

    renderizarTipificacoes();
    renderizarIrmaos();
    atualizarSelectTipificacoes();
    renderizarLancamentos();
    renderizarHistorico();
    atualizarDashboardPremium();
    renderizarEventos();
    inicializarControle();
    carregarControleAcessos();

    document.getElementById('logout-btn').addEventListener('click', () => logout());
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
    renderizarGraficosAdicionaisDashboard(); // ADICIONE ESTA LINHA

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
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    const statusLabel = {
        pending:  '<span class="status-badge status-pending">🟡 Pendente</span>',
        approved: '<span class="status-badge status-approved">✅ Aprovado</span>',
        rejected: '<span class="status-badge status-rejected">❌ Rejeitado</span>'
    };

    tbody.innerHTML = usuarios.map(u => {
        let acoes = '';
        if (u.status === 'pending') {
            acoes = `
                <button class="btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="atualizarAcesso('${u.id}','approved')">✔ Aprovar</button>
                <button class="btn-secondary" style="padding:0.3rem 0.8rem;font-size:0.8rem;margin-left:4px;" onclick="atualizarAcesso('${u.id}','rejected')">✘ Rejeitar</button>
            `;
        } else if (u.status === 'approved') {
            acoes = `<button class="btn-secondary" style="padding:0.3rem 0.8rem;font-size:0.8rem;" onclick="atualizarAcesso('${u.id}','rejected')">🚫 Revogar</button>`;
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
                <td>${acoes}</td>
            </tr>
        `;
    }).join('');
}

async function atualizarAcesso(userId, novoStatus) {
    const labels = { approved: 'aprovado', rejected: 'rejeitado/revogado' };
    if (!confirm(`Confirma marcar este acesso como ${labels[novoStatus] || novoStatus}?`)) return;

    try {
        await supabaseUpdateProfileStatus(userId, novoStatus);
        await carregarControleAcessos();
        registrarHistorico('ACESSO', `Acesso ${novoStatus} para usuário ID ${userId}`);
    } catch (erro) {
        alert('Erro ao atualizar acesso: ' + erro.message);
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
}