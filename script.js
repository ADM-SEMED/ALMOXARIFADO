// ============================================================================
// PARTE 1: CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
// ============================================================================

// --- DADOS DE CONEXÃO SUPABASE ---
const SUPABASE_URL = 'https://ligndfhjxgbjiswemkku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZ25kZmhqeGdiamlzd2Vta2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTU5MTcsImV4cCI6MjA3OTE3MTkxN30.IuvFV1eb489ApmbTJCWuaDfdd5H0i81FeP3gKS30Ik8';

// Inicializa o cliente usando o objeto global do script CDN (window.supabase)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO GLOBAL ---
let userProfile = null;       // Dados do usuário logado
let currentUserId = null;     // ID do usuário logado
let activeTab = 'uniformes_roupas';   // Aba ativa no momento
let selectedRowId = null;     // ID da linha selecionada na tabela
let itensPedidoTemporario = []; // Array para guardar itens antes de salvar o pedido

// ============================================================================
// PARTE 2: INICIALIZAÇÃO (DOM LOADED)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // Referências aos elementos do HTML
    const loginScreen = document.getElementById('login-container');
    const mainApp = document.getElementById('app-container');
    const btnLogin = document.getElementById('login-btn');
    const btnLogout = document.getElementById('logout-btn');
    const btnConfig = document.getElementById('btn-config'); // Botão de configurações no header
    const tabsContainer = document.getElementById('tabs');
    const loginError = document.getElementById('login-error');

    // --- EVENTO: LOGIN ---
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim();
            const senha = document.getElementById('login-password').value.trim();

            if (!email || !senha) {
                alert('Preencha email e senha.');
                return;
            }

            // Feedback visual de carregamento
            btnLogin.innerText = "Entrando...";
            btnLogin.disabled = true;

            try {
                const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: senha });
                if (error) throw error;

                currentUserId = authData.user.id;
                await loadUserProfile(currentUserId);

                // Troca as telas
                loginScreen.style.display = 'none'; // Esconde login
                mainApp.classList.remove('hidden'); // Remove classe hidden
                mainApp.style.display = 'block';    // Garante visibilidade

                // Carrega a aba inicial
                window.renderTab('uniformes_roupas');

            } catch (e) {
                console.error(e);
                if (loginError) {
                    loginError.style.display = 'block';
                    loginError.innerText = 'Erro: ' + e.message;
                } else {
                    alert('Erro no login: ' + e.message);
                }
            } finally {
                btnLogin.innerText = "Entrar";
                btnLogin.disabled = false;
            }
        });
    }

    // --- EVENTO: LOGOUT ---
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });
    }

    // --- EVENTO: ABRIR CONFIGURAÇÕES ---
    if (btnConfig) {
        btnConfig.addEventListener('click', () => {
            window.openConfigModal();
        });
    }

    // --- EVENTO: NAVEGAÇÃO ENTRE ABAS ---
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-button');
            if (btn) {
                // Remove classe active de todos
                document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                // Adiciona no clicado
                btn.classList.add('active');
                
                activeTab = btn.dataset.tab;
                selectedRowId = null; // Reseta seleção
                window.renderTab(activeTab);
            }
        });
    }
});

// ============================================================================
// PARTE 3: FUNÇÕES GLOBAIS AUXILIARES (Perfil, Histórico e Modais)
// ============================================================================

// Carrega perfil do usuário para definir permissões
async function loadUserProfile(uid) {
    const { data, error } = await supabase.from('usuarios').select('nivel_acesso, nome_completo').eq('id', uid).single();
    if (error || !data) {
        userProfile = { nivel: 'comum', nome: 'Desconhecido' };
    } else {
        userProfile = { nivel: data.nivel_acesso, nome: data.nome_completo };
    }
}

// Função central para registrar histórico
async function registrarHistorico(prodId, qtd, tipo, obs, respNome, unidId = null) {
    const destino = unidId ? unidId : null;
    const { error } = await supabase.from('historico_global').insert([{
        produto_id: prodId,
        quantidade: qtd,
        tipo_movimento: tipo,
        observacao: obs,
        responsavel_nome: respNome,
        usuario_sistema: currentUserId,
        unidade_destino_id: destino,
        data_movimentacao: new Date()
    }]);
    if(error) console.error("Erro ao gravar histórico:", error);
}

// --- CONTROLE DE MODAIS (Global window) ---

// Fecha modal genérico
window.closeModal = function() {
    document.getElementById('global-modal').style.display = 'none';
}

// Fecha modal de configuração
window.closeConfigModal = function() {
    document.getElementById('config-modal').style.display = 'none';
}

// Abre modal de configuração
window.openConfigModal = function() {
    document.getElementById('config-modal').style.display = 'block';
    window.navegarConfig('catalogo'); // Abre primeira aba por padrão
}

// Navegação interna do modal de configuração
window.navegarConfig = function(subtab) {
    // Atualiza estilo dos botões
    document.querySelectorAll('.config-submenu-button').forEach(b => b.classList.remove('active'));
    // (Opcional) Adicionar active visualmente no botão clicado se tiver referência
    
    const area = document.getElementById("config-content-area");
    if (!area) return;

    // Roteamento das sub-abas de configuração
    if (subtab === 'catalogo') renderSubTabCatalogo();
    else if (subtab === 'categorias') renderSubTabCategorias();
    else if (subtab === 'locais') renderSubTabLocais();
    else if (subtab === 'usuarios') renderSubTabUsuarios();
    else if (subtab === 'tamanhos_roupas') renderSubTabTamanhosRoupas();
    else if (subtab === 'tamanhos_calcados') renderSubTabTamanhosCalcados();
}

// ============================================================================
// PARTE 4: RENDERIZAÇÃO PRINCIPAL (ABAS E TABELAS)
// ============================================================================

window.renderTab = async function(tabName) {
    const tabContentArea = document.getElementById('tab-content');
    
    // Roteamento para abas especiais (que têm layout próprio)
    if (tabName === 'calculadora') { renderCalculadora(); return; }
    if (tabName === 'relatorios') { renderMenuRelatorios(); return; }
    if (tabName === 'uniformes_roupas') { renderTabUniformesRoupas(); return; }
    if (tabName === 'uniformes_calcados') { renderTabUniformesCalcados(); return; }

    // Loading
    tabContentArea.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

    let data = [];
    let html = '';

    try {
        // Buscas no banco de dados baseadas na aba
        if (tabName === 'catalogo') {
            const { data: res } = await supabase.from('catalogo').select('*').order('nome');
            data = res;
        } 
        else if (tabName === 'estoque_consumo') {
            const { data: res } = await supabase.from('estoque_consumo')
                .select('id, quantidade_atual, local_fisico, catalogo(nome, unidade_medida, estoque_minimo)').order('id');
            if(res) data = res.sort((a,b) => (a.catalogo?.nome || '').localeCompare(b.catalogo?.nome || ''));
        } 
        else if (tabName === 'historico') {
            const { data: res } = await supabase.from('historico_global')
                .select('id, data_movimentacao, tipo_movimento, quantidade, responsavel_nome, observacao, catalogo(nome, categoria, unidade_medida), unidades!unidade_destino_id(nome)')
                .order('data_movimentacao', { ascending: false }).limit(50);
            data = res;
        }
        else if (tabName === 'patrimonio') {
            const { data: res } = await supabase.from('patrimonio')
                .select('id, codigo_patrimonio, estado_conservacao, inservivel, catalogo(nome), unidades:unidade_id(nome)');
            if(res) data = res.sort((a,b) => (a.catalogo?.nome || '').localeCompare(b.catalogo?.nome || ''));
        } 
        else if (tabName === 'pedidos') {
            const { data: res } = await supabase.from('pedidos')
                .select('id, status, data_solicitacao, unidades(nome)').order('data_solicitacao', { ascending: false });
            data = res;
        } 

        // Constrói o HTML
        html += renderActionButtons(tabName);
        html += renderTable(tabName, data);
        tabContentArea.innerHTML = html;
        
        // Ativa eventos de clique na tabela
        setupTableEvents(tabName);

    } catch (error) {
        console.error(error);
        tabContentArea.innerHTML = `<p style="color:red">Erro: ${error.message}</p>`;
    }
}

function renderActionButtons(tabName) {
    const isAdmin = ['admin', 'super'].includes(userProfile?.nivel);
    let btns = '<div class="action-buttons">';

    if (isAdmin) {
        if (tabName === 'catalogo') {
            btns += `<button onclick="window.openModalCadastro('catalogo')"><i class="fas fa-plus"></i> Novo Item (Rápido)</button>`;
            btns += `<button onclick="window.openModalEntrada(null)" style="background-color: #28a745;"><i class="fas fa-arrow-down"></i> Nova Entrada</button>`;
        }
        if (tabName === 'estoque_consumo') {
            btns += `<button onclick="window.openModalEntrada('consumo')" style="background-color: #28a745;"><i class="fas fa-arrow-down"></i> Entrada Consumo</button>`;
            btns += `<button onclick="window.openModalSaidaRapida()" style="background-color: #ffc107; color: #333;"><i class="fas fa-arrow-up"></i> Saída Rápida</button>`;
        }
        if (tabName === 'patrimonio') {
            btns += `<button onclick="window.openModalEntrada('permanente')" style="background-color: #28a745;"><i class="fas fa-arrow-down"></i> Entrada Patrimônio</button>`;
            btns += `<button onclick="window.openModalMovimentarPatrimonio()" style="background-color: #17a2b8; color: white;"><i class="fas fa-exchange-alt"></i> Movimentar</button>`;
            btns += `<button id="btn-marcar-inservivel" style="background-color: #343a40; color: white;"><i class="fas fa-trash-alt"></i> Baixar (Inservível)</button>`;
        }
    }
    
    if (tabName === 'pedidos') {
        btns += `<button id="btn-ver-pedido"><i class="fas fa-eye"></i> Gerenciar Pedido</button>`;
        if (isAdmin) btns += `<button onclick="window.openModalCriarPedido()"><i class="fas fa-cart-plus"></i> Criar Pedido (Admin)</button>`;
    }

    btns += '</div>';
    return btns;
}

