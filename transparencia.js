//
// PORTAL DE TRANSPARÊNCIA - LÓGICA COMPLETA
//

let dadosPublicos = {
    lancamentos: [],
    eventos: []
};

// Gráficos para transparência
let chartTransparenciaEvolucao = null;
let chartTransparenciaComposicao = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Guard de autenticação: aguarda usuario.js resolver a sessão
    await new Promise(r => setTimeout(r, 400));

    const perfil = typeof obterPerfilAtual === 'function' ? obterPerfilAtual() : null;
    if (!perfil || perfil.role !== 'user' || perfil.status !== 'approved') {
        // usuario.js já redireciona — esta linha é fallback
        window.location.href = 'login.html';
        return;
    }

    // Exibir nome do usuário no header, se existir
    const heroEl = document.querySelector('.hero-section p');
    if (heroEl && perfil.nome) {
        heroEl.insertAdjacentHTML('afterend',
            `<p style="margin-top:0.5rem;opacity:0.8;font-size:0.95rem;">Olá, <strong>${perfil.nome}</strong> &nbsp;|&nbsp; <a href="login.html" onclick="logout();return false;" style="color:white;text-decoration:underline;">Sair</a></p>`
        );
    }

    console.log('[TRANSPARÊNCIA] Iniciando carregamento de dados...');
    carregarDadosDoERP();
    renderizarEventosPublicos();
    renderizarLancamentosPublicos(dadosPublicos.lancamentos);
    
    // Inicializar listeners dos formulários
    const formGerarPrestacao = document.getElementById('form-gerar-prestacao-transparencia');
    if (formGerarPrestacao) {
        formGerarPrestacao.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const dataInicio = document.getElementById('prestacao-transparencia-data-inicio').value;
            const dataFim = document.getElementById('prestacao-transparencia-data-fim').value;
            
            if (!dataInicio || !dataFim) {
                alert('Selecione o período completo.');
                return;
            }
            
            if (dataInicio > dataFim) {
                alert('A data inicial não pode ser maior que a data final.');
                return;
            }
            
            gerarRelatorioPrestacaoTransparencia(dataInicio, dataFim);
            fecharModalGerarPrestacaoTransparencia();
        });
    }
});

function mudarAba(abaId, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`sec-${abaId}`).classList.add('active');
}

// 
// CARREGAMENTO DE DADOS DO ERP
// 
function carregarDadosDoERP() {
    console.log('[TRANSPARÊNCIA] Tentando carregar dados do localStorage...');
    
    const dadosSalvos = localStorage.getItem('erp_financeiro_data');
    
    if (dadosSalvos) {
        try {
            const erpData = JSON.parse(dadosSalvos);
            dadosPublicos.lancamentos = erpData.lancamentos || [];
            dadosPublicos.eventos = erpData.eventos || [];
            
            console.log('[TRANSPARÊNCIA] ✅ Dados carregados com sucesso!');
            console.log('[TRANSPARÊNCIA] Lançamentos:', dadosPublicos.lancamentos.length);
            console.log('[TRANSPARÊNCIA] Eventos:', dadosPublicos.eventos.length);
            
            // Se não houver dados, gerar dados de demonstração
            if (dadosPublicos.lancamentos.length === 0) {
                console.log('[TRANSPARÊNCIA] Nenhum lançamento encontrado. Gerando dados de demonstração...');
                gerarDadosDemonstracao();
            }
        } catch (erro) {
            console.error('[TRANSPARÊNCIA] Erro ao parsear dados:', erro);
            gerarDadosDemonstracao();
        }
    } else {
        console.warn('[TRANSPARÊNCIA] ⚠️ Nenhum dado encontrado no localStorage!');
        console.log('[TRANSPARÊNCIA] Gerando dados de demonstração...');
        gerarDadosDemonstracao();
    }
}

