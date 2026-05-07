// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
let appData = {
    tipificacoes: [],
    lancamentos: [],
    eventos: [],
    historico: [],
    irmaos: [],
    planoContas: [],
    orcamentos: []
};

// salvarDados mantido como no-op — persistência migrada para Supabase
function salvarDados() {}

async function carregarDados() {
    const [
        { data: lancs,   error: eLanc },
        { data: evs,     error: eEv   },
        { data: evLinks, error: eEl   },
        { data: irms,    error: eIrm  }
    ] = await Promise.all([
        supabaseClient.from('lancamentos').select('*').order('data', { ascending: false }),
        supabaseClient.from('eventos').select('*').order('data_criacao', { ascending: false }),
        supabaseClient.from('evento_lancamentos').select('evento_id, lancamento_id'),
        supabaseClient.from('irmaos').select('*').order('nome')
    ]);

    if (eLanc) console.error('Erro lancamentos:', eLanc);
    if (eEv)   console.error('Erro eventos:', eEv);
    if (eEl)   console.error('Erro evento_lancamentos:', eEl);
    if (eIrm)  console.error('Erro irmaos:', eIrm);

    // Normaliza lançamentos: tipificacao = conta_nome no DB
    appData.lancamentos = (lancs || []).map(l => ({
        ...l,
        tipificacao: l.tipificacao || l.conta_nome || ''
    }));

    // Monta eventos com lista de ids de lançamentos vinculados
    const linksMap = {};
    (evLinks || []).forEach(el => {
        if (!linksMap[el.evento_id]) linksMap[el.evento_id] = [];
        linksMap[el.evento_id].push(el.lancamento_id);
    });
    appData.eventos = (evs || []).map(ev => ({
        ...ev,
        dataCriacao: ev.data_criacao,
        contasSelecionadas: ev.contas_selecionadas || [],
        lancamentosVinculados: linksMap[ev.id] || []
    }));

    appData.irmaos = irms || [];
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

    // Configura formulários
    document.getElementById('form-lancamento').addEventListener('submit', salvarLancamento);
    document.getElementById('form-evento').addEventListener('submit', salvarEvento);

    // Carrega todos os dados do Supabase
    await carregarPlanoContasSupabase();
    await carregarDados();

    renderizarIrmaos();
    atualizarSelectTipificacoes();
    renderizarLancamentos();
    renderizarEventos();
    inicializarControle();
    await carregarOrcamento(); // dispara setDashPeriodo('anual') ao final
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

            if (pageId === 'historico') carregarEExibirHistorico();
            if (pageId === 'dashboard') {
                // Inicializa o ano com o mais recente disponível (ou ano atual)
                const anosDisponiveis = orcExerciciosDisponiveis.length > 0
                    ? orcExerciciosDisponiveis
                    : [new Date().getFullYear()];
                dashAno = anosDisponiveis[anosDisponiveis.length - 1];
                // Garante que orcValores está carregado para o ano do dashboard
                trocarExercicio(dashAno).then(() => setDashPeriodo('anual'));
            }
        });
    });
}


function atualizarSelectTipificacoes() {
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
    document.getElementById('lancamento-nota-atual').style.display = 'none';

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
        if (lanc.nota_fiscal_url) {
            const el = document.getElementById('lancamento-nota-atual');
            el.style.display = 'flex';
            document.getElementById('lancamento-nota-link').href = lanc.nota_fiscal_url;
        }
    } else {
        document.getElementById('lancamento-data').valueAsDate = new Date();
    }
    document.getElementById('modal-lancamento').classList.add('show');
}

function fecharModalLancamento() {
    document.getElementById('modal-lancamento').classList.remove('show');
}

async function uploadNotaFiscal(arquivo, lancamentoId) {
    const ext = arquivo.name.split('.').pop();
    const caminho = `${lancamentoId}_${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage
        .from('notas-fiscais')
        .upload(caminho, arquivo, { upsert: true });
    if (error) { alert('Erro ao enviar nota fiscal: ' + error.message); return null; }
    const { data } = supabaseClient.storage.from('notas-fiscais').getPublicUrl(caminho);
    return data.publicUrl;
}

function abrirModalNotaFiscal(url) {
    const body = document.getElementById('modal-nota-fiscal-body');
    document.getElementById('modal-nota-fiscal-download').href = url;
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
        body.innerHTML = `<img src="${url}" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:4px;">`;
    } else {
        body.innerHTML = `<iframe src="${url}" style="width:100%; height:70vh; border:none;"></iframe>`;
    }
    document.getElementById('modal-nota-fiscal').classList.add('show');
}

function fecharModalNotaFiscal() {
    document.getElementById('modal-nota-fiscal').classList.remove('show');
    document.getElementById('modal-nota-fiscal-body').innerHTML = '';
}

async function removerNotaFiscal() {
    const id = document.getElementById('lancamento-id').value;
    if (!id) return;
    const lanc = appData.lancamentos.find(l => l.id == id);
    if (!lanc?.nota_fiscal_url) return;
    // Extrai o caminho do arquivo da URL pública
    const caminho = lanc.nota_fiscal_url.split('/notas-fiscais/')[1];
    if (caminho) {
        supabaseClient.storage.from('notas-fiscais').remove([caminho]);
    }
    lanc.nota_fiscal_url = null;
    await supabaseClient.from('lancamentos').update({ nota_fiscal_url: null }).eq('id', id);
    document.getElementById('lancamento-nota-atual').style.display = 'none';
    renderizarLancamentos();
}

async function salvarLancamento(e) {
    e.preventDefault();
    const id = document.getElementById('lancamento-id').value;
    const tipificacao = document.getElementById('lancamento-tipificacao').value;
    const payload = {
        tipo:       document.getElementById('lancamento-tipo').value,
        tipificacao,
        conta_nome: tipificacao,
        data:       document.getElementById('lancamento-data').value,
        historico:  document.getElementById('lancamento-historico').value,
        descricao:  document.getElementById('lancamento-descricao').value,
        valor:      parseFloat(document.getElementById('lancamento-valor').value)
    };

    // Upload da nota fiscal, se selecionada
    const fileInput = document.getElementById('lancamento-nota-fiscal');
    const arquivo = fileInput.files[0];
    if (arquivo) {
        const url = await uploadNotaFiscal(arquivo, id || Date.now());
        if (url) payload.nota_fiscal_url = url;
    } else if (id) {
        const lancExistente = appData.lancamentos.find(l => l.id == id);
        if (lancExistente?.nota_fiscal_url) payload.nota_fiscal_url = lancExistente.nota_fiscal_url;
    }

    let savedId;
    if (id) {
        const { error } = await supabaseClient.from('lancamentos').update(payload).eq('id', id);
        if (error) { alert('Erro ao salvar lançamento: ' + error.message); return; }
        savedId = parseInt(id);
        registrarHistorico('EDIÇÃO', `${payload.tipo} | R$ ${payload.valor.toFixed(2)} | ${payload.historico}`, 'Lançamentos');
    } else {
        const { data, error } = await supabaseClient.from('lancamentos').insert(payload).select().single();
        if (error) { alert('Erro ao salvar lançamento: ' + error.message); return; }
        savedId = data.id;
        registrarHistorico('INSERÇÃO', `${payload.tipo} | R$ ${payload.valor.toFixed(2)} | ${payload.historico}`, 'Lançamentos');
    }

    // Recarrega lançamentos do banco para manter appData sincronizado
    const { data: lancs } = await supabaseClient.from('lancamentos').select('*').order('data', { ascending: false });
    appData.lancamentos = (lancs || []).map(l => ({ ...l, tipificacao: l.tipificacao || l.conta_nome || '' }));

    fecharModalLancamento();
    renderizarLancamentos();
    atualizarDashboardPremium();
    aplicarFiltrosControle();

    if (document.getElementById('modal-evento').classList.contains('show')) {
        carregarLancamentosParaVinculo();
    }
}

async function excluirLancamento(id) {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
    const lanc = appData.lancamentos.find(l => l.id === id);
    const { error } = await supabaseClient.from('lancamentos').delete().eq('id', id);
    if (error) { alert('Erro ao excluir lançamento: ' + error.message); return; }

    appData.lancamentos = appData.lancamentos.filter(l => l.id !== id);
    appData.eventos.forEach(ev => {
        ev.lancamentosVinculados = ev.lancamentosVinculados.filter(vId => vId !== id);
    });

    registrarHistorico('EXCLUSÃO', `${lanc.tipo} | R$ ${lanc.valor.toFixed(2)} | ${lanc.historico}`, 'Lançamentos');
    renderizarLancamentos();
    atualizarDashboardPremium();
    aplicarFiltrosControle();
    renderizarEventos();
}