function renderTable(tabName, data) {
    if (!data || data.length === 0) return '<p class="no-data" style="padding:15px">Nenhum registro encontrado.</p>';
    let headers = [];
    let rows = '';

    if (tabName === 'catalogo') {
        headers = ['Item', 'Tipo', 'Categoria', 'Minimo'];
        data.forEach(r => { 
            const minDisplay = (r.tipo === 'permanente') ? '-' : r.estoque_minimo;
            rows += `<tr data-id="${r.id}"><td><strong>${r.nome}</strong></td><td>${r.tipo.toUpperCase()}</td><td>${r.categoria || '-'}</td><td>${minDisplay}</td></tr>`; 
        });
    }
    else if (tabName === 'estoque_consumo') {
        headers = ['Produto', 'Qtd. Atual', 'Local', 'Status'];
        data.forEach(r => {
            const min = r.catalogo?.estoque_minimo || 0;
            const qtd = r.quantidade_atual || 0;
            let alerta = (min > 0 && qtd <= min) ? '<span style="color:red; font-weight:bold;">(BAIXO)</span>' : '';
            rows += `<tr data-id="${r.id}"><td>${r.catalogo?.nome || '?'} ${alerta}</td><td style="font-weight:bold;">${qtd} ${r.catalogo?.unidade_medida || ''}</td><td>${r.local_fisico || '-'}</td><td>Ativo</td></tr>`;
        });
    }
    else if (tabName === 'historico') {
        // ADICIONEI 'Usuário' NO CABEÇALHO ABAIXO
        headers = ['Data', 'Usuário', 'Tipo', 'Item', 'Categoria', 'Qtd', 'Detalhes'];
        
        data.forEach(r => {
            const dt = new Date(r.data_movimentacao).toLocaleString();
            let tipoClass = 'status-tag ';
            if(r.tipo_movimento?.includes('entrada')) tipoClass += 'conservacao-novo';
            else if(r.tipo_movimento?.includes('saida')) tipoClass += 'conservacao-danificado';
            else tipoClass += 'conservacao-regular';
            
            // ADICIONEI A COLUNA DO USUÁRIO (responsavel_nome) ABAIXO
            rows += `<tr>
                <td style="font-size:0.85em;">${dt}</td>
                <td style="font-weight:bold; color:#2563eb;">${r.responsavel_nome || 'Sistema'}</td>
                <td><span class="${tipoClass}">${r.tipo_movimento}</span></td>
                <td>${r.catalogo?.nome}</td>
                <td>${r.catalogo?.categoria || '-'}</td>
                <td style="font-weight:bold;">${r.quantidade}</td>
                <td style="font-size:0.9em;">${r.observacao || ''}</td>
            </tr>`;
        });
    }
    else if (tabName === 'patrimonio') {
        headers = ['Plaqueta', 'Item', 'Local Atual', 'Conservação'];
        data.forEach(r => { 
            const local = r.unidades?.nome || '<span style="color:red">Sem Local</span>';
            let estadoDisplay = r.inservivel ? 'INSERVÍVEL' : r.estado_conservacao;
            rows += `<tr data-id="${r.id}"><td>${r.codigo_patrimonio}</td><td>${r.catalogo?.nome}</td><td>${local}</td><td>${estadoDisplay}</td></tr>`; 
        });
    }
    else if (tabName === 'pedidos') {
        headers = ['ID', 'Destino', 'Data', 'Status'];
        data.forEach(r => {
            rows += `<tr data-id="${r.id}"><td>#${r.id}</td><td>${r.unidades?.nome}</td><td>${new Date(r.data_solicitacao).toLocaleDateString()}</td><td>${r.status}</td></tr>`;
        });
    }

    return `<table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

function setupTableEvents(tabName) {
    const table = document.querySelector('.data-table');
    if(table) {
        table.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            if(tr && tr.dataset.id) {
                document.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                selectedRowId = tr.dataset.id;
            }
        });
    }
    
    // Listener específico para Inservível
    const btnInservivel = document.getElementById('btn-marcar-inservivel');
    if (btnInservivel) {
        btnInservivel.onclick = async () => {
            if(!selectedRowId) return alert('Selecione um item da lista.');
            if(!confirm('Tem certeza que deseja marcar este item como INSERVÍVEL?')) return;
            try {
                await supabase.from('patrimonio').update({ inservivel: true }).eq('id', selectedRowId);
                alert('Item atualizado.');
                window.renderTab('patrimonio');
            } catch(e) { alert('Erro: ' + e.message); }
        };
    }
    
    // Listener específico para Pedidos
    const btnVerPedido = document.getElementById('btn-ver-pedido');
    if(btnVerPedido) {
        btnVerPedido.onclick = () => {
            if(!selectedRowId) return alert('Selecione um pedido.');
            window.openModalGerenciarPedido(selectedRowId);
        };
    }
}

// ============================================================================
// PARTE 5: MODAL DE CONFIGURAÇÕES (SUB-ABAS)
// ============================================================================

async function renderSubTabCatalogo() {
    const area = document.getElementById("config-content-area");
    area.innerHTML = "<p>Carregando...</p>";
    const { data, error } = await supabase.from("catalogo").select("*").order("nome");
    if (error) return area.innerHTML = "Erro ao carregar catálogo.";

    let html = `<h3>Catálogo <button class="btn-confirmar" onclick="window.openModalAddCatalogo()" style="float:right">+ Novo Produto</button></h3>`;
    html += `<table class="table-config" style="width:100%"><thead><tr><th>Nome</th><th>Tipo</th><th>Ativo</th><th>Ações</th></tr></thead><tbody>`;
    
    data.forEach(item => {
        html += `<tr><td>${item.nome}</td><td>${item.tipo}</td><td>${item.ativo?'Sim':'Não'}</td>
        <td><button class="btn-cancelar" onclick="window.deleteCatalogo(${item.id})">Excluir</button></td></tr>`;
    });
    html += "</tbody></table>";
    area.innerHTML = html;
}

async function renderSubTabCategorias() {
    const area = document.getElementById("config-content-area");
    area.innerHTML = "<p>Carregando...</p>";
    const { data } = await supabase.from("categorias").select("*").order("nome");
    
    let html = `<h3>Categorias <button class="btn-confirmar" onclick="window.openModalAddCategoria()" style="float:right">+ Nova</button></h3>`;
    html += `<table class="table-config" style="width:100%"><thead><tr><th>Nome</th><th>Ações</th></tr></thead><tbody>`;
    if(data) {
        data.forEach(c => {
            html += `<tr><td>${c.nome}</td><td><button class="btn-cancelar" onclick="window.deleteGeneric('categorias', ${c.id})">Excluir</button></td></tr>`;
        });
    }
    html += "</tbody></table>";
    area.innerHTML = html;
}

async function renderSubTabLocais() {
    const area = document.getElementById("config-content-area");
    const { data } = await supabase.from("unidades").select("*").order("nome"); // Usando tabela 'unidades' como locais
    
    let html = `<h3>Locais/Unidades <button class="btn-confirmar" onclick="window.openModalCadastro('unidades')" style="float:right">+ Nova</button></h3>`;
    html += `<table class="table-config" style="width:100%"><thead><tr><th>Nome</th><th>Resp.</th></tr></thead><tbody>`;
    if(data) {
        data.forEach(u => {
            html += `<tr><td>${u.nome}</td><td>${u.responsavel||'-'}</td></tr>`;
        });
    }
    html += "</tbody></table>";
    area.innerHTML = html;
}

async function renderSubTabUsuarios() {
    const area = document.getElementById("config-content-area");
    // Filtra apenas o usuário logado usando currentUserId
    const { data } = await supabase.from("usuarios").select("*").eq("id", currentUserId);
    
    let html = `<h3>Meus Dados <button class="btn-confirmar" onclick="window.modalAlterarSenha()" style="float:right; background-color:#f59e0b;">Alterar Senha</button></h3>`;
    html += `<table class="table-config" style="width:100%"><thead><tr><th>Nome</th><th>Email</th><th>Nível</th></tr></thead><tbody>`;
    
    if(data && data.length > 0) {
        data.forEach(u => {
            html += `<tr><td>${u.nome_completo}</td><td>${u.email}</td><td>${u.nivel_acesso}</td></tr>`;
        });
    } else {
         html += `<tr><td colspan="3">Usuário não encontrado.</td></tr>`;
    }
    html += "</tbody></table>";
    area.innerHTML = html;
}

async function renderSubTabTamanhosRoupas() {
    const area = document.getElementById("config-content-area");
    const { data } = await supabase.from("tamanhos_roupas").select("*").order("ordem");
    
    // Adicionado botão + Novo
    let html = `<h3>Tamanhos (Roupas) <button class="btn-confirmar" onclick="window.addTamanhoRoupa()" style="float:right">+ Novo</button></h3>`;
    html += `<table class="table-config" style="width:100%"><thead><tr><th>Tamanho</th><th>Ordem</th><th>Ação</th></tr></thead><tbody>`;
    
    if(data) {
        data.forEach(t => {
            html += `<tr>
                <td>${t.tamanho}</td>
                <td>${t.ordem}</td>
                <td><button class="btn-cancelar" onclick="window.deleteGeneric('tamanhos_roupas', ${t.id})">Excluir</button></td>
            </tr>`;
        });
    }
    html += `</tbody></table>`;
    area.innerHTML = html;
}

async function renderSubTabTamanhosCalcados() {
    const area = document.getElementById("config-content-area");
    const { data } = await supabase.from("tamanhos_calcados").select("*").order("ordem");
    
    // Adicionado botão + Novo
    let html = `<h3>Tamanhos (Calçados) <button class="btn-confirmar" onclick="window.addTamanhoCalcado()" style="float:right">+ Novo</button></h3>`;
    html += `<table class="table-config" style="width:100%"><thead><tr><th>Número</th><th>Ordem</th><th>Ação</th></tr></thead><tbody>`;
    
    if(data) {
        data.forEach(t => {
            html += `<tr>
                <td>${t.numero}</td>
                <td>${t.ordem}</td>
                <td><button class="btn-cancelar" onclick="window.deleteGeneric('tamanhos_calcados', ${t.id})">Excluir</button></td>
            </tr>`;
        });
    }
    html += `</tbody></table>`;
    area.innerHTML = html;
}
// ============================================================================
// PARTE 6: AÇÕES DE CONFIGURAÇÃO (CRUD)
// ============================================================================

window.openModalAddCatalogo = async function() {
    const modalContent = document.getElementById("modal-content-area");
    const modal = document.getElementById("global-modal");
    
    // Feedback visual enquanto carrega as categorias
    modalContent.innerHTML = '<p style="text-align:center; padding:20px;">Carregando categorias...</p>';
    modal.style.display = "block";

    try {
        // 1. Busca as categorias cadastradas para preencher o Select
        // Consultamos a tabela 'categorias' 
        const { data: listaCategorias, error } = await supabase
            .from("categorias")
            .select("nome")
            .order("nome");

        if (error) throw error;

        // Monta as opções do select de categorias
        let opcoesCategorias = '<option value="">Selecione uma categoria...</option>';
        if (listaCategorias && listaCategorias.length > 0) {
            listaCategorias.forEach(cat => {
                // Como o campo 'categoria' na tabela 'catalogo' é TEXTO[cite: 6],
                // usamos o nome tanto no value quanto no texto.
                opcoesCategorias += `<option value="${cat.nome}">${cat.nome}</option>`;
            });
        } else {
            opcoesCategorias += '<option value="">Nenhuma categoria cadastrada</option>';
        }

        // 2. Renderiza o HTML do modal
        // NOTA: Os values do 'novo-tipo' foram alterados para minúsculas para corrigir o erro do ENUM.
        modalContent.innerHTML = `
            <h3>Adicionar Produto</h3>
            
            <label>Nome:</label>
            <input id="novo-nome" style="width:100%" placeholder="Ex: Caneta Azul">
            
            <label>Tipo:</label>
            <select id="novo-tipo" style="width:100%">
                <option value="consumo">Consumo (Material de Escritório, Limpeza...)</option>
                <option value="permanente">Permanente (Móveis, Eletrônicos...)</option>
                <option value="UNIFORMES ROUPAS">Uniformes Roupas</option>
                <option value="UNIFORMES CALÇADOS">Uniformes Calçados</option>
            </select>
            
            <label>Categoria:</label>
            <select id="novo-cat" style="width:100%">
                ${opcoesCategorias}
            </select>
            
            <label>Unidade de Medida:</label>
            <input id="novo-unid" placeholder="Ex: UN, CX, PCT, KG" style="width:100%">
            
            <label>Estoque Mínimo:</label>
            <input type="number" id="novo-min" value="0">
            
            <div style="margin-top:15px; text-align:right">
                <button class="btn-confirmar" onclick="window.salvarNovoProduto()">Salvar</button>
            </div>
        `;

    } catch (e) {
        console.error(e);
        modalContent.innerHTML = `<p style="color:red; padding:20px;">Erro ao carregar formulário: ${e.message}</p>`;
    }
}

window.salvarNovoProduto = async function() {
    // Pegamos os valores brutos dos inputs
    const nomeRaw = document.getElementById("novo-nome").value;
    const tipo = document.getElementById("novo-tipo").value; // Este valor DEVE ser minúsculo (vem do value do option)
    const catRaw = document.getElementById("novo-cat").value;
    const unidRaw = document.getElementById("novo-unid").value;
    const min = document.getElementById("novo-min").value;

    // Validações básicas
    if(!nomeRaw) return alert("Preencha o nome do produto.");
    if(!catRaw) return alert("Selecione uma categoria.");
    if(!unidRaw && tipo === 'consumo') return alert("Preencha a unidade de medida.");

    // --- AQUI ACONTECE A PADRONIZAÇÃO ---
    // Convertemos textos livres para Maiúsculo
    // Mantemos 'tipo' inalterado pois é um ENUM de controle do banco
    const payload = {
        nome: nomeRaw.toUpperCase(),            // Ex: "caneta" vira "CANETA"
        tipo: tipo,                             // Mantém "consumo" (minúsculo) para não dar erro no banco
        categoria: catRaw.toUpperCase(),        // Garante que a categoria salva no texto seja maiúscula
        unidade_medida: unidRaw ? unidRaw.toUpperCase() : null, // Ex: "un" vira "UN"
        estoque_minimo: parseInt(min) || 0,
        ativo: true 
    };

    try {
        const { data, error } = await supabase
            .from("catalogo")
            .insert([payload])
            .select()
            .single();

        if(error) throw error;

        // Se não for permanente, cria o registro na tabela de estoque
        if (tipo !== 'permanente') {
            await criarProdutoNoEstoque(data);
        }
        
        alert("Produto criado com sucesso!");
        window.closeModal();
        
        // Atualiza a tela
        if (typeof window.renderTab === 'function') window.renderTab('catalogo'); 
        
        // Atualiza a lista na config se estiver aberta
        const areaConfig = document.getElementById("config-content-area");
        if (areaConfig && areaConfig.offsetParent !== null) {
            window.navegarConfig('catalogo');
        }

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
        console.error(e);
    }
}

window.deleteCatalogo = async function(id) {
    if(!confirm("Tem certeza? Isso apagará o item.")) return;
    // Validações de segurança omitidas para brevidade, mas devem existir
    const { error } = await supabase.from("catalogo").delete().eq("id", id);
    if(error) alert("Erro ao apagar: " + error.message);
    else window.navegarConfig('catalogo');
}

window.openModalAddCategoria = function() {
    const val = prompt("Nome da nova categoria:");
    if(val) {
        // Força maiúscula ao criar a categoria
        supabase.from("categorias")
            .insert([{ nome: val.toUpperCase() }]) 
            .then(({ error }) => {
                if(error) alert("Erro: " + error.message);
                else window.navegarConfig('categorias');
            });
    }
}

// --- NOVAS FUNÇÕES DE CONFIGURAÇÃO ---

// Correção Item D: Função que faltava para abrir modal de Locais (Unidades)
window.openModalCadastro = function(tipo) {
    if (tipo === 'unidades') {
        const modal = document.getElementById("global-modal");
        const content = document.getElementById("modal-content-area");
        
        content.innerHTML = `
            <h3>Nova Unidade / Local</h3>
            <label>Nome do Local:</label>
            <input type="text" id="nova-unidade-nome" placeholder="Ex: Almoxarifado Central">
            <label>Responsável (Opcional):</label>
            <input type="text" id="nova-unidade-resp">
            
            <div style="margin-top:15px; text-align:right">
                <button class="btn-confirmar" onclick="window.salvarNovaUnidade()">Salvar</button>
            </div>
        `;
        modal.style.display = 'block';
    }
    // Adicione outros 'else if' aqui se precisar usar essa função para outros cadastros
}

window.salvarNovaUnidade = async function() {
    const nome = document.getElementById("nova-unidade-nome").value;
    const resp = document.getElementById("nova-unidade-resp").value;
    
    if(!nome) return alert("O nome da unidade é obrigatório.");

    const { error } = await supabase.from("unidades").insert([{ nome: nome, responsavel: resp }]);
    
    if(error) alert("Erro ao salvar: " + error.message);
    else {
        alert("Local salvo com sucesso!");
        window.closeModal();
        window.navegarConfig('locais');
    }
}

// Para Item A: Alterar Senha
window.modalAlterarSenha = function() {
    const novaSenha = prompt("Digite a nova senha (mínimo 6 caracteres):");
    if(!novaSenha) return;
    if(novaSenha.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");

    // Atualiza a senha no Supabase Auth
    supabase.auth.updateUser({ password: novaSenha })
        .then(({ data, error }) => {
            if(error) alert("Erro ao alterar senha: " + error.message);
            else alert("Senha alterada com sucesso!");
        });
}

// Para Item B: Adicionar Tamanho Roupa
window.addTamanhoRoupa = async function() {
    // Usamos prompt simples para agilizar, mas poderia ser um modal customizado
    const tam = prompt("Digite a sigla do tamanho (Ex: G, GG):");
    if(!tam) return;
    const ordem = prompt("Digite a ordem de exibição (número inteiro, ex: 1, 2, 3):");
    if(!ordem) return;

    const { error } = await supabase.from("tamanhos_roupas").insert([{ 
        tamanho: tam.toUpperCase(), 
        ordem: parseInt(ordem) 
    }]);

    if(error) alert("Erro: " + error.message);
    else window.navegarConfig('tamanhos_roupas');
}

// Para Item C: Adicionar Tamanho Calçado
window.addTamanhoCalcado = async function() {
    const num = prompt("Digite o número (Ex: 38, 40):");
    if(!num) return;
    const ordem = prompt("Digite a ordem de exibição (número inteiro):");
    if(!ordem) return;

    const { error } = await supabase.from("tamanhos_calcados").insert([{ 
        numero: parseInt(num), 
        ordem: parseInt(ordem) 
    }]);

    if(error) alert("Erro: " + error.message);
    else window.navegarConfig('tamanhos_calcados');
}



window.deleteGeneric = async function(table, id) {
    if(confirm("Apagar item?")) {
        await supabase.from(table).delete().eq("id", id);
        // Recarrega a aba atual (simplificado)
        alert("Apagado.");
    }
}

// Lógica de sincronização com estoque
async function criarProdutoNoEstoque(produto) {
    // CORREÇÃO: Verifica se é 'consumo' (minúsculo) OU 'CONSUMO' (maiúsculo)
    if (produto.tipo === "consumo" || produto.tipo === "CONSUMO") {
        await supabase.from("estoque_consumo").insert([{ produto_id: produto.id, quantidade_atual: 0 }]);
    }
    // Para uniformes, cria a grade de tamanhos
    else if (produto.tipo === "UNIFORMES ROUPAS") {
        const { data: tams } = await supabase.from("tamanhos_roupas").select("*");
        if(tams) {
            for (let t of tams) {
                await supabase.from("estoque_tamanhos").insert([{ produto_id: produto.id, tamanho: t.tamanho, quantidade: 0 }]);
            }
        }
    }
    else if (produto.tipo === "UNIFORMES CALÇADOS") {
        const { data: nums } = await supabase.from("tamanhos_calcados").select("*");
        if(nums) {
            for (let n of nums) {
                await supabase.from("estoque_tamanhos").insert([{ produto_id: produto.id, tamanho: String(n.numero), quantidade: 0 }]);
            }
        }
    }
}

// ============================================================================
// PARTE 7: UNIFORMES ROUPAS
// ============================================================================

window.renderTabUniformesRoupas = async function() {
    const tab = document.getElementById("tab-content");
    
    // 1. Estrutura Base (Cabeçalho Vazio para preencher dinamicamente)
    tab.innerHTML = `
        <div class="uniformes-container">
            <div class="uniformes-header">
                <h2><i class="fas fa-tshirt"></i> Uniformes — Roupas</h2>
            </div>
            <div class="uniformes-lista-produtos" style="overflow-x:auto;">
                <table class="uniformes-table data-table">
                    <thead>
                        <tr id="header-roupas">
                            <th>Produto</th>
                            </tr>
                    </thead>
                    <tbody id="lista-uniformes-roupas"><tr><td colspan="5">Carregando...</td></tr></tbody>
                </table>
            </div>
        </div>`;

    const theadRow = document.getElementById("header-roupas");
    const corpo = document.getElementById("lista-uniformes-roupas");
    
    // 2. Buscas no Banco de Dados (Produtos + Tamanhos Personalizados + Estoque)
    const { data: produtos } = await supabase.from("catalogo").select("*").eq("tipo", "UNIFORMES ROUPAS").order("nome");
    const { data: tamanhosDb } = await supabase.from("tamanhos_roupas").select("*").order("ordem");
    const { data: estoque } = await supabase.from("estoque_tamanhos").select("*");
    
    // Validação se não houver tamanhos ou produtos
    if (!tamanhosDb || tamanhosDb.length === 0) {
        corpo.innerHTML = "<tr><td colspan='5'>Nenhum tamanho de roupa cadastrado nas configurações.</td></tr>";
        return;
    }
    
    // 3. Montar Cabeçalho Dinamicamente (Baseado no seu cadastro)
    tamanhosDb.forEach(t => {
        const th = document.createElement("th");
        th.innerText = t.tamanho;
        theadRow.appendChild(th);
    });
    // Adiciona colunas finais
    const thTotal = document.createElement("th"); thTotal.innerText = "Total"; theadRow.appendChild(thTotal);
    const thAcoes = document.createElement("th"); thAcoes.innerText = "Ações"; theadRow.appendChild(thAcoes);

    if (!produtos || produtos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="${tamanhosDb.length + 3}">Nenhum uniforme cadastrado.</td></tr>`;
        return;
    }

    corpo.innerHTML = "";

    // 4. Montar Linhas dos Produtos
    produtos.forEach(prod => {
        const tr = document.createElement("tr");
        let htmlLinha = `<td>${prod.nome}</td>`;
        
        // Filtra estoque deste produto
        const estProd = estoque.filter(e => e.produto_id === prod.id);
        let somaTotal = 0;

        // Loop pelos tamanhos cadastrados (e não os fixos)
        tamanhosDb.forEach(t => {
            // Busca a quantidade para este tamanho específico
            const itemEstoque = estProd.find(e => e.tamanho === t.tamanho);
            const qtd = itemEstoque ? itemEstoque.quantidade : 0;
            somaTotal += qtd;
            
            htmlLinha += `<td>${qtd}</td>`;
        });

        // Colunas finais
        htmlLinha += `<td style="font-weight:bold">${somaTotal}</td>`;
        htmlLinha += `
            <td>
                <button onclick="window.modalMovimentoUniforme(${prod.id}, 'entrada', 'roupas')"><i class="fas fa-plus"></i></button>
                <button onclick="window.modalMovimentoUniforme(${prod.id}, 'saida', 'roupas')"><i class="fas fa-minus"></i></button>
            </td>
        `;
        
        tr.innerHTML = htmlLinha;
        corpo.appendChild(tr);
    });
}