// 
// DADOS DE DEMONSTRAÇÃO (Fallback)
// 
function gerarDadosDemonstracao() {
    dadosPublicos.lancamentos = [
        { id: 101, data: '2025-10-10', tipo: 'RECEITA', tipificacao: 'Festas e Eventos', historico: 'Venda de Ingressos', descricao: 'Lote 1 - Jantar', valor: 5000.00 },
        { id: 102, data: '2025-10-12', tipo: 'DESPESA', tipificacao: 'Festas e Eventos', historico: 'Pagamento Buffet', descricao: 'Sinal de 50%', valor: 2000.00 },
        { id: 103, data: '2025-10-15', tipo: 'DESPESA', tipificacao: 'Festas e Eventos', historico: 'Decoração', descricao: 'Flores e toalhas', valor: 800.00 },
        { id: 104, data: '2025-11-05', tipo: 'RECEITA', tipificacao: 'Doações', historico: 'Campanha do Agasalho', descricao: 'Arrecadação PIX', valor: 3500.00 },
        { id: 105, data: '2025-11-10', tipo: 'DESPESA', tipificacao: 'Assistência Social', historico: 'Compra Cestas Básicas', descricao: 'Atacadão', valor: 3000.00 },
        { id: 106, data: '2025-11-15', tipo: 'DESPESA', tipificacao: 'Despesas Fixas', historico: 'Conta de Luz', descricao: 'Enel', valor: 450.00 }
    ];

    dadosPublicos.eventos = [
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

    console.log('[TRANSPARÊNCIA] ✅ Dados de demonstração gerados!');
}

// 
// RENDERIZAÇÃO DE EVENTOS
// 
function renderizarEventosPublicos() {
    const grid = document.getElementById('public-eventos-grid');
    
    if (!grid) {
        console.error('[TRANSPARÊNCIA] Elemento public-eventos-grid não encontrado!');
        return;
    }

    if (dadosPublicos.eventos.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width: 100%; padding: 2rem; grid-column: 1/-1;">Nenhuma prestação de contas disponível no momento.</p>';
        return;
    }

    grid.innerHTML = dadosPublicos.eventos.map(ev => {
        let rec = 0, desp = 0;
        ev.lancamentosVinculados.forEach(idLanc => {
            const l = dadosPublicos.lancamentos.find(x => x.id === idLanc);
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
                    <span class="badge badge-info">${ev.tipificacao}</span>
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
                <button class="btn-detalhes" onclick="abrirDetalhesEvento(${ev.id})">🔍 Ver Lançamentos</button>
            </div>
        </div>
        `;
    }).join('');
}

// 
// MODAL DE DETALHES DO EVENTO
// 
function abrirDetalhesEvento(eventoId) {
    const evento = dadosPublicos.eventos.find(e => e.id === eventoId);
    if (!evento) return;

    document.getElementById('detalhes-evento-titulo').textContent = `Lançamentos: ${evento.nome}`;
    const tbody = document.getElementById('detalhes-evento-body');
    
    const lancamentosDoEvento = evento.lancamentosVinculados
        .map(id => dadosPublicos.lancamentos.find(l => l.id === id))
        .filter(l => l !== undefined);

    if (lancamentosDoEvento.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum lançamento vinculado.</td></tr>';
    } else {
        lancamentosDoEvento.sort((a, b) => new Date(a.data) - new Date(b.data));
        
        tbody.innerHTML = lancamentosDoEvento.map(l => `
            <tr>
                <td>${formatarData(l.data)}</td>
                <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
                <td>
                    <strong>${l.historico}</strong><br>
                    <small class="text-muted">${l.descricao || ''}</small>
                </td>
                <td><strong>${formatarMoeda(l.valor)}</strong></td>
            </tr>
        `).join('');
    }

    document.getElementById('modal-detalhes-evento').classList.add('show');
}

function fecharModalDetalhes() {
    document.getElementById('modal-detalhes-evento').classList.remove('show');
}

// 
// RENDERIZAÇÃO E FILTROS DE LANÇAMENTOS
// 
function renderizarLancamentosPublicos(dados) {
    const tbody = document.getElementById('public-lancamentos-body');
    
    if (!tbody) {
        console.error('[TRANSPARÊNCIA] Elemento public-lancamentos-body não encontrado!');
        return;
    }

    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhum lançamento encontrado.</td></tr>';
        return;
    }
    
    const ordenados = [...dados].sort((a, b) => new Date(b.data) - new Date(a.data));

    tbody.innerHTML = ordenados.map(l => `
        <tr>
            <td>${formatarData(l.data)}</td>
            <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
            <td>${l.tipificacao}</td>
            <td><strong>${l.historico}</strong> - ${l.descricao || ''}</td>
            <td><strong>${formatarMoeda(l.valor)}</strong></td>
        </tr>
    `).join('');
}

function filtrarLancamentosPublicos() {
    const mesAno = document.getElementById('pub-filtro-mes').value;
    const tipo = document.getElementById('pub-filtro-tipo').value;
    let filtrados = [...dadosPublicos.lancamentos];

    if (mesAno) filtrados = filtrados.filter(l => l.data.startsWith(mesAno));
    if (tipo) filtrados = filtrados.filter(l => l.tipo === tipo);

    renderizarLancamentosPublicos(filtrados);
}

function limparFiltrosPublicos() {
    document.getElementById('pub-filtro-mes').value = '';
    document.getElementById('pub-filtro-tipo').value = '';
    renderizarLancamentosPublicos(dadosPublicos.lancamentos);
}

function exportarPublicoCSV() {
    const tbody = document.getElementById('public-lancamentos-body');
    const linhas = tbody.querySelectorAll('tr');
    
    if (linhas.length === 0 || linhas[0].cells.length === 1) {
        alert('Não há dados para exportar.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data;Tipo;Categoria;Descricao;Valor\n";

    linhas.forEach(row => {
        const cols = row.querySelectorAll('td');
        const data = cols[0].innerText;
        const tipo = cols[1].innerText;
        const categoria = cols[2].innerText;
        const descricao = cols[3].innerText.replace(/;/g, ""); 
        const valor = cols[4].innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        
        csvContent += `${data};${tipo};${categoria};${descricao};${valor}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "extrato_transparencia.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 
// GERAÇÃO DE PRESTAÇÃO DE CONTAS (TRANSPARÊNCIA)
// 
function abrirModalGerarPrestacaoTransparencia() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    document.getElementById('prestacao-transparencia-data-inicio').valueAsDate = primeiroDia;
    document.getElementById('prestacao-transparencia-data-fim').valueAsDate = hoje;
    
    document.getElementById('modal-gerar-prestacao-transparencia').classList.add('show');
}

function fecharModalGerarPrestacaoTransparencia() {
    document.getElementById('modal-gerar-prestacao-transparencia').classList.remove('show');
}

function fecharModalRelatorioPrestacaoTransparencia() {
    document.getElementById('modal-relatorio-prestacao-transparencia').classList.remove('show');
}

function gerarRelatorioPrestacaoTransparencia(dataInicio, dataFim) {
    const lancamentosPeriodo = dadosPublicos.lancamentos.filter(l => l.data >= dataInicio && l.data <= dataFim);
    
    const lancamentosVinculados = [];
    const lancamentosNaoVinculados = [];
    const eventosComLancamentos = [];
    
    lancamentosPeriodo.forEach(lanc => {
        let encontrado = false;
        dadosPublicos.eventos.forEach(evento => {
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
    
    let receitas = 0, despesas = 0;
    lancamentosPeriodo.forEach(l => {
        if (l.tipo === 'RECEITA') receitas += l.valor;
        if (l.tipo === 'DESPESA') despesas += l.valor;
    });
    
    const resultado = receitas - despesas;
    
    document.getElementById('relatorio-transparencia-titulo').textContent = `Prestação de Contas: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
    document.getElementById('relatorio-transparencia-periodo').textContent = `De ${formatarData(dataInicio)} a ${formatarData(dataFim)} (${lancamentosPeriodo.length} lançamentos)`;
    document.getElementById('relatorio-transparencia-receitas').textContent = formatarMoeda(receitas);
    document.getElementById('relatorio-transparencia-despesas').textContent = formatarMoeda(despesas);
    
    const elResultado = document.getElementById('relatorio-transparencia-resultado');
    elResultado.textContent = formatarMoeda(resultado);
    elResultado.className = resultado >= 0 ? 'resumo-valor text-success' : 'resumo-valor text-danger';
    
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
    
    document.getElementById('relatorio-transparencia-eventos').innerHTML = eventosHtml || '<p class="text-muted">Nenhum evento vinculado neste período.</p>';
    
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
    
    document.getElementById('relatorio-transparencia-lancamentos-body').innerHTML = lancamentosNaoVinculadosHtml;
    
    renderizarGraficosTransparencia(lancamentosPeriodo);
    
    document.getElementById('modal-relatorio-prestacao-transparencia').classList.add('show');
}

function renderizarGraficosTransparencia(lancamentos) {
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

    const ctxEvolucao = document.getElementById('chart-transparencia-evolucao');
    if (ctxEvolucao) {
        if (chartTransparenciaEvolucao) chartTransparenciaEvolucao.destroy();
        chartTransparenciaEvolucao = new Chart(ctxEvolucao, {
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

    const tipificacoesLabels = [...new Set(lancamentos.map(l => l.tipificacao))];
    const valoresPorTip = tipificacoesLabels.map(t => 
        lancamentos.filter(l => l.tipificacao === t).reduce((acc, curr) => acc + curr.valor, 0)
    );

    const ctxComposicao = document.getElementById('chart-transparencia-composicao');
    if (ctxComposicao) {
        if (chartTransparenciaComposicao) chartTransparenciaComposicao.destroy();
        chartTransparenciaComposicao = new Chart(ctxComposicao, {
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

function imprimirRelatorioPrestacaoTransparencia() {
    window.print();
}

function exportarRelatorioPrestacaoTransparenciaCSV() {
    const titulo = document.getElementById('relatorio-transparencia-titulo').textContent;
    const tbody = document.getElementById('relatorio-transparencia-lancamentos-body');
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
// UTILITÁRIOS
// 
function formatarMoeda(valor) { 
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor); 
}

function formatarData(dataString) {
    const data = new Date(dataString);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return data.toLocaleDateString('pt-BR');
}