function renderizarLancamentos() {
    const tbody = document.getElementById('lancamentos-body');
    if (appData.lancamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 2rem;">Nenhum lançamento encontrado.</td></tr>';
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
            <td>${l.nota_fiscal_url ? `<button class="btn-icon" onclick="abrirModalNotaFiscal('${l.nota_fiscal_url}')" title="Ver nota fiscal">📎</button>` : '<span style="color:#cbd5e1;" title="Sem nota fiscal">—</span>'}</td>
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
    document.getElementById('evento-lancamentos-body').innerHTML = '<tr><td colspan="6" class="text-center">Selecione ao menos uma conta acima.</td></tr>';

    renderizarContasParaEvento([]);

    if (id) {
        const ev = appData.eventos.find(e => e.id === id);
        document.getElementById('evento-id').value = ev.id;
        document.getElementById('evento-nome').value = ev.nome;
        document.getElementById('evento-informacoes').value = ev.informacoes;
        document.getElementById('modal-evento-title').textContent = 'Editar Evento';
        // Suporte a eventos antigos com tipificacao única
        const contasSalvas = ev.contasSelecionadas || (ev.tipificacao ? [ev.tipificacao] : []);
        renderizarContasParaEvento(contasSalvas);
        carregarLancamentosParaVinculo(ev.lancamentosVinculados);
    }
    document.getElementById('modal-evento').classList.add('show');
}

function fecharModalEvento() {
    document.getElementById('modal-evento').classList.remove('show');
}

function renderizarContasParaEvento(selecionadas = []) {
    const container = document.getElementById('evento-contas-lista');
    // Coleta todas as contas únicas dos lançamentos
    const todasContas = [...new Set(appData.lancamentos.map(l => l.tipificacao).filter(Boolean))].sort();
    if (todasContas.length === 0) {
        container.innerHTML = '<span style="font-size:0.82rem;color:#94a3b8;">Nenhuma conta disponível nos lançamentos.</span>';
        return;
    }
    container.innerHTML = todasContas.map(conta => {
        const checked = selecionadas.includes(conta) ? 'checked' : '';
        return `<label style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.82rem;padding:0.3rem 0.6rem;background:white;border:1px solid #e2e8f0;border-radius:20px;cursor:pointer;user-select:none;">
            <input type="checkbox" class="chk-conta-evento" value="${conta}" ${checked} onchange="carregarLancamentosParaVinculo()">
            ${conta}
        </label>`;
    }).join('');
}

function getContasSelecionadasEvento() {
    return Array.from(document.querySelectorAll('.chk-conta-evento:checked')).map(c => c.value);
}

function carregarLancamentosParaVinculo(vinculadosPreviamente = []) {
    const contas = getContasSelecionadasEvento();
    const tbody = document.getElementById('evento-lancamentos-body');

    if (contas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Selecione ao menos uma conta acima.</td></tr>';
        return;
    }

    const lancamentosFiltrados = appData.lancamentos
        .filter(l => contas.includes(l.tipificacao))
        .sort((a, b) => new Date(b.data) - new Date(a.data));

    if (lancamentosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum lançamento encontrado nas contas selecionadas.</td></tr>';
        return;
    }

    tbody.innerHTML = lancamentosFiltrados.map(l => {
        const isChecked = vinculadosPreviamente.includes(l.id) ? 'checked' : '';
        return `<tr>
            <td><input type="checkbox" class="chk-vinculo" value="${l.id}" ${isChecked}></td>
            <td>${formatarData(l.data)}</td>
            <td><span class="badge badge-${l.tipo.toLowerCase()}">${l.tipo}</span></td>
            <td style="font-size:0.8rem;color:#64748b;">${l.tipificacao}</td>
            <td>${l.historico}</td>
            <td>${formatarMoeda(l.valor)}</td>
        </tr>`;
    }).join('');
}

function selecionarTodosVinculos(marcar) {
    document.querySelectorAll('.chk-vinculo').forEach(c => c.checked = marcar);
}

async function salvarEvento(e) {
    e.preventDefault();
    const id = document.getElementById('evento-id').value;

    const lancamentosVinculados = Array.from(document.querySelectorAll('.chk-vinculo:checked')).map(chk => parseInt(chk.value));
    const contasSelecionadas = getContasSelecionadasEvento();

    const payload = {
        nome:                document.getElementById('evento-nome').value,
        tipificacao:         contasSelecionadas.join(', '),
        contas_selecionadas: contasSelecionadas,
        informacoes:         document.getElementById('evento-informacoes').value,
    };

    let eventoId;
    if (id) {
        const { error } = await supabaseClient.from('eventos').update(payload).eq('id', id);
        if (error) { alert('Erro ao salvar evento: ' + error.message); return; }
        eventoId = parseInt(id);
        registrarHistorico('EDIÇÃO', `Evento: ${payload.nome}`, 'Prestação de Contas');
    } else {
        const { data, error } = await supabaseClient.from('eventos').insert(payload).select().single();
        if (error) { alert('Erro ao salvar evento: ' + error.message); return; }
        eventoId = data.id;
        registrarHistorico('INSERÇÃO', `Evento: ${payload.nome}`, 'Prestação de Contas');
    }

    // Atualiza vínculos: remove os existentes e insere os novos
    await supabaseClient.from('evento_lancamentos').delete().eq('evento_id', eventoId);
    if (lancamentosVinculados.length > 0) {
        const links = lancamentosVinculados.map(lid => ({ evento_id: eventoId, lancamento_id: lid }));
        const { error } = await supabaseClient.from('evento_lancamentos').insert(links);
        if (error) { alert('Erro ao vincular lançamentos: ' + error.message); return; }
    }

    // Recarrega eventos
    const { data: evs } = await supabaseClient.from('eventos').select('*').order('data_criacao', { ascending: false });
    const { data: evLinks } = await supabaseClient.from('evento_lancamentos').select('evento_id, lancamento_id');
    const linksMap = {};
    (evLinks || []).forEach(el => {
        if (!linksMap[el.evento_id]) linksMap[el.evento_id] = [];
        linksMap[el.evento_id].push(el.lancamento_id);
    });
    appData.eventos = (evs || []).map(ev => ({
        ...ev,
        dataCriacao: ev.data_criacao,
        contasSelecionadas: ev.contas_selecionadas || [],
        lancamentosVinculados: linksMap[ev.id] || []
    }));

    fecharModalEvento();
    renderizarEventos();
}

async function excluirEvento(id) {
    if (!confirm('Excluir este evento? Os lançamentos não serão apagados, apenas desvinculados.')) return;
    const ev = appData.eventos.find(e => e.id === id);
    const { error } = await supabaseClient.from('eventos').delete().eq('id', id);
    if (error) { alert('Erro ao excluir evento: ' + error.message); return; }
    appData.eventos = appData.eventos.filter(e => e.id !== id);
    registrarHistorico('EXCLUSÃO', `Evento: ${ev.nome}`, 'Prestação de Contas');
    renderizarEventos();
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
    renderizarFiltroDashboard();
    atualizarLabelResumoDashboard();
    renderizarOrcadoRealizado();
    atualizarDashboardComFiltro(dashLancamentosFiltrados());
}

function renderizarGraficoDashboard(receitas, despesas) {
    const ctx = document.getElementById('chart-receita-despesa');
    if (!ctx) return;
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
async function registrarHistorico(acao, detalhes, modulo = 'Geral') {
    const perfil = typeof obterPerfilAtual === 'function' ? obterPerfilAtual() : null;
    const usuario_nome = perfil?.nome || 'Administrador';
    const usuario_id   = perfil?.id   || null;

    await supabaseClient.from('historico_auditoria').insert({
        modulo, acao, detalhes, usuario_nome, usuario_id
    });
}

async function limparHistorico() {
    if (!confirm('Deseja apagar todo o histórico? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabaseClient.from('historico_auditoria').delete().neq('id', 0);
    if (error) { alert('Erro ao limpar histórico: ' + error.message); return; }
    await carregarEExibirHistorico();
}

async function carregarEExibirHistorico() {
    const tbody = document.getElementById('historico-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem; text-align:center; color:#94a3b8;">Carregando...</td></tr>`;

    const filtroModulo = document.getElementById('hist-filtro-modulo')?.value || '';
    const filtroAcao   = document.getElementById('hist-filtro-acao')?.value   || '';

    let query = supabaseClient
        .from('historico_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

    if (filtroModulo) query = query.eq('modulo', filtroModulo);
    if (filtroAcao)   query = query.eq('acao', filtroAcao);

    const { data, error } = await query;
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem; text-align:center; color:#dc2626;">Erro ao carregar histórico: ${error.message}</td></tr>`;
        return;
    }

    renderizarHistorico(data || []);
}

function renderizarHistorico(lista) {
    const tbody = document.getElementById('historico-body');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:2rem;">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    const badgeStyles = {
        'INSERÇÃO':  'background:#dcfce7; color:#16a34a;',
        'EDIÇÃO':    'background:#fef9c3; color:#ca8a04;',
        'EXCLUSÃO':  'background:#fee2e2; color:#dc2626;',
        'IMPORTAÇÃO':'background:#dbeafe; color:#2563eb;',
        'ENVIO':     'background:#f3e8ff; color:#7c3aed;',
        'ACESSO':    'background:#f1f5f9; color:#475569;',
    };
    const moduloIcons = {
        'Lançamentos':        '💰',
        'Orçamento':          '📊',
        'Plano de Contas':    '📋',
        'Prestação de Contas':'📄',
        'Irmãos':             '👥',
        'Acessos':            '🔑',
        'Geral':              '⚙️',
    };

    tbody.innerHTML = lista.map(h => {
        const st   = badgeStyles[h.acao] || 'background:#f1f5f9; color:#475569;';
        const icon = moduloIcons[h.modulo] || '•';
        const dataHora = new Date(h.created_at).toLocaleString('pt-BR');
        return `<tr>
            <td style="white-space:nowrap; font-size:0.82rem; color:#64748b;">${dataHora}</td>
            <td style="white-space:nowrap; font-size:0.83rem;">${icon} ${h.modulo || '—'}</td>
            <td><span style="font-size:0.75rem; font-weight:600; padding:0.15rem 0.55rem; border-radius:999px; ${st}">${h.acao}</span></td>
            <td style="font-size:0.85rem;">${h.detalhes}</td>
            <td style="white-space:nowrap; font-size:0.82rem; color:#64748b;">👤 ${h.usuario_nome}</td>
        </tr>`;
    }).join('');
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

// ─── Dashboard period filter state ───────────────────────────────────────────
let dashPeriodo = 'anual';   // 'anual' | 'semestral' | 'trimestral' | 'mensal' | 'intervalo'
let dashSubValor = null;     // number: mes (1-12), trimestre (1-4), semestre (1-2)
let dashDataInicio = null;   // string YYYY-MM-DD (intervalo)
let dashDataFim    = null;   // string YYYY-MM-DD (intervalo)
let dashAno = new Date().getFullYear(); // ano selecionado no dashboard (independente do orçamento)

function atualizarLabelResumoDashboard() {
    const el = document.getElementById('dash-resumo-label');
    if (!el) return;
    const nomeMes = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const labels = {
        anual: `Anual — ${dashAno}`,
        semestral: `S${dashSubValor||1} — ${dashAno}`,
        trimestral: `T${dashSubValor||1} — ${dashAno}`,
        mensal: `${nomeMes[dashSubValor||1]} — ${dashAno}`,
        intervalo: dashDataInicio && dashDataFim ? `${dashDataInicio} a ${dashDataFim}` : `Intervalo`
    };
    el.textContent = labels[dashPeriodo] || '';
}

async function setDashAno(ano) {
    dashAno = +ano;
    // Carrega orcValores do ano selecionado (trocarExercicio já faz isso)
    await trocarExercicio(dashAno);
    renderizarFiltroDashboard();
    renderizarOrcadoRealizado();
    atualizarDashboardComFiltro(dashLancamentosFiltrados());
    atualizarLabelResumoDashboard();
}

function setDashPeriodo(periodo) {
    dashPeriodo = periodo;
    // reset sub-valor sensibly
    const hoje = new Date();
    if (periodo === 'mensal')     dashSubValor = hoje.getMonth() + 1;
    if (periodo === 'trimestral') dashSubValor = Math.ceil((hoje.getMonth() + 1) / 3);
    if (periodo === 'semestral')  dashSubValor = hoje.getMonth() < 6 ? 1 : 2;
    if (periodo === 'anual')      dashSubValor = null;
    if (periodo === 'intervalo')  { dashDataInicio = null; dashDataFim = null; }
    renderizarFiltroDashboard();
    renderizarOrcadoRealizado();
    atualizarDashboardComFiltro(dashLancamentosFiltrados());
    atualizarLabelResumoDashboard();
}

function renderizarFiltroDashboard() {
    const sub = document.getElementById('dash-filtro-sub');
    if (!sub) return;

    // Seletor de ano
    const anoContainer = document.getElementById('dash-filtro-ano');
    if (anoContainer) {
        const anos = orcExerciciosDisponiveis.length > 0
            ? orcExerciciosDisponiveis
            : [dashAno];
        anoContainer.innerHTML = `<select onchange="setDashAno(this.value)" style="font-size:0.78rem;padding:0.25rem 0.4rem;border:1px solid #e2e8f0;border-radius:4px;font-weight:600;color:#1a5f4a;">
            ${anos.map(a => `<option value="${a}" ${dashAno===a?'selected':''}>${a}</option>`).join('')}
        </select>`;
    }

    // Highlight active button
    ['anual','semestral','trimestral','mensal','intervalo'].forEach(p => {
        const btn = document.getElementById('dash-btn-'+p);
        if (!btn) return;
        btn.style.background = p === dashPeriodo ? '#1a5f4a' : 'transparent';
        btn.style.color      = p === dashPeriodo ? 'white'   : '#64748b';
    });
    // Sub-selector
    if (dashPeriodo === 'mensal') {
        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        sub.innerHTML = `<select onchange="dashSubValor=+this.value;renderizarOrcadoRealizado()" style="font-size:0.78rem;padding:0.25rem 0.4rem;border:1px solid #e2e8f0;border-radius:4px;">
            ${meses.map((m,i)=>`<option value="${i+1}" ${dashSubValor===i+1?'selected':''}>${m}</option>`).join('')}
        </select>`;
    } else if (dashPeriodo === 'trimestral') {
        sub.innerHTML = `<select onchange="dashSubValor=+this.value;renderizarOrcadoRealizado()" style="font-size:0.78rem;padding:0.25rem 0.4rem;border:1px solid #e2e8f0;border-radius:4px;">
            ${[1,2,3,4].map(t=>`<option value="${t}" ${dashSubValor===t?'selected':''}>T${t}</option>`).join('')}
        </select>`;
    } else if (dashPeriodo === 'semestral') {
        sub.innerHTML = `<select onchange="dashSubValor=+this.value;renderizarOrcadoRealizado()" style="font-size:0.78rem;padding:0.25rem 0.4rem;border:1px solid #e2e8f0;border-radius:4px;">
            ${[1,2].map(s=>`<option value="${s}" ${dashSubValor===s?'selected':''}>S${s}</option>`).join('')}
        </select>`;
    } else if (dashPeriodo === 'intervalo') {
        sub.innerHTML = `<input type="date" id="dash-orc-inicio" style="font-size:0.78rem;padding:0.25rem 0.4rem;border:1px solid #e2e8f0;border-radius:4px;" value="${dashDataInicio||''}">
            <span style="font-size:0.75rem;color:#94a3b8;">até</span>
            <input type="date" id="dash-orc-fim" style="font-size:0.78rem;padding:0.25rem 0.4rem;border:1px solid #e2e8f0;border-radius:4px;" value="${dashDataFim||''}">
            <button onclick="dashDataInicio=document.getElementById('dash-orc-inicio').value;dashDataFim=document.getElementById('dash-orc-fim').value;renderizarOrcadoRealizado();" style="font-size:0.75rem;padding:0.25rem 0.6rem;background:#1a5f4a;color:white;border:none;border-radius:4px;cursor:pointer;">OK</button>`;
    } else {
        sub.innerHTML = '';
    }
}

// Retorna array de meses [1..12] cobertos pelo filtro atual
// (null = modo intervalo — filtrar por data diretamente)
function dashMesesFiltro() {
    if (dashPeriodo === 'anual')      return [1,2,3,4,5,6,7,8,9,10,11,12];
    if (dashPeriodo === 'mensal')     return [dashSubValor || 1];
    if (dashPeriodo === 'trimestral') { const t = dashSubValor||1; return [(t-1)*3+1,(t-1)*3+2,(t-1)*3+3]; }
    if (dashPeriodo === 'semestral')  { const s = dashSubValor||1; return s===1?[1,2,3,4,5,6]:[7,8,9,10,11,12]; }
    return null; // intervalo: usar datas
}

// Retorna lançamentos filtrados pelo período do dashboard
function dashLancamentosFiltrados() {
    return (appData.lancamentos || []).filter(l => {
        const d = new Date(l.data);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        if (d.getFullYear() !== dashAno) return false;
        if (dashPeriodo === 'intervalo') {
            if (dashDataInicio && l.data < dashDataInicio) return false;
            if (dashDataFim    && l.data > dashDataFim)    return false;
            return true;
        }
        const meses = dashMesesFiltro();
        return !meses || meses.includes(d.getMonth() + 1);
    });
}

function renderizarOrcadoRealizado() {
    if (!appData.planoContas || appData.planoContas.length === 0) return;

    const M = [1,2,3,4,5,6,7,8,9,10,11,12];
    const receitas = appData.planoContas.filter(g => g.nome === 'RECEITA');
    const despesas = appData.planoContas.filter(g => g.nome === 'DESPESA');

    const meses = dashMesesFiltro(); // null = intervalo de datas

    // Orçado — soma os meses relevantes
    const orcRecMes  = m => receitas.reduce((a,g) => a + calcMesGrupo(g, m), 0);
    const orcDesMes  = m => despesas.reduce((a,g) => a + calcMesGrupo(g, m), 0);
    const mesesOrc   = meses || M; // para orçamento, sem filtro de data exata, usa todos
    const orcRecAnual = mesesOrc.reduce((a,m) => a + orcRecMes(m), 0);
    const orcDesAnual = mesesOrc.reduce((a,m) => a + orcDesMes(m), 0);

    // Realizado — filtra lançamentos pelo período
    const realRecMes = Array(13).fill(0);
    const realDesMes = Array(13).fill(0);
    // Para desvio por grupo: acumula por plano_contas_id
    const realPorConta = {};
    (appData.lancamentos || []).forEach(l => {
        const d = new Date(l.data);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        if (d.getFullYear() !== dashAno) return;
        // Filtro de período
        if (dashPeriodo === 'intervalo') {
            if (dashDataInicio && l.data < dashDataInicio) return;
            if (dashDataFim    && l.data > dashDataFim)    return;
        } else {
            const m = d.getMonth() + 1;
            if (meses && !meses.includes(m)) return;
        }
        const m2 = d.getMonth() + 1;
        if (l.tipo === 'RECEITA') realRecMes[m2] += l.valor;
        if (l.tipo === 'DESPESA') realDesMes[m2] += l.valor;
        // por conta
        if (!realPorConta[l.plano_contas_id]) realPorConta[l.plano_contas_id] = { rec: 0, des: 0 };
        if (l.tipo === 'RECEITA') realPorConta[l.plano_contas_id].rec += l.valor;
        if (l.tipo === 'DESPESA') realPorConta[l.plano_contas_id].des += l.valor;
    });
    const realRecAnual = realRecMes.reduce((a,v) => a+v, 0);
    const realDesAnual = realDesMes.reduce((a,v) => a+v, 0);

    const pctRec = orcRecAnual > 0 ? Math.min((realRecAnual / orcRecAnual) * 100, 100) : 0;
    const pctDes = orcDesAnual > 0 ? Math.min((realDesAnual / orcDesAnual) * 100, 100) : 0;
    const desvioRec = realRecAnual - orcRecAnual;
    const desvioDes = realDesAnual - orcDesAnual;
    const resultOrc  = orcRecAnual - orcDesAnual;
    const resultReal = realRecAnual - realDesAnual;
    const resultDesvio = resultReal - resultOrc;

    const el = id => document.getElementById(id);
    const fmv = v => formatarMoeda(Math.abs(v));
    const sign = v => v >= 0 ? '+' : '-';

    // Exercício label
    if (el('dash-exercicio-label')) {
        const labels = { anual:'Anual', semestral:`S${dashSubValor||1}`, trimestral:`T${dashSubValor||1}`, mensal: ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][dashSubValor||1], intervalo:'Intervalo' };
        el('dash-exercicio-label').textContent = `${dashAno} — ${labels[dashPeriodo]||''}`;
    }

    // KPI receitas
    if (el('dash-orc-receitas'))  el('dash-orc-receitas').textContent  = formatarMoeda(orcRecAnual);
    if (el('dash-real-receitas')) el('dash-real-receitas').textContent = formatarMoeda(realRecAnual);
    if (el('dash-bar-receita'))   el('dash-bar-receita').style.width   = pctRec.toFixed(1) + '%';
    if (el('dash-pct-receita'))   el('dash-pct-receita').textContent   = orcRecAnual > 0 ? pctRec.toFixed(1)+'%' : '—';
    if (el('dash-desvio-receita'))el('dash-desvio-receita').textContent= orcRecAnual > 0 ? `${sign(desvioRec)} ${fmv(desvioRec)}` : '';

    // KPI despesas
    if (el('dash-orc-despesas'))  el('dash-orc-despesas').textContent  = formatarMoeda(orcDesAnual);
    if (el('dash-real-despesas')) el('dash-real-despesas').textContent = formatarMoeda(realDesAnual);
    if (el('dash-bar-despesa'))   el('dash-bar-despesa').style.width   = pctDes.toFixed(1) + '%';
    if (el('dash-pct-despesa'))   el('dash-pct-despesa').textContent   = orcDesAnual > 0 ? pctDes.toFixed(1)+'%' : '—';
    if (el('dash-desvio-despesa'))el('dash-desvio-despesa').textContent= orcDesAnual > 0 ? `${sign(desvioDes)} ${fmv(desvioDes)}` : '';

    // KPI resultado
    if (el('dash-resultado-orc'))    el('dash-resultado-orc').textContent    = formatarMoeda(resultOrc);
    if (el('dash-resultado-real')) {
        el('dash-resultado-real').textContent = formatarMoeda(resultReal);
        el('dash-resultado-real').style.color = resultReal >= 0 ? '#10b981' : '#ef4444';
    }
    if (el('dash-resultado-desvio')) {
        el('dash-resultado-desvio').textContent = `${sign(resultDesvio)} ${fmv(resultDesvio)}`;
        el('dash-resultado-desvio').style.color = resultDesvio >= 0 ? '#10b981' : '#ef4444';
    }

    // Alertas
    if (el('dash-alertas')) {
        const alertas = [];
        if (orcDesAnual > 0 && (realDesAnual / orcDesAnual) > 1)
            alertas.push({ cor:'#ef4444', txt:`Despesas ${((realDesAnual/orcDesAnual-1)*100).toFixed(1)}% acima do orçado` });
        if (orcRecAnual > 0 && (realRecAnual / orcRecAnual) < 0.7)
            alertas.push({ cor:'#f59e0b', txt:`Receitas em ${((realRecAnual/orcRecAnual)*100).toFixed(1)}% do orçado` });
        if (resultReal < 0)
            alertas.push({ cor:'#ef4444', txt:'Resultado realizado negativo' });
        if (alertas.length === 0)
            alertas.push({ cor:'#10b981', txt:'Execução dentro dos parâmetros' });
        el('dash-alertas').innerHTML = alertas.map(a =>
            `<div style="display:flex;align-items:center;gap:0.4rem;"><span style="width:8px;height:8px;border-radius:50%;background:${a.cor};flex-shrink:0;"></span><span>${a.txt}</span></div>`
        ).join('');
    }

    // Tabela desvio por grupo
    if (el('dash-desvio-grupos')) {
        const grupos = appData.planoContas || [];
        const linhas = grupos.map(g => {
            const tipo = g.nome === 'RECEITA' ? 'RECEITA' : 'DESPESA';
            const orc  = mesesOrc.reduce((a,m) => a + calcMesGrupo(g, m), 0);
            // realizado do grupo: soma contas do grupo
            const contasGrupo = (g.plano_contas || g.contas || []);
            let real = 0;
            contasGrupo.forEach(c => {
                const r = realPorConta[c.id];
                if (r) real += tipo === 'RECEITA' ? r.rec : r.des;
            });
            const desv = real - orc;
            return { nome: g.nome, orc, real, desv, tipo };
        }).filter(l => l.orc > 0 || l.real > 0);

        if (linhas.length === 0) {
            el('dash-desvio-grupos').innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;">Sem dados de orçamento para o período.</p>';
        } else {
            el('dash-desvio-grupos').innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                <thead>
                    <tr style="background:#f1f5f9;color:#475569;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;">
                        <th style="text-align:left;padding:0.5rem 0.75rem;font-weight:700;">Grupo</th>
                        <th style="text-align:right;padding:0.5rem 0.75rem;font-weight:700;">Orçado</th>
                        <th style="text-align:right;padding:0.5rem 0.75rem;font-weight:700;">Realizado</th>
                        <th style="text-align:right;padding:0.5rem 0.75rem;font-weight:700;">Desvio</th>
                        <th style="text-align:right;padding:0.5rem 0.75rem;font-weight:700;">%</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas.map((l,i) => {
                        const pct = l.orc > 0 ? ((l.real/l.orc)*100).toFixed(1) : '—';
                        const cDesv = l.desv >= 0 ? '#10b981' : '#ef4444';
                        return `<tr style="border-bottom:1px solid #f1f5f9;${i%2===1?'background:#fafafa':''}">
                            <td style="padding:0.45rem 0.75rem;color:#334155;font-weight:600;">${l.nome}</td>
                            <td style="padding:0.45rem 0.75rem;text-align:right;color:#0f172a;">${formatarMoeda(l.orc)}</td>
                            <td style="padding:0.45rem 0.75rem;text-align:right;color:#0f172a;">${formatarMoeda(l.real)}</td>
                            <td style="padding:0.45rem 0.75rem;text-align:right;color:${cDesv};font-weight:600;">${sign(l.desv)} ${fmv(l.desv)}</td>
                            <td style="padding:0.45rem 0.75rem;text-align:right;color:#64748b;">${pct}${pct!=='—'?'%':''}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        }
    }

    // Gráfico — usa colunas do período
    const ctx = document.getElementById('chart-orc-realizado');
    if (!ctx) return;
    if (chartOrcRealizado) chartOrcRealizado.destroy();

    let labels, orcRec, orcDes, realRec, realDes;
    if (dashPeriodo === 'anual' || dashPeriodo === 'intervalo') {
        labels  = ORC_MESES_LABELS;
        orcRec  = M.map(m => orcRecMes(m));
        orcDes  = M.map(m => orcDesMes(m));
        realRec = M.map(m => realRecMes[m]);
        realDes = M.map(m => realDesMes[m]);
    } else {
        const ms = meses || M;
        const nomeMes = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        labels  = ms.map(m => nomeMes[m]);
        orcRec  = ms.map(m => orcRecMes(m));
        orcDes  = ms.map(m => orcDesMes(m));
        realRec = ms.map(m => realRecMes[m]);
        realDes = ms.map(m => realDesMes[m]);
    }

    chartOrcRealizado = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label:'Receita Orçada',    data:orcRec,  backgroundColor:'rgba(34,197,94,0.25)', borderColor:'rgba(34,197,94,1)', borderWidth:1 },
                { label:'Receita Realizada', data:realRec, backgroundColor:'rgba(34,197,94,0.85)', borderColor:'rgba(34,197,94,1)', borderWidth:1 },
                { label:'Despesa Orçada',    data:orcDes,  backgroundColor:'rgba(239,68,68,0.25)', borderColor:'rgba(239,68,68,1)', borderWidth:1 },
                { label:'Despesa Realizada', data:realDes, backgroundColor:'rgba(239,68,68,0.85)', borderColor:'rgba(239,68,68,1)', borderWidth:1 }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { ticks: { callback: v => 'R$ '+v.toLocaleString('pt-BR') } } }
        }
    });

    // Inicializar sub-seletor
    renderizarFiltroDashboard();
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
function aplicarFiltrosDashboard() { atualizarDashboardPremium(); }
function limparFiltrosDashboard() { setDashPeriodo('anual'); }

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
    const elInicio = document.getElementById('dash-filtro-data-inicio');
    const elFim = document.getElementById('dash-filtro-data-fim');
    if (!elInicio || !elFim) return;
    const dataInicio = elInicio.value;
    const dataFim = elFim.value;
    
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

document.getElementById('form-irmao').addEventListener('submit', async function(e) {
    e.preventDefault();

    const id = document.getElementById('irmao-id').value;
    const payload = {
        nome:     document.getElementById('irmao-nome').value,
        email:    document.getElementById('irmao-email').value,
        whatsapp: document.getElementById('irmao-whatsapp').value,
        ativo:    document.getElementById('irmao-ativo').checked
    };

    if (id) {
        const { error } = await supabaseClient.from('irmaos').update(payload).eq('id', id);
        if (error) { alert('Erro ao salvar irmão: ' + error.message); return; }
        registrarHistorico('EDIÇÃO', `Irmão: ${payload.nome}`, 'Irmãos');
    } else {
        const { error } = await supabaseClient.from('irmaos').insert(payload);
        if (error) { alert('Erro ao salvar irmão: ' + error.message); return; }
        registrarHistorico('INSERÇÃO', `Irmão: ${payload.nome}`, 'Irmãos');
    }

    const { data: irms } = await supabaseClient.from('irmaos').select('*').order('nome');
    appData.irmaos = irms || [];

    fecharModalIrmao();
    renderizarIrmaos();
});

async function excluirIrmao(id) {
    if (!confirm('Tem certeza que deseja excluir este irmão?')) return;
    const irmao = appData.irmaos.find(i => i.id === id);
    const { error } = await supabaseClient.from('irmaos').delete().eq('id', id);
    if (error) { alert('Erro ao excluir irmão: ' + error.message); return; }
    appData.irmaos = appData.irmaos.filter(i => i.id !== id);
    registrarHistorico('EXCLUSÃO', `Irmão: ${irmao.nome}`, 'Irmãos');
    renderizarIrmaos();
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
    registrarHistorico('ENVIO', `Prestação de Contas enviada para ${irmaosParaEnviar.length} irmão(s)`, 'Prestação de Contas');
    
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
        registrarHistorico('ACESSO', `Acesso ${novoStatus} para usuário ID ${userId}`, 'Acessos');
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
        registrarHistorico('ACESSO', `Perfil alterado para ${role} — usuário ID ${userId}`, 'Acessos');
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
            registrarHistorico('IMPORTAÇÃO', `${importados} irmão(s) importado(s) via Excel`, 'Irmãos');
            alert(`✅ ${importados} irmão(s) importado(s) com sucesso!\n${ignorados > 0 ? `⚠️ ${ignorados} linha(s) ignorada(s) (email inválido ou duplicado).` : ''}`);

        } catch (erro) {
            alert('Erro ao ler o arquivo: ' + erro.message);
        } finally {
            inputEl.value = '';
        }
    };
    reader.readAsArrayBuffer(arquivo);
}
function baixarModeloLancamentos() {
    // Monta lista de contas do plano para a aba de referência
    const contasReceita = [];
    const contasDespesa = [];
    (appData.planoContas || []).forEach(grupo => {
        (grupo.contas || []).forEach(c => {
            if (grupo.nome === 'RECEITA') contasReceita.push(c.nome);
            else contasDespesa.push(c.nome);
        });
    });

    // Aba principal — modelo com exemplos
    const modelo = [
        { tipo: 'RECEITA', conta: contasReceita[0] || 'Nome da Conta', data: '2026-01-15', historico: 'Mensalidades Janeiro', descricao: 'Descrição detalhada (opcional)', valor: 1500.00 },
        { tipo: 'DESPESA', conta: contasDespesa[0] || 'Nome da Conta', data: '2026-01-20', historico: 'Aluguel Sede', descricao: '', valor: 800.00 },
    ];

    // Aba de referência — lista de contas válidas
    const ref = [
        { tipo: 'RECEITA', contas_validas: contasReceita.join(', ') || '(nenhuma conta cadastrada)' },
        { tipo: 'DESPESA', contas_validas: contasDespesa.join(', ') || '(nenhuma conta cadastrada)' },
    ];

    const wb = XLSX.utils.book_new();

    const wsModelo = XLSX.utils.json_to_sheet(modelo);
    // Largura das colunas
    wsModelo['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 30 }, { wch: 40 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsModelo, 'Lançamentos');

    const wsRef = XLSX.utils.json_to_sheet(ref);
    wsRef['!cols'] = [{ wch: 10 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Contas Válidas');

    XLSX.writeFile(wb, 'modelo_lancamentos.xlsx');
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
                alert('Planilha vazia ou formato não reconhecido.');
                return;
            }

            const normalizar = obj => {
                const n = {};
                for (const k in obj) n[k.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')] = (obj[k] || '').toString().trim();
                return n;
            };

            // Monta mapa de contas válidas: nome (lower) -> nome original
            const contasValidas = new Map();
            (appData.planoContas || []).forEach(grupo => {
                (grupo.contas || []).forEach(c => {
                    contasValidas.set(c.nome.toLowerCase(), c.nome);
                });
            });

            let importados = 0;
            let ignorados = 0;
            const erros = [];

            const proximoId = appData.lancamentos.length > 0
                ? Math.max(...appData.lancamentos.map(l => l.id)) + 1
                : 1;
            let idAtual = proximoId;

            linhas.forEach((linha, idx) => {
                const l = normalizar(linha);
                const rowNum = idx + 2;

                const dataRaw   = l['data']      || '';
                const tipoRaw   = (l['tipo']     || '').toUpperCase();
                // aceita coluna "conta" (novo modelo) ou "tipificacao"/"categoria" (legado)
                const contaRaw  = l['conta']     || l['tipificacao'] || l['categoria'] || '';
                const historico = l['historico'] || '';
                const descricao = l['descricao'] || '';
                const valorRaw  = (l['valor']    || '').replace(',', '.');

                if (!dataRaw)   { ignorados++; erros.push(`Linha ${rowNum}: data ausente`); return; }
                if (!historico) { ignorados++; erros.push(`Linha ${rowNum}: histórico ausente`); return; }
                if (tipoRaw !== 'RECEITA' && tipoRaw !== 'DESPESA') {
                    ignorados++;
                    erros.push(`Linha ${rowNum}: tipo inválido ("${tipoRaw}") — use RECEITA ou DESPESA`);
                    return;
                }

                const valor = parseFloat(valorRaw);
                if (isNaN(valor) || valor <= 0) {
                    ignorados++;
                    erros.push(`Linha ${rowNum}: valor inválido ("${valorRaw}")`);
                    return;
                }

                let tipificacao = '';
                if (contaRaw) {
                    const nomeValido = contasValidas.get(contaRaw.toLowerCase());
                    if (!nomeValido) {
                        ignorados++;
                        erros.push(`Linha ${rowNum}: conta "${contaRaw}" não encontrada no plano de contas`);
                        return;
                    }
                    tipificacao = nomeValido;
                }

                appData.lancamentos.push({ id: idAtual++, data: dataRaw, tipo: tipoRaw, tipificacao, historico, descricao, valor });
                importados++;
            });

            if (importados > 0) {
                salvarDados();
                renderizarLancamentos();
                atualizarDashboardPremium();
                registrarHistorico('IMPORTAÇÃO', `${importados} lançamento(s) importado(s) via Excel`, 'Lançamentos');
            }

            let msg = `${importados} lançamento(s) importado(s) com sucesso!`;
            if (ignorados > 0) {
                msg += `\n${ignorados} linha(s) ignorada(s):\n` + erros.slice(0, 5).join('\n');
                if (erros.length > 5) msg += `\n... e mais ${erros.length - 5} erros.`;
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

        const isReceita = tipo === 'RECEITA';
        const accent     = isReceita ? '#16a34a' : '#dc2626';
        const accentLight= isReceita ? '#dcfce7' : '#fee2e2';
        const accentMid  = isReceita ? '#bbf7d0' : '#fecaca';
        const icon       = isReceita ? '↑' : '↓';
        const totalContas = gruposDeTipo.reduce((acc, g) => acc + (g.contas || []).length, 0);

        const gruposHTML = gruposDeTipo.map(grupo => {
            const contas = grupo.contas || [];
            const contasHTML = contas.length === 0
                ? `<div style="padding:0.6rem 1.25rem; font-size:0.82rem; color:#94a3b8; font-style:italic;">Nenhuma conta cadastrada.</div>`
                : contas.map((cat, catIdx) => `
                    <div style="display:flex; align-items:center; justify-content:space-between;
                                padding:0.45rem 1.25rem; border-top:1px solid #f1f5f9;"
                         onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <div style="display:flex; align-items:baseline; gap:0.5rem;">
                            <span style="font-size:0.85rem; color:#1e293b;">${cat.nome}</span>
                            ${(cat.descricoes || []).length > 0
                                ? `<span style="font-size:0.75rem; color:#94a3b8;">${cat.descricoes.join(' · ')}</span>`
                                : ''}
                        </div>
                        <button onclick="editarCategoriaContas(${grupo._idx}, ${catIdx})" title="Editar"
                                style="background:none; border:none; cursor:pointer; color:#cbd5e1;
                                       font-size:0.78rem; padding:0.1rem 0.3rem; border-radius:4px; flex-shrink:0;"
                                onmouseover="this.style.color='${accent}'" onmouseout="this.style.color='#cbd5e1'">✏️</button>
                    </div>
                `).join('');

            return `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px;
                            box-shadow:0 1px 4px rgba(0,0,0,0.05); overflow:hidden; width:100%;">
                    <div style="display:flex; align-items:center; gap:1rem; padding:0.7rem 1.25rem;
                                background:${accentLight}; border-bottom:1px solid ${accentMid};">
                        <span style="font-size:0.9rem; font-weight:700; color:#1e293b;">${grupo.descricao || grupo.nome}</span>
                        <span style="font-size:0.7rem; background:white; color:${accent}; font-weight:600;
                                     padding:0.1rem 0.5rem; border-radius:999px; border:1px solid ${accentMid};">
                            ${contas.length} ${contas.length === 1 ? 'conta' : 'contas'}
                        </span>
                        <div style="margin-left:auto; display:flex; gap:0.4rem;">
                            <button onclick="abrirModalGrupoContas(${grupo._idx})" title="Editar grupo"
                                    style="background:white; border:1px solid ${accentMid}; border-radius:6px;
                                           padding:0.2rem 0.55rem; cursor:pointer; font-size:0.75rem; color:#475569;"
                                    onmouseover="this.style.background='${accentMid}'" onmouseout="this.style.background='white'">✏️</button>
                            <button onclick="excluirGrupoContas(${grupo._idx})" title="Excluir grupo"
                                    style="background:white; border:1px solid #fecaca; border-radius:6px;
                                           padding:0.2rem 0.55rem; cursor:pointer; font-size:0.75rem; color:#ef4444;"
                                    onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='white'">🗑️</button>
                        </div>
                    </div>
                    ${contasHTML}
                </div>
            `;
        }).join('');

        return `
            <div style="margin-bottom: 2.5rem;">
                <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
                    <div style="width:30px; height:30px; border-radius:8px; background:${accent};
                                display:flex; align-items:center; justify-content:center;
                                color:white; font-weight:800; font-size:1rem;">${icon}</div>
                    <div>
                        <h3 style="margin:0; font-size:1rem; font-weight:700; color:#1e293b;">${tipo}</h3>
                        <span style="font-size:0.78rem; color:#94a3b8;">${gruposDeTipo.length} grupo${gruposDeTipo.length !== 1 ? 's' : ''} · ${totalContas} conta${totalContas !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:0.6rem;">
                    ${gruposHTML}
                </div>
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
let orcPeriodo = 'mensal'; // 'mensal' | 'trimestral' | 'semestral'

const ORC_TRIMESTRES = [
    { label: 'T1 (Jan-Mar)', meses: [1,2,3] },
    { label: 'T2 (Abr-Jun)', meses: [4,5,6] },
    { label: 'T3 (Jul-Set)', meses: [7,8,9] },
    { label: 'T4 (Out-Dez)', meses: [10,11,12] },
];
const ORC_SEMESTRES = [
    { label: '1º Semestre', meses: [1,2,3,4,5,6] },
    { label: '2º Semestre', meses: [7,8,9,10,11,12] },
];

function trocarPeriodoOrc(periodo) {
    orcPeriodo = periodo;
    atualizarBotoesPeriodo();
    renderizarParametros();
    renderizarPlanilha();
}

function atualizarBotoesPeriodo() {
    ['mensal','trimestral','semestral'].forEach(p => {
        const btn = document.getElementById(`orc-btn-${p}`);
        if (!btn) return;
        const ativo = p === orcPeriodo;
        btn.style.background = ativo ? 'var(--color-primary)' : 'white';
        btn.style.color = ativo ? 'white' : '#475569';
        btn.style.borderColor = ativo ? 'var(--color-primary)' : '#cbd5e1';
        btn.style.fontWeight = ativo ? '700' : '400';
    });
}

function orcColunas() {
    if (orcPeriodo === 'trimestral') return ORC_TRIMESTRES;
    if (orcPeriodo === 'semestral') return ORC_SEMESTRES;
    return ORC_MESES_LABELS.map((label, i) => ({ label, meses: [i + 1] }));
}

function somarColuna(getFn, meses) {
    return meses.reduce((a, m) => a + getFn(m), 0);
}

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
            padding:0.3rem 0.85rem; border-radius:20px; border:2px solid;
            cursor:pointer; font-size:0.85rem;
            border-color:${ativo ? 'var(--color-primary)' : '#cbd5e1'};
            background:${ativo ? 'var(--color-primary)' : 'white'};
            color:${ativo ? 'white' : '#475569'};
            font-weight:${ativo ? '700' : '400'};
        ">${ano}</button>`;
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

async function excluirExercicio() {
    if (orcExerciciosDisponiveis.length <= 1) {
        alert('Não é possível excluir o único exercício existente.');
        return;
    }
    if (!confirm(`Excluir orçamento ${orcExercicioAtivo}? Esta ação não pode ser desfeita.`)) return;

    const ano = orcExercicioAtivo;

    const { error: ep } = await supabaseClient
        .from('orcamento_parametros').delete().eq('ano', ano);
    if (ep) { alert('Erro ao excluir parâmetros: ' + ep.message); return; }

    const { error: ev } = await supabaseClient
        .from('orcamento_valores').delete().eq('ano', ano);
    if (ev) { alert('Erro ao excluir valores: ' + ev.message); return; }

    orcExerciciosDisponiveis = orcExerciciosDisponiveis.filter(a => a !== ano);
    const proximo = orcExerciciosDisponiveis[0];
    registrarHistorico('EXCLUSÃO', `Exercício orçamentário ${ano} excluído`, 'Orçamento');
    await trocarExercicio(proximo);
}

function abrirModalCopiarExercicio() {
    const sel = document.getElementById('copiar-origem');
    if (!sel) return;
    sel.innerHTML = orcExerciciosDisponiveis
        .map(a => `<option value="${a}">${a}</option>`).join('');
    sel.value = orcExercicioAtivo;
    const inp = document.getElementById('copiar-destino');
    if (inp) inp.value = '';
    const modal = document.getElementById('modal-copiar-exercicio');
    if (modal) modal.style.display = 'flex';
}

function fecharModalCopiarExercicio() {
    const modal = document.getElementById('modal-copiar-exercicio');
    if (modal) modal.style.display = 'none';
}

async function confirmarCopiarExercicio() {
    const origem = parseInt(document.getElementById('copiar-origem').value, 10);
    const destino = parseInt(document.getElementById('copiar-destino').value, 10);

    if (isNaN(destino) || destino < 2020 || destino > 2099) {
        alert('Ano destino inválido. Informe um valor entre 2020 e 2099.');
        return;
    }
    if (destino === origem) {
        alert('O ano destino deve ser diferente do ano de origem.');
        return;
    }
    if (orcExerciciosDisponiveis.includes(destino)) {
        if (!confirm(`O exercício ${destino} já existe. Deseja sobrescrever todos os seus dados?`)) return;
    }

    fecharModalCopiarExercicio();

    const { data: params } = await supabaseClient
        .from('orcamento_parametros').select('*').eq('ano', origem);
    const { data: valores } = await supabaseClient
        .from('orcamento_valores').select('*').eq('ano', origem);

    if (params && params.length > 0) {
        const novosParams = params.map(({ id, ...rest }) => ({ ...rest, ano: destino }));
        const { error } = await supabaseClient.from('orcamento_parametros')
            .upsert(novosParams, { onConflict: 'ano,mes' });
        if (error) { alert('Erro ao copiar parâmetros: ' + error.message); return; }
    } else {
        const placeholders = [];
        for (let m = 1; m <= 12; m++) {
            placeholders.push({ ano: destino, mes: m,
                obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
                mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
                taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 });
        }
        await supabaseClient.from('orcamento_parametros')
            .upsert(placeholders, { onConflict: 'ano,mes' });
    }

    if (valores && valores.length > 0) {
        const novosValores = valores.map(({ id, ...rest }) => ({ ...rest, ano: destino }));
        const { error } = await supabaseClient.from('orcamento_valores')
            .upsert(novosValores, { onConflict: 'ano,mes,conta_id' });
        if (error) { alert('Erro ao copiar valores: ' + error.message); return; }
    }

    if (!orcExerciciosDisponiveis.includes(destino)) {
        orcExerciciosDisponiveis = [...orcExerciciosDisponiveis, destino].sort((a,b) => a - b);
    }
    registrarHistorico('INSERÇÃO', `Exercício ${destino} criado como cópia de ${origem}`, 'Orçamento');
    await trocarExercicio(destino);
}

async function criarExercicio() {
    const input = prompt('Informe o ano do novo exercício (ex: 2027):');
    if (!input) return;
    const ano = parseInt(input, 10);
    if (isNaN(ano) || ano < 2020 || ano > 2099) {
        alert('Ano inválido. Informe um valor entre 2020 e 2099.');
        return;
    }
    if (orcExerciciosDisponiveis.includes(ano)) {
        alert(`O exercício ${ano} já existe.`);
        return;
    }

    const placeholders = [];
    for (let m = 1; m <= 12; m++) {
        placeholders.push({ ano, mes: m,
            obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
            mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
            taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 });
    }
    const { error } = await supabaseClient.from('orcamento_parametros')
        .upsert(placeholders, { onConflict: 'ano,mes' });
    if (error) { alert('Erro ao criar exercício: ' + error.message); return; }

    orcExerciciosDisponiveis = [...orcExerciciosDisponiveis, ano].sort((a,b) => a - b);
    registrarHistorico('INSERÇÃO', `Exercício orçamentário ${ano} criado`, 'Orçamento');
    await trocarExercicio(ano);
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

    // Atualiza o dashboard com os dados orçados agora disponíveis
    dashAno = orcExercicioAtivo;
    setDashPeriodo('anual');
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

async function adicionarContaPlanilha(grupoId) {
    const nome = prompt('Nome da nova linha:');
    if (!nome || !nome.trim()) return;

    const { data, error } = await supabaseClient
        .from('contas')
        .insert({ plano_id: grupoId, nome: nome.trim() })
        .select('id, plano_id, nome')
        .single();

    if (error) { alert('Erro ao adicionar linha: ' + error.message); return; }

    const grupo = appData.planoContas.find(g => g.id === grupoId);
    if (grupo) grupo.contas.push({ id: data.id, nome: data.nome, descricoes: [] });

    registrarHistorico('INSERÇÃO', `Conta "${data.nome}" adicionada ao grupo ${grupoId}`, 'Orçamento');
    renderizarPlanilha();
    atualizarSelectsPlanosContas();
}

async function excluirContaPlanilha(contaId) {
    const grupo = appData.planoContas.find(g => (g.contas||[]).some(c => c.id === contaId));
    const conta = grupo?.contas?.find(c => c.id === contaId);
    if (!conta) return;
    if (!confirm(`Excluir a linha "${conta.nome}"? Os valores orçados dela serão removidos.`)) return;

    // Remove valores orçados
    await supabaseClient.from('orcamento_valores').delete().eq('conta_id', contaId);
    // Remove a conta
    const { error } = await supabaseClient.from('contas').delete().eq('id', contaId);
    if (error) { alert('Erro ao excluir linha: ' + error.message); return; }

    if (grupo) grupo.contas = grupo.contas.filter(c => c.id !== contaId);
    // Limpa cache de valores
    Object.keys(orcValores).forEach(k => { if (k.endsWith(`_${contaId}`)) delete orcValores[k]; });

    registrarHistorico('EXCLUSÃO', `Conta "${conta.nome}" removida`, 'Orçamento');
    renderizarPlanilha();
    atualizarSelectsPlanosContas();
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
    atualizarBotoesPeriodo();
    const colunas = orcColunas();
    const isMensal = orcPeriodo === 'mensal';
    const rows = [
        { key:'obreiros_normal',       label:'Nº Obreiros — Normal',          step:'1',    pct:false },
        { key:'obreiros_remido',       label:'Nº Obreiros — Remido',          step:'1',    pct:false },
        { key:'obreiros_licenciado',   label:'Nº Obreiros — Licenciado',      step:'1',    pct:false },
        { key:'mensalidade_normal',    label:'Mensalidade Normal (R$)',        step:'0.01', pct:false },
        { key:'mensalidade_remido',    label:'Mensalidade Remido (R$)',        step:'0.01', pct:false },
        { key:'mensalidade_licenciado',label:'Mensalidade Licenciado (R$)',    step:'0.01', pct:false },
        { key:'taxa_inadimplencia',    label:'Taxa de Inadimplência (%)',      step:'0.1',  pct:true  },
        { key:'taxa_gob',              label:'Taxa GOB (R$)',                  step:'0.01', pct:false },
        { key:'taxa_godf',             label:'Taxa GODF (R$)',                 step:'0.01', pct:false },
    ];
    const th = 'padding:0.45rem 0.5rem; border:1px solid #cbd5e1; text-align:center; font-size:0.8rem;';
    const tdLabel = 'padding:0.35rem 0.75rem; border:1px solid #e2e8f0; background:#f8fafc; white-space:nowrap; font-size:0.8rem;';
    const tdInput = 'padding:0.1rem; border:1px solid #e2e8f0;';
    const inputStyle = 'width:100%;border:none;text-align:right;padding:0.25rem;font-size:0.8rem;background:transparent;';
    const tdRead = 'text-align:right;padding:0.35rem 0.5rem;border:1px solid #e2e8f0;font-size:0.8rem;';

    container.innerHTML = `
        <p style="font-weight:600; margin-bottom:0.75rem; color:var(--color-primary);">Parâmetros — ${orcExercicioAtivo}</p>
        <div style="overflow-x:auto;">
        <table style="border-collapse:collapse; min-width:800px; width:100%;">
            <thead><tr style="background:#f1f5f9;">
                <th style="text-align:left;${th} min-width:220px;">Variável</th>
                ${colunas.map(c=>`<th style="${th} min-width:90px;">${c.label}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${rows.map(r=>`<tr>
                    <td style="${tdLabel}">${r.label}</td>
                    ${colunas.map(col=>{
                        if (isMensal) {
                            const mes = col.meses[0];
                            const raw = orcParam[mes]?.[r.key] ?? 0;
                            const disp = r.pct ? (raw*100).toFixed(1) : raw;
                            return `<td style="${tdInput}"><input type="number" step="${r.step}" value="${disp}"
                                style="${inputStyle}" onfocus="this.select()"
                                onblur="salvarParametro(${mes},'${r.key}',this.value)"></td>`;
                        }
                        const soma = col.meses.reduce((a,m) => {
                            const raw = orcParam[m]?.[r.key] ?? 0;
                            return a + (r.pct ? raw*100 : raw);
                        }, 0);
                        const disp = r.pct ? (soma / col.meses.length).toFixed(1) + '%' : soma.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
                        return `<td style="${tdRead}">${disp}</td>`;
                    }).join('')}
                </tr>`).join('')}
                <tr style="background:#dbeafe; font-weight:600;">
                    <td style="${tdLabel} background:#dbeafe;">Total de Obreiros Contribuintes</td>
                    ${colunas.map(col=>{
                        if (isMensal) {
                            const mes = col.meses[0];
                            const p=orcParam[mes]||{};
                            const tot=(p.obreiros_normal||0)+(p.obreiros_remido||0)+(p.obreiros_licenciado||0);
                            return `<td id="param-total-obreiros-${mes}" style="text-align:right;padding:0.35rem 0.5rem;border:1px solid #bfdbfe;">${tot}</td>`;
                        }
                        const soma = col.meses.reduce((a,m) => {
                            const p=orcParam[m]||{};
                            return a+(p.obreiros_normal||0)+(p.obreiros_remido||0)+(p.obreiros_licenciado||0);
                        }, 0);
                        return `<td style="text-align:right;padding:0.35rem 0.5rem;border:1px solid #bfdbfe;">${soma}</td>`;
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

    const colunas = orcColunas();
    const isMensal = orcPeriodo === 'mensal';

    // No modo mensal omitimos Média e % para caber as 12 colunas na tela
    const fs   = isMensal ? '0.7rem'  : '0.78rem';
    const pad  = isMensal ? '0.25rem 0.2rem' : '0.5rem 0.4rem';
    const padD = isMensal ? '0.25rem 0.4rem' : '0.5rem 0.75rem';

    const S = {
        th:   `padding:${pad}; border:1px solid #475569; text-align:right; font-size:${fs};`,
        n1:   `background:#1e293b; color:white; font-weight:700; padding:${pad}; text-align:right; border:1px solid #334155; font-size:${fs};`,
        n1d:  `background:#1e293b; color:white; font-weight:700; padding:${padD}; border:1px solid #334155; font-size:${fs}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:0;`,
        n2:   `background:#e2e8f0; font-weight:700; padding:${pad}; text-align:right; border:1px solid #cbd5e1; font-size:${fs};`,
        n2d:  `background:#e2e8f0; font-weight:700; padding:${padD}; border:1px solid #cbd5e1; font-size:${fs}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:0;`,
        n3:   `background:white; padding:${pad}; text-align:right; border:1px solid #e2e8f0; font-size:${fs};`,
        n3d:  `background:white; padding:${padD}; border:1px solid #e2e8f0; font-size:${fs}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:0;`,
        fc:   `background:#eff6ff; padding:${pad}; text-align:right; border:1px solid #bfdbfe; font-size:${fs};`,
        inp:  `width:100%;border:none;text-align:right;padding:0.1rem;font-size:${fs};background:transparent;`,
        cellinp: `padding:0.05rem; border:1px solid #e2e8f0;`,
    };

    const getColVal = (getFn, col) => somarColuna(getFn, col.meses);

    const extraCols = isMensal ? '' : `<td style="${S.n1}">${fv(anual/12)}</td><td style="${S.n1}">${fp(anual,totRecAnual)}</td>`;
    const extraColsN2 = (anual) => isMensal ? '' : `<td style="${S.n2}">${fv(anual/12)}</td><td style="${S.n2}">${fp(anual,totRecAnual)}</td>`;
    const extraColsN3 = (anual, isFormula) => isMensal ? '' : `<td style="${isFormula?S.fc:S.n3}">${fv(anual/12)}</td><td style="${isFormula?S.fc:S.n3}">${fp(anual,totRecAnual)}</td>`;

    const rowN1 = (cod, label, getMes, anual) => `<tr>
        <td style="${S.n1d}">${cod}  ${label}</td>
        ${isMensal ? '' : `<td style="${S.n1}">${fv(anual/12)}</td><td style="${S.n1}">${fp(anual,totRecAnual)}</td>`}
        ${colunas.map(col=>`<td style="${S.n1}">${fv(getColVal(getMes,col))}</td>`).join('')}
        <td style="${S.n1}">${fv(anual)}</td>
    </tr>`;

    const rowN2 = (cod, label, getMes, anual) => `<tr>
        <td style="${S.n2d}">${cod}  ${label}</td>
        ${extraColsN2(anual)}
        ${colunas.map(col=>`<td style="${S.n2}">${fv(getColVal(getMes,col))}</td>`).join('')}
        <td style="${S.n2}">${fv(anual)}</td>
    </tr>`;

    const btnExcluir = (contaId) => `<button type="button" onclick="excluirContaPlanilha(${contaId})"
        title="Excluir linha" style="border:none;background:none;cursor:pointer;color:#dc2626;font-size:0.8rem;padding:0 0.25rem;line-height:1;">✕</button>`;

    const rowConta = (conta, isFormula) => {
        const anual = calcAnualConta(conta.id);
        const podeExcluir = !isFormula;
        const nomeCell = podeExcluir
            ? `<div style="display:flex;align-items:center;gap:0.25rem;overflow:hidden;">${btnExcluir(conta.id)}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${conta.nome}</span></div>`
            : conta.nome;
        return `<tr>
            <td style="${S.n3d}">${nomeCell}</td>
            ${extraColsN3(anual, isFormula)}
            ${colunas.map(col => {
                const soma = somarColuna(m => getValorConta(conta.id, m), col.meses);
                if (isFormula) return `<td style="${S.fc}">${fv(soma)}</td>`;
                if (!isMensal) return `<td style="${S.n3}">${fv(soma)}</td>`;
                const m = col.meses[0];
                const v = getValorConta(conta.id, m);
                return `<td style="${S.cellinp}"><input type="number" step="0.01"
                    value="${v||''}" style="${S.inp}" onfocus="this.select()"
                    onblur="salvarValorConta(${conta.id},${m},this.value)"></td>`;
            }).join('')}
            <td style="${isFormula?S.fc:S.n3}">${fv(anual)}</td>
        </tr>`;
    };

    const rowAdicionarConta = (grupoId) => `<tr>
        <td colspan="${colunas.length + (isMensal ? 2 : 4)}" style="padding:0.2rem 0.4rem; border:1px solid #e2e8f0;">
            <button type="button" onclick="adicionarContaPlanilha(${grupoId})"
                style="font-size:0.75rem;padding:0.2rem 0.6rem;border:1px dashed #94a3b8;border-radius:4px;background:transparent;cursor:pointer;color:#64748b;">
                + Adicionar linha
            </button>
        </td>
    </tr>`;

    const rowResultado = () => {
        const cor = resAnual >= 0 ? '#16a34a' : '#dc2626';
        const st = `background:#0f172a; color:${cor}; font-weight:700; padding:${pad}; text-align:right; border:1px solid #1e293b; font-size:${fs};`;
        return `<tr>
            <td style="background:#0f172a;color:${cor};font-weight:700;padding:${padD};border:1px solid #1e293b;font-size:${fs};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0;">RESULTADO FINAL</td>
            ${isMensal ? '' : `<td style="${st}">${fv(resAnual/12)}</td><td style="${st}">${fp(resAnual,totRecAnual)}</td>`}
            ${colunas.map(col=>{const v=somarColuna(resMes,col.meses);const c=v>=0?'#16a34a':'#dc2626';
                return `<td style="background:#0f172a;color:${c};font-weight:700;padding:${pad};text-align:right;border:1px solid #1e293b;font-size:${fs};">${fv(v)}</td>`;
            }).join('')}
            <td style="${st}">${fv(resAnual)}</td>
        </tr>`;
    };

    // No mensal: tabela fixa de 100% sem overflow para caber tudo na tela
    const tableStyle = isMensal
        ? 'border-collapse:collapse; width:100%; table-layout:fixed;'
        : 'border-collapse:collapse; min-width:800px; width:100%;';
    const wrapStyle = isMensal ? '' : 'overflow-x:auto;';

    // Larguras das colunas no modo mensal: descrição ~22%, total ~8%, 12 meses dividem o resto
    const colWidths = isMensal ? `
        <colgroup>
            <col style="width:22%">
            ${colunas.map(()=>`<col style="width:${(70/12).toFixed(2)}%">`).join('')}
            <col style="width:8%">
        </colgroup>` : '';

    container.innerHTML = `
        <p style="font-weight:600; margin-bottom:0.75rem; color:var(--color-primary);">Projeção de Receitas e Despesas — ${orcExercicioAtivo}</p>
        <div style="${wrapStyle}">
        <table style="${tableStyle}">
            ${colWidths}
            <thead><tr style="background:#334155; color:white;">
                <th style="text-align:left;${S.th}">Descrição</th>
                ${isMensal ? '' : `<th style="${S.th}">Média Mensal</th><th style="${S.th}">%</th>`}
                ${colunas.map(c=>`<th style="${S.th}">${c.label}</th>`).join('')}
                <th style="${S.th}">Total</th>
            </tr></thead>
            <tbody>
                ${rowN1('1','TOTAL DAS RECEITAS', totRecMes, totRecAnual)}
                ${receitas.map((g,i)=>`
                    ${rowN2(`1.${i+1}`, g.descricao, m=>calcMesGrupo(g,m), calcAnualGrupo(g))}
                    ${(g.contas||[]).map(c=>rowConta(c, c.id===CONTA_MENSALIDADES_ID||c.id===CONTA_INADIMPLENCIA_ID)).join('')}
                    ${rowAdicionarConta(g.id)}
                `).join('')}
                ${rowN1('2','TOTAL DAS DESPESAS', totDesMes, totDesAnual)}
                ${despesas.map((g,i)=>`
                    ${rowN2(`2.${i+1}`, g.descricao, m=>calcMesGrupo(g,m), calcAnualGrupo(g))}
                    ${(g.contas||[]).map(c=>rowConta(c, false)).join('')}
                    ${rowAdicionarConta(g.id)}
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
        registrarHistorico('EDIÇÃO', `Grupo: ${nome}`, 'Plano de Contas');
    } else {
        const novoId = Math.max(...appData.planoContas.map(p => p.id), 0) + 1;
        appData.planoContas.push({ id: novoId, ...dados });
        registrarHistorico('INSERÇÃO', `Grupo: ${nome}`, 'Plano de Contas');
    }

    fecharModalGrupoContas();
    renderizarPlanoContas();
    renderizarOrcamentos();
    salvarDados();
});

function excluirGrupoContas(idx) {
    if (confirm('Tem certeza que deseja excluir este grupo?')) {
        appData.planoContas.splice(idx, 1);
        registrarHistorico('EXCLUSÃO', `Grupo de Contas removido`, 'Plano de Contas');
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

    registrarHistorico('EDIÇÃO', `Conta: ${nome}`, 'Plano de Contas');
    fecharModalCategoriaContas();
    renderizarPlanoContas();
    renderizarOrcamentos();
    salvarDados();
});