window.modalMovimentoUniforme = async function(prodId, tipo, categoria) {
    const modal = document.getElementById("global-modal");
    const content = document.getElementById("modal-content-area");
    
    content.innerHTML = "<p>Carregando dados...</p>";
    modal.style.display = 'block';

    // Busca nome do produto
    const { data: p } = await supabase.from("catalogo").select("nome").eq("id", prodId).single();
    
    // Define lista de opções buscando do banco
    let opcoesHtml = "";
    
    if (categoria === 'roupas') {
        const { data: tRoupas } = await supabase.from("tamanhos_roupas").select("tamanho").order("ordem");
        if(tRoupas) {
            opcoesHtml = tRoupas.map(t => `<option value="${t.tamanho}">${t.tamanho}</option>`).join('');
        }
    } else {
        // Lógica para calçados
        const { data: tCalcados } = await supabase.from("tamanhos_calcados").select("numero").order("ordem");
        if(tCalcados) {
            opcoesHtml = tCalcados.map(t => `<option value="${t.numero}">${t.numero}</option>`).join('');
        }
    }

    content.innerHTML = `
        <h3>${tipo === 'entrada' ? 'Entrada' : 'Saída'}: ${p.nome}</h3>
        <label>Tamanho / Número:</label>
        <select id="uni-tam">
            ${opcoesHtml}
        </select>
        <label>Quantidade:</label>
        <input type="number" id="uni-qtd" value="1" min="1">
        <div style="margin-top:15px; text-align:right">
            <button class="btn-confirmar" onclick="window.confirmarMovimentoUniforme(${prodId}, '${tipo}', '${categoria}')">Confirmar</button>
        </div>
    `;
}

window.confirmarMovimentoUniforme = async function(prodId, tipo, categoria) {
    const tam = document.getElementById("uni-tam").value;
    const qtd = parseInt(document.getElementById("uni-qtd").value);
    
    if(!qtd || qtd <= 0) return alert("Quantidade inválida");

    // Busca registro atual
    const { data: reg } = await supabase.from("estoque_tamanhos")
        .select("*").eq("produto_id", prodId).eq("tamanho", tam).single();

    let novaQtd = 0;
    let atual = reg ? reg.quantidade : 0;

    if (tipo === 'entrada') novaQtd = atual + qtd;
    else {
        if (atual < qtd) return alert("Saldo insuficiente!");
        novaQtd = atual - qtd;
    }

    // Atualiza ou Insere
    if (reg) {
        await supabase.from("estoque_tamanhos").update({ quantidade: novaQtd }).eq("id", reg.id);
    } else {
        await supabase.from("estoque_tamanhos").insert({ produto_id: prodId, tamanho: tam, quantidade: novaQtd });
    }

    // Histórico
    await registrarHistorico(prodId, qtd, tipo + '_uniforme', `Tamanho: ${tam}`, userProfile?.nome || 'Sistema');

    alert("Sucesso!");
    window.closeModal();
    if(categoria === 'roupas') window.renderTabUniformesRoupas();
    else window.renderTabUniformesCalcados();
}

// ============================================================================
// PARTE 8: UNIFORMES CALÇADOS
// ============================================================================

window.renderTabUniformesCalcados = async function() {
    const tab = document.getElementById("tab-content");
    
    // 1. Estrutura básica
    tab.innerHTML = `
        <div class="uniformes-container">
            <div class="uniformes-header"><h2><i class="fas fa-shoe-prints"></i> Uniformes — Calçados</h2></div>
            <div style="overflow-x:auto;">
                <table class="uniformes-table data-table" id="table-calcados">
                    <thead><tr id="head-calcados"><th>Produto</th></tr></thead>
                    <tbody id="body-calcados"></tbody>
                </table>
            </div>
        </div>
    `;

    const theadRow = document.getElementById("head-calcados");
    const tbody = document.getElementById("body-calcados");

    // 2. Busca dados
    const { data: produtos } = await supabase.from("catalogo").select("*").eq("tipo", "UNIFORMES CALÇADOS").order("nome"); // Lembre-se de ajustar se mudou para minúsculo
    const { data: tamanhos } = await supabase.from("tamanhos_calcados").select("*").order("ordem");
    const { data: estoque } = await supabase.from("estoque_tamanhos").select("*");

    if(!tamanhos || tamanhos.length === 0) return tbody.innerHTML = "<tr><td>Sem tamanhos cadastrados.</td></tr>";

    // 3. Monta cabeçalho dinâmico
    tamanhos.forEach(t => {
        const th = document.createElement("th");
        th.innerText = t.numero;
        theadRow.appendChild(th);
    });
    
    // --- ADIÇÃO 1: Coluna Total no Cabeçalho ---
    const thTotal = document.createElement("th"); 
    thTotal.innerText = "Total"; 
    theadRow.appendChild(thTotal);
    // -------------------------------------------

    // Coluna Ações
    const thAction = document.createElement("th"); thAction.innerText = "Ações"; theadRow.appendChild(thAction);

    // 4. Monta linhas
    produtos.forEach(prod => {
        const tr = document.createElement("tr");
        let html = `<td>${prod.nome}</td>`;
        
        const estProd = estoque.filter(e => e.produto_id === prod.id);
        let totalLinha = 0; // Variável para somar a linha
        
        tamanhos.forEach(t => {
            const item = estProd.find(e => e.tamanho == t.numero); 
            const q = item ? item.quantidade : 0;
            
            totalLinha += q; // Soma ao total
            html += `<td>${q}</td>`;
        });

        // --- ADIÇÃO 2: Célula com o Total da Linha ---
        html += `<td style="font-weight:bold; background-color: #f8fafc;">${totalLinha}</td>`;
        // ---------------------------------------------

        html += `<td>
            <button onclick="window.modalMovimentoUniforme(${prod.id}, 'entrada', 'calcados')"><i class="fas fa-plus"></i></button>
            <button onclick="window.modalMovimentoUniforme(${prod.id}, 'saida', 'calcados')"><i class="fas fa-minus"></i></button>
        </td>`;
        
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// ============================================================================
// PARTE 9: MODAIS OPERACIONAIS GERAIS
// ============================================================================

window.openModalEntrada = async function(filtroTipo) {
    const modal = document.getElementById("global-modal");
    const content = document.getElementById("modal-content-area");

    let query = supabase.from('catalogo').select('id, nome, tipo, unidade_medida').order('nome');
    if (filtroTipo) query = query.eq('tipo', filtroTipo);
    const { data: produtos } = await query;
    const { data: locais } = await supabase.from('unidades').select('*').order('nome');

    content.innerHTML = `
        <h3>Nova Entrada</h3>
        <label>Produto:</label>
        <select id="ent-prod">
            <option value="">Selecione</option>
            ${produtos.map(p => `<option value="${p.id}" data-tipo="${p.tipo}">${p.nome}</option>`).join('')}
        </select>
        
        <div id="area-extra"></div>
        
        <label>Quantidade:</label><input type="number" id="ent-qtd" value="1">
        <label>Local/Destino (Opcional):</label>
        <select id="ent-local"><option value="">Estoque Central</option>${locais.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('')}</select>
        
        <label>Obs/Nota:</label><input type="text" id="ent-obs">

        <div style="margin-top:15px; text-align:right">
            <button class="btn-confirmar" onclick="window.confirmarEntradaGeral()">Confirmar</button>
        </div>
    `;
    modal.style.display = 'block';
}

window.confirmarEntradaGeral = async function() {
    const prodSelect = document.getElementById("ent-prod");
    const prodId = prodSelect.value;
    
    // --- CORREÇÃO PRINCIPAL ---
    // Adicionamos .toUpperCase() para garantir que 'permanente' vire 'PERMANENTE'
    // e entre no IF correto abaixo.
    const tipoRaw = prodSelect.options[prodSelect.selectedIndex].dataset.tipo;
    const tipo = tipoRaw ? tipoRaw.toUpperCase() : ''; 
    // --------------------------

    const qtd = parseInt(document.getElementById("ent-qtd").value);
    const local = document.getElementById("ent-local").value;
    const obs = document.getElementById("ent-obs").value;

    if(!prodId || qtd <= 0) return alert("Dados inválidos.");

    // Lógica Consumo
    if(tipo === 'CONSUMO') {
        const { data: reg } = await supabase.from("estoque_consumo").select("*").eq("produto_id", prodId).single();
        if(reg) {
            await supabase.from("estoque_consumo").update({ quantidade_atual: reg.quantidade_atual + qtd }).eq("id", reg.id);
        } else {
            await supabase.from("estoque_consumo").insert({ produto_id: prodId, quantidade_atual: qtd });
        }
    }
    // Lógica Patrimônio
    else if(tipo === 'PERMANENTE') {
        // Agora o código entrará aqui corretamente!
        
        // Loop para cadastrar a quantidade solicitada (se for mais de 1 item, pede plaqueta pra cada um)
        for (let i = 0; i < qtd; i++) {
            let msg = qtd > 1 ? `Informe a plaqueta do item ${i+1} de ${qtd}:` : "Informe o número da plaqueta/patrimônio:";
            const plaqueta = prompt(msg);
            
            if(!plaqueta) {
                alert("Plaqueta obrigatória. Operação cancelada parcialmente.");
                break; 
            }

            const { error } = await supabase.from("patrimonio").insert({
                produto_id: prodId,
                codigo_patrimonio: plaqueta,
                unidade_id: local || null,
                // estado_conservacao removido
                inservivel: false
            });
            
            if(error) {
                console.error(error);
                alert("Erro ao salvar patrimônio: " + error.message);
            }
        }
    }

    // Grava histórico
    await registrarHistorico(prodId, qtd, 'entrada', obs, userProfile?.nome, local);
    
    alert("Entrada realizada!");
    window.closeModal();
    
    // Atualiza a tela que você está vendo agora
    if(typeof activeTab !== 'undefined') window.renderTab(activeTab);
}

window.openModalSaidaRapida = async function() {
    const modal = document.getElementById("global-modal");
    const content = document.getElementById("modal-content-area");
    
    // Busca itens com saldo > 0
    const { data: itens } = await supabase.from("estoque_consumo")
        .select("id, quantidade_atual, catalogo(nome, id)").gt("quantidade_atual", 0);

    content.innerHTML = `
        <h3>Saída Rápida (Consumo)</h3>
        <label>Item:</label>
        <select id="sai-id">
            ${itens.map(i => `<option value="${i.id}" data-prod="${i.catalogo.id}">${i.catalogo.nome} (Saldo: ${i.quantidade_atual})</option>`).join('')}
        </select>
        <label>Quantidade:</label><input type="number" id="sai-qtd" value="1">
        <label>Responsável/Setor:</label><input type="text" id="sai-resp">
        <div style="margin-top:15px; text-align:right">
            <button class="btn-confirmar" onclick="window.confirmarSaidaRapida()">Baixar</button>
        </div>
    `;
    modal.style.display = 'block';
}

window.confirmarSaidaRapida = async function() {
    const idEstoque = document.getElementById("sai-id").value;
    const prodId = document.getElementById("sai-id").options[document.getElementById("sai-id").selectedIndex].dataset.prod;
    const qtd = parseInt(document.getElementById("sai-qtd").value);
    // Se o campo estiver vazio, usa o nome do usuário logado
    const resp = document.getElementById("sai-resp").value || userProfile?.nome || 'Usuário';

    const { data: item } = await supabase.from("estoque_consumo").select("quantidade_atual").eq("id", idEstoque).single();
    
    if(item.quantidade_atual < qtd) return alert("Saldo insuficiente.");

    await supabase.from("estoque_consumo").update({ quantidade_atual: item.quantidade_atual - qtd }).eq("id", idEstoque);
    await registrarHistorico(prodId, qtd, 'saida_consumo', 'Saída Rápida', resp);
    
    alert("Saída registrada.");
    window.closeModal();
    window.renderTab("estoque_consumo");
}

window.openModalMovimentarPatrimonio = async function() {
    const modal = document.getElementById("global-modal");
    const content = document.getElementById("modal-content-area");
    
    const { data: itens } = await supabase.from("patrimonio").select("id, codigo_patrimonio, catalogo(nome), unidades(nome)");
    const { data: locais } = await supabase.from("unidades").select("id, nome");

    content.innerHTML = `
        <h3>Movimentar Patrimônio</h3>
        <label>Item:</label>
        <select id="mov-pat-id">
            ${itens.map(i => `<option value="${i.id}">${i.codigo_patrimonio} - ${i.catalogo.nome} (${i.unidades?.nome})</option>`).join('')}
        </select>
        <label>Novo Local:</label>
        <select id="mov-pat-dest">
            ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
        </select>
        <button class="btn-confirmar" onclick="window.confirmarMovPatrimonio()">Mover</button>
    `;
    modal.style.display = 'block';
}

window.confirmarMovPatrimonio = async function() {
    const id = document.getElementById("mov-pat-id").value;
    const dest = document.getElementById("mov-pat-dest").value;
    
    await supabase.from("patrimonio").update({ unidade_id: dest }).eq("id", id);
    alert("Movimentado.");
    window.closeModal();
    window.renderTab("patrimonio");
}

// PEDIDOS
// 1. Abrir Modal de Criação (Permite selecionar vários itens)
window.openModalCriarPedido = async function() {
    const modal = document.getElementById("global-modal");
    const content = document.getElementById("modal-content-area");
    
    // Reseta lista temporária
    itensPedidoTemporario = [];

    content.innerHTML = '<p style="padding:20px; text-align:center;">Carregando produtos e locais...</p>';
    modal.style.display = 'block';

    try {
        const { data: locais } = await supabase.from('unidades').select('*').order('nome');
        
        // Busca todos os produtos ativos que não são permanentes
        const { data: produtos, error } = await supabase.from('catalogo')
            .select('*')
            .neq('tipo', 'permanente') 
            .eq('ativo', true)
            .order('nome');

        if (error) throw error;

        // SEPARAÇÃO DOS PRODUTOS EM ARRAYS
        const roupas = produtos.filter(p => p.tipo === 'UNIFORMES ROUPAS');
        const calcados = produtos.filter(p => p.tipo === 'UNIFORMES CALÇADOS');
        // Filtra tanto maiúsculo quanto minúsculo para garantir
        const materiais = produtos.filter(p => p.tipo === 'CONSUMO' || p.tipo === 'consumo');

        let html = `
            <h3><i class="fas fa-cart-plus"></i> Novo Pedido de Saída</h3>
            
            <div style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #e2e8f0;">
                <label><strong>1. Destino da Mercadoria:</strong></label>
                <select id="ped-destino" style="width:100%; margin-bottom:0;">
                    <option value="">Selecione o Local / Unidade...</option>
                    ${locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('')}
                </select>
            </div>

            <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                
                <div class="pedido-section" style="border: 1px solid #bae6fd; background: #f0f9ff; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                    <h4 style="margin-top:0; color: #0284c7;"><i class="fas fa-tshirt"></i> 1. Uniformes - Roupas</h4>
                    <div style="display:flex; gap:5px; align-items:flex-end;">
                        <div style="flex:3;">
                            <small>Produto:</small>
                            <select id="sel-roupa-prod" onchange="window.verificarEstoqueSimples('roupa')" style="width:100%; margin-bottom:0">
                                <option value="">Selecione a Roupa...</option>
                                ${roupas.map(p => `<option value="${p.id}" data-nome="${p.nome}">${p.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex:1.5;">
                            <small>Tam:</small>
                            <select id="sel-roupa-tam" style="width:100%; margin-bottom:0">
                                <option value="">-</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <small>Qtd:</small>
                            <input type="number" id="qtd-roupa" min="1" placeholder="0" style="margin-bottom:0">
                        </div>
                        <button onclick="window.adicionarItemAoPedido('roupa')" style="background:#0284c7; color:white; height:38px; width:40px;"><i class="fas fa-plus"></i></button>
                    </div>
                    <small id="msg-estoque-roupa" style="color:#64748b; font-weight:bold; display:block; margin-top:5px;">Estoque: -</small>
                </div>

                <div class="pedido-section" style="border: 1px solid #cbd5e1; background: #f1f5f9; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                    <h4 style="margin-top:0; color: #475569;"><i class="fas fa-shoe-prints"></i> 2. Uniformes - Calçados</h4>
                    <div style="display:flex; gap:5px; align-items:flex-end;">
                        <div style="flex:3;">
                            <small>Produto:</small>
                            <select id="sel-calcado-prod" onchange="window.verificarEstoqueSimples('calcado')" style="width:100%; margin-bottom:0">
                                <option value="">Selecione o Calçado...</option>
                                ${calcados.map(p => `<option value="${p.id}" data-nome="${p.nome}">${p.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex:1.5;">
                            <small>Num:</small>
                            <select id="sel-calcado-tam" style="width:100%; margin-bottom:0">
                                <option value="">-</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <small>Qtd:</small>
                            <input type="number" id="qtd-calcado" min="1" placeholder="0" style="margin-bottom:0">
                        </div>
                        <button onclick="window.adicionarItemAoPedido('calcado')" style="background:#475569; color:white; height:38px; width:40px;"><i class="fas fa-plus"></i></button>
                    </div>
                    <small id="msg-estoque-calcado" style="color:#64748b; font-weight:bold; display:block; margin-top:5px;">Estoque: -</small>
                </div>

                <div class="pedido-section" style="border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                    <h4 style="margin-top:0; color: #15803d;"><i class="fas fa-box-open"></i> 3. Material de Consumo</h4>
                    <div style="display:flex; gap:5px; align-items:flex-end;">
                        <div style="flex:4;">
                            <small>Produto:</small>
                            <select id="sel-consumo-prod" onchange="window.verificarEstoqueSimples('consumo')" style="width:100%; margin-bottom:0">
                                <option value="">Selecione o Material...</option>
                                ${materiais.map(p => `<option value="${p.id}" data-nome="${p.nome}">${p.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex:1;">
                            <small>Qtd:</small>
                            <input type="number" id="qtd-consumo" min="1" placeholder="0" style="margin-bottom:0">
                        </div>
                        <button onclick="window.adicionarItemAoPedido('consumo')" style="background:#15803d; color:white; height:38px; width:40px;"><i class="fas fa-plus"></i></button>
                    </div>
                    <small id="msg-estoque-consumo" style="color:#64748b; font-weight:bold; display:block; margin-top:5px;">Estoque: -</small>
                </div>

            </div>

            <div style="margin-top:15px;">
                <table class="data-table" style="font-size:0.9em;">
                    <thead><tr><th>Produto</th><th>Tam/Num</th><th>Qtd</th><th>Ação</th></tr></thead>
                    <tbody id="lista-itens-pedido">
                        <tr><td colspan="4" style="text-align:center; color:#999;">Nenhum item adicionado.</td></tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top:20px; text-align:right; border-top:1px solid #eee; padding-top:10px;">
                <button class="btn-cancelar" onclick="window.closeModal()" style="margin-right:10px;">Cancelar</button>
                <button class="btn-confirmar" onclick="window.salvarPedidoCompleto()">Confirmar Pedido</button>
            </div>
        `;
        content.innerHTML = html;
    } catch (error) {
        console.error(error); 
        content.innerHTML = `<p style="color:red; padding:20px; text-align:center">Erro ao carregar dados: ${error.message}</p>`;
    }
}

// Função Auxiliar para verificar estoque e preencher tamanhos dinamicamente
window.verificarEstoqueSimples = async function(tipo) {
    const prodSelect = document.getElementById(`sel-${tipo}-prod`);
    const prodId = prodSelect.value;
    const msgElement = document.getElementById(`msg-estoque-${tipo}`);
    
    if (!prodId) {
        msgElement.innerText = "Estoque: -";
        return;
    }

    msgElement.innerText = "Verificando...";

    if (tipo === 'consumo') {
        // Lógica Consumo (sem tamanho)
        const { data } = await supabase.from('estoque_consumo').select('quantidade_atual').eq('produto_id', prodId).single();
        const qtd = data ? data.quantidade_atual : 0;
        msgElement.innerText = `Disponível: ${qtd}`;
        prodSelect.dataset.max = qtd;
    } 
    else {
        // Lógica Roupas ou Calçados (com tamanho)
        const tamSelect = document.getElementById(`sel-${tipo}-tam`);
        tamSelect.innerHTML = '<option value="">Carregando...</option>';
        
        const { data: tams } = await supabase.from('estoque_tamanhos')
            .select('tamanho, quantidade')
            .eq('produto_id', prodId)
            // Se quiser ordenar tamanhos, pode precisar de logica extra, aqui ordena pela criação ou string
            .order('id'); 
            
        if (tams && tams.length > 0) {
            tamSelect.innerHTML = '<option value="">Sel.</option>';
            tams.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.tamanho;
                opt.text = `${t.tamanho} (Disp: ${t.quantidade})`;
                opt.dataset.qtd = t.quantidade;
                tamSelect.appendChild(opt);
            });
            msgElement.innerText = "Selecione o tamanho.";
            
            // Evento ao mudar o tamanho para atualizar max
            tamSelect.onchange = function() {
                const q = this.options[this.selectedIndex].dataset.qtd || 0;
                msgElement.innerText = `Disponível neste tamanho: ${q}`;
            };
        } else {
            tamSelect.innerHTML = '<option value="">Sem estoque</option>';
            msgElement.innerText = "Sem grade cadastrada.";
        }
    }
}

// Função unificada para adicionar itens das 3 seções
window.adicionarItemAoPedido = function(tipo) {
    const prodSelect = document.getElementById(`sel-${tipo}-prod`);
    const qtdInput = document.getElementById(`qtd-${tipo}`);
    const prodId = prodSelect.value;
    const prodNome = prodSelect.options[prodSelect.selectedIndex]?.dataset.nome;
    const qtd = parseInt(qtdInput.value);
    
    let tamanho = null;
    let estoqueMax = 0;

    if (!prodId) return alert("Selecione um produto.");
    if (!qtd || qtd <= 0) return alert("Quantidade inválida.");

    if (tipo === 'consumo') {
        estoqueMax = parseInt(prodSelect.dataset.max) || 0;
    } else {
        const tamSelect = document.getElementById(`sel-${tipo}-tam`);
        tamanho = tamSelect.value;
        if (!tamanho) return alert("Selecione o tamanho/número.");
        estoqueMax = parseInt(tamSelect.options[tamSelect.selectedIndex].dataset.qtd) || 0;
    }

    if (qtd > estoqueMax) return alert(`Quantidade indisponível! Máximo: ${estoqueMax}`);

    // Adiciona ao array global
    itensPedidoTemporario.push({
        produto_id: prodId,
        nome: prodNome,
        tipo_interno: tipo, // 'roupa', 'calcado', 'consumo'
        tipo_produto: (tipo === 'consumo' ? 'CONSUMO' : 'UNIFORME'), // Para controle de baixa
        tamanho: tamanho,
        quantidade: qtd
    });

    renderizarListaItensPedido();
    
    // Limpa campos para nova inserção
    qtdInput.value = "";
    if(tipo !== 'consumo') document.getElementById(`sel-${tipo}-tam`).value = "";
    document.getElementById(`msg-estoque-${tipo}`).innerText = "Item adicionado.";
}

// Renderização da tabela permanece a mesma
function renderizarListaItensPedido() {
    const tbody = document.getElementById("lista-itens-pedido");
    if (itensPedidoTemporario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">Nenhum item.</td></tr>';
        return;
    }
    
    let html = "";
    itensPedidoTemporario.forEach((item, index) => {
        html += `
            <tr>
                <td>${item.nome}</td>
                <td>${item.tamanho || '-'}</td>
                <td>${item.quantidade}</td>
                <td><button class="btn-cancelar" onclick="removerItemLista(${index})" style="padding:2px 8px;">X</button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

window.removerItemLista = function(index) {
    itensPedidoTemporario.splice(index, 1);
    renderizarListaItensPedido();
}

// Auxiliar: Verifica se precisa mostrar select de tamanho e busca estoque
window.verificarOpcoesProduto = async function() {
    const select = document.getElementById("ped-prod-select");
    const option = select.options[select.selectedIndex];
    const tipo = option.dataset.tipo;
    const prodId = select.value;
    
    const selTam = document.getElementById("ped-tam-select");
    const msgEstoque = document.getElementById("ped-estoque-msg");

    if (!prodId) return;

    msgEstoque.innerText = "Verificando estoque...";
    selTam.innerHTML = '<option value="">Tam.</option>';

    if (tipo === 'CONSUMO') {
        selTam.style.display = 'none';
        const { data } = await supabase.from('estoque_consumo').select('quantidade_atual').eq('produto_id', prodId).single();
        const qtd = data ? data.quantidade_atual : 0;
        msgEstoque.innerText = `Estoque disponível: ${qtd}`;
        select.dataset.estoque = qtd; // Guarda no elemento para validação
    } 
    else {
        // Uniformes
        selTam.style.display = 'block';
        const { data: tams } = await supabase.from('estoque_tamanhos').select('tamanho, quantidade').eq('produto_id', prodId);
        
        if (tams && tams.length > 0) {
            msgEstoque.innerText = "Selecione o tamanho para ver o estoque.";
            tams.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.tamanho;
                opt.text = t.tamanho;
                opt.dataset.qtd = t.quantidade;
                selTam.appendChild(opt);
            });
            
            // Evento ao mudar tamanho
            selTam.onchange = function() {
                const q = this.options[this.selectedIndex].dataset.qtd || 0;
                msgEstoque.innerText = `Estoque disponível (Tam ${this.value}): ${q}`;
                select.dataset.estoque = q;
            };
        } else {
            msgEstoque.innerText = "Sem estoque cadastrado.";
        }
    }
}

// Auxiliar: Adiciona item no array temporário
window.adicionarItemLista = function() {
    const prodSelect = document.getElementById("ped-prod-select");
    const tamSelect = document.getElementById("ped-tam-select");
    const qtdInput = document.getElementById("ped-qtd-input");
    
    const prodId = prodSelect.value;
    const prodNome = prodSelect.options[prodSelect.selectedIndex]?.dataset.nome;
    const tipo = prodSelect.options[prodSelect.selectedIndex]?.dataset.tipo;
    const tamanho = (tipo !== 'CONSUMO') ? tamSelect.value : null;
    const estoqueMax = parseInt(prodSelect.dataset.estoque) || 0;
    const qtd = parseInt(qtdInput.value);

    if (!prodId) return alert("Selecione um produto.");
    if (tipo !== 'CONSUMO' && !tamanho) return alert("Selecione o tamanho.");
    if (!qtd || qtd <= 0) return alert("Quantidade inválida.");
    if (qtd > estoqueMax) return alert(`Quantidade indisponível! Máximo: ${estoqueMax}`);

    // Adiciona ao array global
    itensPedidoTemporario.push({
        produto_id: prodId,
        nome: prodNome,
        tipo: tipo,
        tamanho: tamanho,
        quantidade: qtd
    });

    renderizarListaItensPedido();
    
    // Limpa campos
    qtdInput.value = "";
    document.getElementById("ped-estoque-msg").innerText = "Item adicionado.";
}


// 2. Função Principal: Salva Pedido, Baixa Estoque e Gera PDF
window.salvarPedidoCompleto = async function() {
    const destinoSelect = document.getElementById("ped-destino");
    const destinoId = destinoSelect.value;
    const destinoNome = destinoSelect.options[destinoSelect.selectedIndex].text;
    
    if (!destinoId) return alert("Selecione o Local de destino.");
    if (itensPedidoTemporario.length === 0) return alert("Adicione pelo menos um item ao pedido.");

    if (!confirm("Confirma o pedido? O estoque será baixado automaticamente.")) return;

    const btnConfirmar = document.querySelector('.btn-confirmar');
    btnConfirmar.innerText = "Processando...";
    btnConfirmar.disabled = true;

    try {
        // --- CORREÇÃO AQUI: STATUS MINÚSCULO ---
        // Alterado de 'PENDENTE' para 'pendente'
        const { data: pedido, error: errPed } = await supabase
            .from('pedidos')
            .insert([{ 
                unidade_destino_id: destinoId, 
                status: 'pendente', // <--- AQUI ESTAVA O ERRO DO ENUM
                data_solicitacao: new Date(),
                solicitante_id: currentUserId 
            }])
            .select()
            .single();

        if (errPed) throw errPed;

        // B. Loop dos Itens
        for (const item of itensPedidoTemporario) {
            
            // Salva na tabela itens_pedido
            await supabase.from('itens_pedido').insert({
                pedido_id: pedido.id,
                produto_id: item.produto_id,
                quantidade_solicitada: item.quantidade, 
                tamanho: item.tamanho, 
            });

            // Baixa do Estoque
            if (item.tipo_interno === 'consumo') {
                const { data: est } = await supabase.from('estoque_consumo').select('*').eq('produto_id', item.produto_id).single();
                if (est) {
                    await supabase.from('estoque_consumo')
                        .update({ quantidade_atual: est.quantidade_atual - item.quantidade })
                        .eq('id', est.id);
                }
            } else {
                // Uniformes (Roupas ou Calçados)
                const { data: est } = await supabase.from('estoque_tamanhos')
                    .select('*')
                    .eq('produto_id', item.produto_id)
                    .eq('tamanho', item.tamanho)
                    .single();
                if (est) {
                    await supabase.from('estoque_tamanhos')
                        .update({ quantidade: est.quantidade - item.quantidade })
                        .eq('id', est.id);
                }
            }

            // Histórico
            await registrarHistorico(
                item.produto_id, 
                item.quantidade, 
                'SAIDA_PEDIDO', 
                `Pedido #${pedido.id} para ${destinoNome}`, 
                userProfile?.nome,
                destinoId
            );
        }

        // Gera o PDF (A função gerarPDFPedido deve permanecer no script original, não precisa alterar)
        await gerarPDFPedido(pedido.id, destinoNome, itensPedidoTemporario);

        alert("Pedido criado com sucesso! O PDF foi baixado.");
        window.closeModal();
        window.renderTab('pedidos');

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar pedido: " + error.message);
    } finally {
        if(btnConfirmar) {
            btnConfirmar.innerText = "Confirmar Pedido";
            btnConfirmar.disabled = false;
        }
    }
}

// 3. Função para Gerar PDF (Folha A4)
window.gerarPDFPedido = async function(pedidoId, destino, itens) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Cabeçalho
    doc.setFontSize(18);
    doc.text(`PEDIDO DE SAÍDA Nº ${pedidoId}`, 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.text(`Data: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 30);
    doc.text(`Destino: ${destino}`, 14, 38);
    doc.text(`Responsável Emissão: ${userProfile?.nome || 'Sistema'}`, 14, 46);

    // Dados da Tabela
    const tableData = itens.map(item => [
        item.nome,
        item.tamanho || '-',
        item.tipo === 'CONSUMO' ? 'Material' : 'Uniforme',
        item.quantidade
    ]);

    // Gera Tabela
    doc.autoTable({
        startY: 55,
        head: [['Produto', 'Tamanho', 'Tipo', 'Qtd']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] } // Azul do sistema
    });

    // Área de Assinatura no Rodapé
    const finalY = doc.lastAutoTable.finalY + 40; // 40px abaixo da tabela
    
    doc.line(20, finalY, 190, finalY); // Linha horizontal
    doc.setFontSize(10);
    doc.text(`Recebido por (Nome Legível): __________________________________________________`, 20, finalY + 10);
    doc.text(`Assinatura e Data: __________________________________________________________`, 20, finalY + 20);

    // Salva o arquivo
    doc.save(`Pedido_${pedidoId}_${destino.replace(/\s+/g, '_')}.pdf`);
}

// 4. Gerenciar Pedido (Atualizar Status com Bloqueios)
window.openModalGerenciarPedido = async function(pedidoId) {
    const modal = document.getElementById("global-modal");
    const content = document.getElementById("modal-content-area");
    
    content.innerHTML = '<div style="text-align:center; padding:20px"><i class="fas fa-spinner fa-spin"></i> Carregando pedido...</div>';
    modal.style.display = 'block';

    try {
        // 1. Busca dados do Pedido
        const { data: pedido, error: errPed } = await supabase
            .from('pedidos')
            .select('*, unidades(nome)')
            .eq('id', pedidoId)
            .single();

        if (errPed) throw errPed;

        // 2. Busca os Itens do Pedido (Query Corrigida)
        // Solicitamos explicitamente o ID para garantir a unicidade e o catalogo completo
        const { data: itens, error: errItens } = await supabase
            .from('itens_pedido')
            .select('id, quantidade_solicitada, tamanho, catalogo(nome, tipo)') 
            .eq('pedido_id', pedidoId);

        if (errItens) throw errItens;

        // Monta HTML da lista de itens
        let htmlItens = `<table class="table-geral" style="width:100%; margin-bottom:20px;">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th>Produto</th>
                    <th>Tipo</th>
                    <th>Tam/Num</th>
                    <th>Qtd</th>
                </tr>
            </thead>
            <tbody>`;
            
        if(itens && itens.length > 0) {
            itens.forEach(i => {
                // Verificação de segurança caso catalogo venha nulo (item deletado, por exemplo)
                const nomeProd = i.catalogo ? i.catalogo.nome : '<span style="color:red">Item Excluído</span>';
                const tipoProd = i.catalogo ? i.catalogo.tipo : '-';
                
                htmlItens += `
                    <tr>
                        <td>${nomeProd}</td>
                        <td>${tipoProd}</td>
                        <td>${i.tamanho || '-'}</td>
                        <td style="font-weight:bold">${i.quantidade_solicitada}</td>
                    </tr>`;
            });
        } else {
            htmlItens += `<tr><td colspan="4" style="text-align:center">Nenhum item encontrado neste pedido.</td></tr>`;
        }
        htmlItens += `</tbody></table>`;

        // 3. Monta o Seletor de Status (Lógica Nova)
        const statusAtual = pedido.status;
        
        // Lista de Status permitidos (Excluindo 'PENDENTE' para seleção)
        const listaStatus = [
            { val: 'em_separacao', label: 'EM SEPARAÇÃO' },
            { val: 'pronto', label: 'PRONTO / AGUARDANDO RETIRADA' }, // <--- Aspa adicionada
            { val: 'em_transito', label: 'EM TRÂNSITO / SAIU DA UNIDADE' },
            { val: 'entregue', label: 'ENTREGUE' }
        ];

        let opcoesStatus = '';
        listaStatus.forEach(opt => {
            // Marca como selecionado se for o status atual
            const selected = (opt.val === statusAtual) ? 'selected' : '';
            opcoesStatus += `<option value="${opt.val}" ${selected}>${opt.label}</option>`;
        });

        // Se o status for CANCELADO, mostra apenas aviso
        let areaAcoes = '';
        if (statusAtual === 'CANCELADO') {
            areaAcoes = `<div style="padding:15px; background:#fee2e2; color:#991b1b; border-radius:8px; text-align:center; font-weight:bold;">
                <i class="fas fa-ban"></i> Este pedido está CANCELADO e o estoque foi estornado.
            </div>`;
        } else {
            areaAcoes = `
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">Atualizar Status:</label>
                    <div style="display:flex; gap:10px;">
                        <select id="novo-status-selecionado" style="flex:1; padding:8px; border-radius:6px; margin:0;">
                            ${opcoesStatus}
                        </select>
                        <button class="btn-confirmar" onclick="window.atualizarStatusPeloSelect(${pedidoId})">Salvar</button>
                    </div>
                    
                    <div style="margin-top:15px; padding-top:15px; border-top:1px solid #e2e8f0; text-align:right;">
                        <button onclick="window.cancelarPedido(${pedidoId})" class="btn-cancelar" style="font-size:0.9em;">
                            <i class="fas fa-times-circle"></i> Cancelar Pedido (Estornar Estoque)
                        </button>
                    </div>
                </div>
            `;
        }

        // Renderiza Modal Final
        content.innerHTML = `
            <h3><i class="fas fa-edit"></i> Gerenciar Pedido #${pedido.id}</h3>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; font-size:0.95em;">
                <div><strong>Destino:</strong><br> ${pedido.unidades?.nome || 'N/A'}</div>
                <div><strong>Data:</strong><br> ${new Date(pedido.data_solicitacao).toLocaleString()}</div>
                <div><strong>Solicitante:</strong><br> (ID: ${pedido.solicitante_id ? pedido.solicitante_id.substring(0,8) : 'Sistema'})</div>
                <div><strong>Status Atual:</strong><br> <span class="status-tag status-${statusAtual.toLowerCase()}">${statusAtual}</span></div>
            </div>

            <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
            
            <h4>Itens do Pedido:</h4>
            ${htmlItens}
            
            ${areaAcoes}

            <div style="margin-top:20px; text-align:center;">
                 <button onclick="window.reimprimirPDF(${pedidoId}, '${pedido.unidades?.nome}')" style="background:#64748b; color:white; border:none; padding:8px 15px; border-radius:6px;">
                    <i class="fas fa-print"></i> Re-imprimir PDF
                 </button>
            </div>
        `;

    } catch (error) {
        console.error(error);
        content.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar detalhes do pedido:<br>${error.message}</p>`;
    }
}

window.atualizarStatusPeloSelect = async function(pedidoId) {
    const select = document.getElementById("novo-status-selecionado");
    const novoStatus = select.value;

    if(!novoStatus) return;

    // Confirmação simples
    if(!confirm(`Deseja alterar o status para "${novoStatus}"?`)) return;

    try {
        const { error } = await supabase
            .from('pedidos')
            .update({ status: novoStatus })
            .eq('id', pedidoId);

        if(error) throw error;

        alert("Status atualizado com sucesso!");
        window.closeModal();
        window.renderTab('pedidos'); // Atualiza a tabela no fundo

    } catch (e) {
        alert("Erro ao atualizar: " + e.message);
    }
}

// Função auxiliar para re-imprimir o PDF de um pedido antigo
window.reimprimirPDF = async function(pedidoId, destinoNome) {
    try {
        // Feedback visual
        const btnPrint = document.querySelector('button[onclick*="reimprimirPDF"]');
        if(btnPrint) btnPrint.innerText = "Gerando PDF...";

        // Busca itens novamente com segurança
        const { data: itens, error } = await supabase
            .from('itens_pedido')
            .select('quantidade_solicitada, tamanho, catalogo(nome, tipo)')
            .eq('pedido_id', pedidoId);
            
        if(error) throw error;
        if(!itens || itens.length === 0) return alert("Não há itens neste pedido para imprimir.");
        
        // Mapeia e trata possíveis nulos
        const itensFormatados = itens.map(i => ({
            nome: i.catalogo ? i.catalogo.nome : '(Produto Removido)',
            tamanho: i.tamanho,
            tipo: i.catalogo ? i.catalogo.tipo : 'N/A',
            quantidade: i.quantidade_solicitada
        }));
        
        // Chama a função original de gerar PDF (que já existe no seu código)
        await gerarPDFPedido(pedidoId, destinoNome, itensFormatados);

    } catch (e) {
        console.error(e);
        alert("Erro ao gerar PDF: " + e.message);
    } finally {
        const btnPrint = document.querySelector('button[onclick*="reimprimirPDF"]');
        if(btnPrint) btnPrint.innerHTML = '<i class="fas fa-print"></i> Re-imprimir PDF';
    }
}

window.alterarStatusPedido = async function(id, novoStatus) {
    if(!confirm(`Mudar status para ${novoStatus}?`)) return;
    
    // Proteção extra contra voltar para PENDENTE
    if (novoStatus === 'PENDENTE') return alert("Não é permitido voltar para o status Pendente.");

    const { error } = await supabase.from('pedidos').update({ status: novoStatus }).eq('id', id);
    if(error) alert("Erro: " + error.message);
    else {
        window.closeModal();
        window.renderTab('pedidos');
    }
}

// Função Especial: Cancelar e Devolver Estoque
window.cancelarPedido = async function(pedidoId) {
    if(!confirm("Tem certeza que deseja CANCELAR? Os itens voltarão para o estoque.")) return;

    // 1. Busca os itens para devolver
    const { data: itens } = await supabase.from('itens_pedido').select('*').eq('pedido_id', pedidoId);

    // 2. Loop de devolução
    for (const item of itens) {
        if (item.tipo_produto === 'CONSUMO') {
             // Devolve Consumo (Usa rpc seria melhor para concorrência, mas update funciona aqui)
             const { data: est } = await supabase.from('estoque_consumo').select('*').eq('produto_id', item.produto_id).single();
             if(est) {
                 await supabase.from('estoque_consumo').update({ quantidade_atual: est.quantidade_atual + item.quantidade }).eq('id', est.id);
             }
        } else {
             // Devolve Uniforme
             const { data: est } = await supabase.from('estoque_tamanhos').select('*').eq('produto_id', item.produto_id).eq('tamanho', item.tamanho).single();
             if(est) {
                 await supabase.from('estoque_tamanhos').update({ quantidade: est.quantidade + item.quantidade }).eq('id', est.id);
             }
        }
        
        // Log de retorno
        await registrarHistorico(item.produto_id, item.quantidade, 'ENTRADA_PEDIDO', `Cancelamento Pedido #${pedidoId}`, userProfile?.nome);
    }

    // 3. Atualiza status para CANCELADO
    await supabase.from('pedidos').update({ status: 'CANCELADO' }).eq('id', pedidoId);

    alert("Pedido cancelado e estoque estornado.");
    window.closeModal();
    window.renderTab('pedidos');
}

// ============================================================================
// PARTE 10: RECURSOS EXTRAS (RELATÓRIOS E CALCULADORA)
// ============================================================================

window.renderCalculadora = function() {
    const area = document.getElementById("tab-content");
    area.innerHTML = `
        <div style="max-width: 400px; margin: 20px auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3>Calculadora de Caixas</h3>
            <label>Quantidade Total:</label>
            <input type="number" id="calc-total" style="width:100%; padding:10px; margin-bottom:10px;">
            <label>Itens por Caixa:</label>
            <input type="number" id="calc-div" style="width:100%; padding:10px; margin-bottom:10px;">
            <button class="btn-confirmar" onclick="window.calcularCaixas()" style="width:100%">Calcular</button>
            <div id="calc-res" style="margin-top:20px; font-weight:bold; color: #007bff;"></div>
        </div>
    `;
}

window.calcularCaixas = function() {
    const total = parseInt(document.getElementById("calc-total").value);
    const div = parseInt(document.getElementById("calc-div").value);
    if(!total || !div) return;
    
    const caixas = Math.floor(total / div);
    const sobra = total % div;
    
    document.getElementById("calc-res").innerHTML = 
        `Resultado: ${caixas} caixas fechadas + ${sobra} unidades soltas.`;
}

window.renderMenuRelatorios = function() {
    const area = document.getElementById("tab-content");
    area.innerHTML = `
        <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center; padding:20px;">
            <div class="card-relatorio" style="background:white; padding:20px; border-radius:8px; width:200px; text-align:center;">
                <i class="fas fa-exclamation-triangle" style="font-size:30px; color:orange"></i>
                <h4>Estoque Baixo</h4>
                <button onclick="window.gerarRelatorioPDF('baixo')">Gerar PDF</button>
            </div>
            <div class="card-relatorio" style="background:white; padding:20px; border-radius:8px; width:200px; text-align:center;">
                <i class="fas fa-history" style="font-size:30px; color:blue"></i>
                <h4>Movimentações</h4>
                <button onclick="alert('Funcionalidade de PDF requer biblioteca jsPDF')">Gerar PDF</button>
            </div>
        </div>
    `;
}

window.gerarRelatorioPDF = async function(tipo) {
    // Exemplo simples usando window.print para evitar dependência complexa agora
    if(tipo === 'baixo') {
        const { data } = await supabase.from("estoque_consumo").select("quantidade_atual, catalogo(nome, estoque_minimo)");
        const baixos = data.filter(i => i.quantidade_atual <= i.catalogo.estoque_minimo);
        
        let texto = "RELATÓRIO DE ESTOQUE BAIXO:\n\n";
        baixos.forEach(b => texto += `- ${b.catalogo.nome}: Atual ${b.quantidade_atual} (Mín: ${b.catalogo.estoque_minimo})\n`);
        
        alert(texto);
        // Numa versão futura, integrar com jsPDF
    }
}

// Fim do Script
console.log("Sistema carregado com sucesso (v2.0 Refatorado)");
