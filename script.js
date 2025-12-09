// --- DADOS DE CONEXÃO SUPABASE ---
const SUPABASE_URL = 'https://xobranulydiqbswhqucf.supabase.co';
// A chave abaixo é a chave pública (anon key).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvYnJhbnVseWRpcWJzd2hxdWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjg3NDMsImV4cCI6MjA3ODgwNDc0M30.__hP0V-vrDMiA5wbPrrBWhTISpOuZbxbdmZsmsr_S9U';
// Inicializa o cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    const tabsContainer = document.getElementById('tabs');
    const tabContentArea = document.getElementById('tab-content');
    const modal = document.getElementById('global-modal');
    const modalContentArea = document.getElementById('modal-content-area');
    const btnLogin = document.getElementById('btn-login');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('input-search-item');

    let activeTab = 'item'; // CORRIGIDO: de 'itens' para 'item'
    let selectedRowId = null;
    let userProfile = null; 
    let currentUserId = null; 
    
    let loginAttempts = 0;

// --- Lógica da Barra de Pesquisa ---
    searchInput.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const tabela = document.getElementById('table-item');
        
        if (!tabela) return;

        const linhas = tabela.querySelectorAll('tbody tr');
        
        linhas.forEach(linha => {
            // A coluna 'Item' é a segunda coluna (índice 1) na aba 'item'
            // Estrutura: [ID, Item, Categoria, Qtd, Alerta, Status]
            const colunaItem = linha.cells[1]; 
            
            if (colunaItem) {
                const textoItem = colunaItem.textContent.toLowerCase();
                // Verifica se contém o termo. Se vazio, inclui tudo (includes('') é true)
                if (textoItem.includes(termo)) {
                    linha.style.display = ''; // Mostra a linha
                } else {
                    linha.style.display = 'none'; // Esconde a linha
                }
            }
        });
    });


    // --- Mapeamento para DB ---
    function mapDisplayToDb(displayValue) {
        if (displayValue === 'Administrador') return 'admin';
        if (displayValue === 'Operador') return 'comum';
        if (displayValue === 'SUPERADMIN') return 'super';
        return displayValue;
    }

    // --- Mapeamento para UI ---
    function mapDbToDisplay(dbValue) {
        if (dbValue === 'admin') return 'Administrador';
        if (dbValue === 'comum') return 'Operador';
        if (dbValue === 'super') return 'SUPERADMIN'; 
        return dbValue;
    }
    
    // --- Lógica de Login (USANDO SUPABASE AUTH) ---
    btnLogin.addEventListener('click', handleLogin);
    async function handleLogin() {
        const email = document.getElementById('login-usuario').value.trim();
        const senha = document.getElementById('login-senha').value.trim();
        
        if (!email || !senha) {
            alert('Por favor, preencha todos os campos (Email e Senha).');
            return;
        }

        let loginSuccess = false;
        try {
            // 1. Tentar fazer o login usando o Email e Senha (método padrão do Supabase)
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email, 
                password: senha,
            });
            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    loginAttempts++;
                    alert(`Email ou Senha incorretos. Tentativas (não oficiais) restantes: ${5 - loginAttempts}.`);
                } else {
                     throw authError;
                }
                return;
            }
            
            // 2. Pega o UID (UUID) do usuário logado
            const userId = authData.user.id;
            // 3. Busca o perfil na sua tabela 'usuarios' usando o UID (RLS deve estar ativo aqui!)
            const { data: userData, error: userError } = 
            await supabase
               .from('usuarios')
               .select('id, nivel_acesso, status') 
               .eq('id', userId)
               .eq('status', 'A') 
               .single();
            if (userError || !userData) {
                // Se não encontrar o usuário na sua tabela de perfis (ou inativo), desloga
                await supabase.auth.signOut();
                alert("Usuário logado, mas perfil não encontrado ou inativo na tabela de Perfis. Acesso negado.");
                return;
            }
            
            // Sucesso no mapeamento
            userProfile = mapDbToDisplay(userData.nivel_acesso);
            currentUserId = userData.id; // Guarda o UID para uso em movimentações
            loginSuccess = true;
            if (loginSuccess) {
                loginAttempts = 0;
                // Transição de tela
                loginScreen.classList.add('hidden');
                mainApp.classList.remove('hidden'); 
                
                // Configura a interface e carrega a aba
                configureInterfaceByProfile(userProfile);
                await renderTab(activeTab);
            }
            
        } catch (e) {
             console.error("Erro no Login:", e);
             alert(`Erro grave no Login: ${e.message}. Verifique a conexão ou as políticas RLS.`);
        }
    }
    
    // --- Funções de Controle de Acesso e Interface ---
    function configureInterfaceByProfile(profile) {
        const tabs = document.querySelectorAll('.tab-button');
        tabs.forEach(tab => {
            // Regra: Operador (comum) não vê a aba 'Usuários'
            if (tab.dataset.tab === 'usuarios' && profile === 'Operador') {
                tab.classList.add('hidden');
            } else {
                 tab.classList.remove('hidden');
            }
        });
        // Se a aba ativa for 'usuarios' e o perfil for 'Operador', muda para 'item'
        if (activeTab === 'usuarios' && profile === 'Operador') {
            activeTab = 'item'; // CORRIGIDO: de 'itens' para 'item'
            document.querySelector('.tab-button[data-tab="item"]').classList.add('active'); // CORRIGIDO: de 'itens' para 'item'
            document.querySelector('.tab-button[data-tab="usuarios"]').classList.remove('active');
        }
    }

    // --- Funções de Ajuda (Aplicações em Tempo Real) ---
    async function fetchData(tableName, filterStatus = 'A') {
        let query = supabase.from(tableName).select('*');

        // Regra especial para usuários: exibir somente o usuário logado (se conhecido)
        if (tableName === 'usuarios') {
            // se currentUserId está definido, exibimos apenas o registro do usuário logado
            if (currentUserId) {
                query = supabase.from('usuarios').select('*').eq('id', currentUserId);
            } else {
                // fallback: mantém regra anterior (nunca exibe super, admin vê admin/comum)
                query = query.neq('nivel_acesso', 'super');
                if (userProfile === 'Administrador') {
                    query = query.in('nivel_acesso', ['admin', 'comum']);
                }
                query = query.order('usuario', { ascending: true });
            }
        } else {
            // comportamento original para tabelas não-histórico/usuários
            if (tableName !== 'historico') {
                if (filterStatus === 'I') {
                    query = query.eq('status', 'I');
                } else {
                    query = query.eq('status', 'A');
                }
            }

            if (tableName === 'historico') {
                query = query.order('data_movimentacao', { ascending: false });
            } else {
                const column = tableName === 'item' ? 'item' :
                               tableName === 'local' ? 'local' :
                               tableName === 'categoria' ? 'nome_categoria' : 'id';
                query = query.order(column, { ascending: true });
            }
        }

        const { data, error } = await query;
        if (error) {
            console.error(`Erro ao buscar dados de ${tableName}:`, error);
            if (error.code === '42501') {
                alert("Acesso Negado (RLS): Seu perfil não tem permissão de leitura nesta tabela.");
            }
            return [];
        }
        return data;
    }
    
    // --- Controle de Abas e Renderização ---
    tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button') && !e.target.classList.contains('hidden')) {
            const tabName = e.target.dataset.tab;
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderTab(tabName);
        }
    
    });
    
    async function renderTab(tabName, filterStatus = 'A') {
        activeTab = tabName;
        selectedRowId = null;
        let data = [];
        let tableName = tabName;
        // --- Lógica de Visibilidade da Busca ---
        if (tabName === 'item') {
            searchContainer.classList.remove('hidden');
            searchInput.value = ''; // Limpa a busca ao trocar/recarregar a aba
        } else {
            searchContainer.classList.add('hidden');
        }
        // ---------------------------------------
        try {
            // Garante que 'historico' sempre busca os dados (sem o filtro de status 'A'/'I')
            if (tabName !== 'historico') {
                 data = await fetchData(tableName, filterStatus);
            } else {
                 data = await fetchData('historico');
            }
        } catch (e) {
            console.error("Erro fatal ao carregar dados da aba:", e);
            alert("Não foi possível carregar os dados. Verifique suas políticas RLS.");
            return;
        }

        let html = renderButtons(tabName);
        html += renderTable(tabName, data);
        
        tabContentArea.innerHTML = html;
        setupTabListeners(tabName);
    }
    
    // Substituir por este código
    function renderButtons(tabName) {
        let buttonsHtml = '<div class="action-buttons">';
        const isCommon = userProfile === 'Operador';
        const isAdmin = userProfile === 'Administrador';
        const isSuper = userProfile === 'SUPERADMIN';
        const isSuperOrAdmin = isSuper || isAdmin;

        // Regra: Comum não edita, Admin/Super edita (exceto histórico)
        const canEdit = isSuperOrAdmin && tabName !== 'historico';
        const canRestore = isSuperOrAdmin;
        const canLancamento = tabName === 'item' && isSuperOrAdmin;
        const canDelete = isSuper && tabName !== 'historico';

        if (canEdit) {
            buttonsHtml += `<button id="btn-incluir-novo"><i class="fas fa-plus-circle"></i> Incluir Novo</button>`;
        }
    // --- NOVO CÓDIGO: BOTÃO DE RELATÓRIO DE ESTOQUE ---
        // Disponível na aba 'item' para todos (ou restrinja se preferir)
        if (tabName === 'item' && isSuperOrAdmin) {
            buttonsHtml += `<button id="btn-editar-nome" style="background-color: #fd7e14;"><i class="fas fa-edit"></i> Editar Nome</button>`;
        }
        if (tabName === 'item') {
            buttonsHtml += `<button id="btn-relatorio-estoque" style="background-color: #6f42c1;"><i class="fas fa-file-pdf"></i> Relatório Estoque</button>`;
        }
        // Inativar / Restaurar botões (mantidos)
        if (['item', 'local', 'categoria', 'usuarios'].includes(tabName) && canEdit) {
            buttonsHtml += `<button id="btn-inativar"><i class="fas fa-minus-circle"></i> Inativar</button>`;
        }
        if (['item', 'local', 'categoria', 'usuarios'].includes(tabName) && canRestore) {
             buttonsHtml += `<button id="btn-restaurar"><i class="fas fa-undo"></i> Restaurar</button>`;
        }

        // Botões de Lançamento (estoque)
        if (canLancamento) {
             buttonsHtml += `<button id="btn-lancar-entrada"><i class="fas fa-arrow-down"></i> Lançar Entrada</button>`;
             buttonsHtml += `<button id="btn-lancar-saida"><i class="fas fa-arrow-up"></i> Lançar Saída</button>`;
        }

        // Botão AJUSTAR ALERTA — disponível para Admin e SUPER na aba item
        if (tabName === 'item' && (isAdmin || isSuper)) {
            buttonsHtml += `<button id="btn-ajustar-alerta"><i class="fas fa-bell"></i> Ajustar alerta</button>`;
        }

        // Botão ATUALIZAR SENHA — disponível na aba usuários (apenas para o usuário logado)
        if (tabName === 'usuarios') {
            buttonsHtml += `<button id="btn-atualizar-senha"><i class="fas fa-key"></i> Atualizar senha</button>`;
        }

        if (canDelete) {
             buttonsHtml += `<button id="btn-apagar" class="btn-apagar-super"><i class="fas fa-trash"></i> Apagar (SUPER)</button>`;
        }

        buttonsHtml += '</div>';
        return buttonsHtml;
    }
    
    // Substituir por este código
    function renderTable(tabName, data) {
        let headers = [];
        if (tabName === 'item') {
            headers = ['ID', 'Item', 'Categoria', 'Qtd. Atual', 'Alerta', 'Status'];
        } else if (tabName === 'local') {
            headers = ['ID', 'Local', 'Status'];
        } else if (tabName === 'categoria') {
            headers = ['ID', 'Categoria', 'Status'];
        } else if (tabName === 'usuarios') {
            headers = ['ID (UID)', 'Usuário', 'Perfil', 'Status'];
        } else if (tabName === 'historico') {
            headers = ['Data/Hora', 'Item', 'Tipo', 'Qtd', 'Local Destino', 'Usuário Resp.'];
        }

        let tableHtml = `<table class="data-table" id="table-${tabName}"><thead><tr>`;
        headers.forEach(h => tableHtml += `<th>${h}</th>`);
        tableHtml += '</tr></thead><tbody>';

        data.forEach(item => {
            let rowData = [];
            let lowStockClass = false;

            if (tabName === 'item') {
                rowData = [item.id, item.item, item.categoria, item.quantidade, item.alerta, item.status];

                // verifica estoque baixo
                const alertaVal = parseInt(item.alerta) || 0;
                const quantidadeVal = parseInt(item.quantidade) || 0;

                if (quantidadeVal <= alertaVal) {
                    lowStockClass = true;
                }
            } else if (tabName === 'local') {
                rowData = [item.id, item.local, item.status];
            } else if (tabName === 'categoria') {
                rowData = [item.id, item.nome_categoria || item.categoria, item.status];
            } else if (tabName === 'usuarios') {
                rowData = [item.id, item.usuario, mapDbToDisplay(item.nivel_acesso), item.status];
            } else if (tabName === 'historico') {
                rowData = [
                    new Date(item.data_movimentacao).toLocaleString(),
                    item.nome_item,
                    item.tipo_movimento,
                    item.quantidade_movimentada,
                    item.local_destino || '-',
                    item.usuario_responsavel_nome
                ];
            }

            tableHtml += `<tr data-id="${item.id}" class="${lowStockClass ? 'low-stock' : ''}">`;

            rowData.forEach((v, idx) => {
                // ABA ITENS — Coluna do NOME recebe o texto (BAIXO) em vermelho
                if (tabName === 'item' && idx === 1 && lowStockClass) {
                    tableHtml += `
                        <td>
                            ${v} 
                            <strong style="color:#dc3545; font-weight:bold;">
                                (BAIXO)
                            </strong>
                        </td>`;
                } else {
                    tableHtml += `<td>${v}</td>`;
                }
            });

            tableHtml += `</tr>`;
        });

        tableHtml += '</tbody></table>';
        return tableHtml;
    }
    
    // Substituir por este código
    function setupTabListeners(tabName) {
        const table = document.getElementById(`table-${tabName}`);
        if (table) {
            table.addEventListener('click', (e) => {
                let row = e.target.closest('tr');
                if (row && row.dataset.id) {
                    document.querySelectorAll('.data-table tr').forEach(r => r.classList.remove('selected-row'));
                    row.classList.add('selected-row');
                    selectedRowId = row.dataset.id;
                }
            });
        }

        document.getElementById('btn-incluir-novo')?.addEventListener('click', () => showIncluirNovoModal(tabName));
    // --- NOVO CÓDIGO: LISTENER DO RELATÓRIO ---
        document.getElementById('btn-editar-nome')?.addEventListener('click', () => showEditarNomeModal());
        document.getElementById('btn-relatorio-estoque')?.addEventListener('click', () => handleGerarRelatorio());        
        document.getElementById('btn-inativar')?.addEventListener('click', () => handleInativar(tabName));
        document.getElementById('btn-restaurar')?.addEventListener('click', () => showRestaurarModal(tabName));
        document.getElementById('btn-apagar')?.addEventListener('click', () => handleApagar(tabName));
        if (tabName === 'item') {
            document.getElementById('btn-lancar-entrada')?.addEventListener('click', () => showLancamentoModal(tabName, 'Entrada'));
            document.getElementById('btn-lancar-saida')?.addEventListener('click', () => showLancamentoModal(tabName, 'Saída'));
            // novo: ajustar alerta
            document.getElementById('btn-ajustar-alerta')?.addEventListener('click', () => showAjustarAlertaModal());
        }

        // novo: atualizar senha (apenas abre modal para o usuário logado)
        document.getElementById('btn-atualizar-senha')?.addEventListener('click', () => showUpdatePasswordModal());
    }
    
    // --- Modais e Confirmações ---

    async function showIncluirNovoModal(tabName) {
        const isSuperOrAdmin = userProfile === 'SUPERADMIN' ||
        userProfile === 'Administrador';
        if (!isSuperOrAdmin) return alert('Seu perfil não permite esta ação.');

        let title = '';
        let formHtml = '';
        if (tabName === 'usuarios') {
            title = 'Incluir Novo Usuário (Supabase Auth)';
            const perfis = userProfile === 'SUPERADMIN' ? ['Administrador', 'Operador', 'SUPERADMIN'] : ['Administrador', 'Operador'];
            formHtml = `
                <p>O cadastro de usuários (exceto SUPERADMIN) é feito em duas etapas:</p>
                <ol>
                    <li>O usuário deve ser cadastrado no Supabase Auth (Email/Senha).</li>
                    <li>O perfil de acesso é definido aqui.</li>
  
                </ol>
                <label>ID do Usuário (UUID) após cadastro no Supabase Auth:</label><input type="text" id="input-usuario-id" placeholder="Copie o UID (UUID) do Supabase Auth aqui.">
                <label>Nome de Exibição (Opcional):</label><input type="text" id="input-usuario-nome">
                <label>Perfil de Acesso:</label>
             
                <select id="input-usuario-perfil">
                    ${perfis.map(p => `<option value="${p}">${p}</option>`).join('')}
                </select>
            `;
        } else if (tabName === 'local') { // CORRIGIDO: de 'locais' para 'local'
            title = 'Incluir Novo Local';
            formHtml = `<label>Nome do Local:</label><input type="text" id="input-local-nome">`;
        } else if (tabName === 'categoria') { // CORRIGIDO: de 'categorias' para 'categoria'
            title = 'Incluir Nova Categoria';
            formHtml = `<label>Nome da Categoria:</label><input type="text" id="input-categoria-nome">`;
        } else if (tabName === 'item') { // CORRIGIDO: de 'itens' para 'item'
            title = 'Incluir Novo Item';
            const categoriasAtivas = await fetchData('categoria', 'A'); // CORRIGIDO: de 'categorias' para 'categoria'
            formHtml = `
                <p>O campo 'Item' será salvo em **MAIÚSCULAS e sem ACENTOS**.</p>
                <label>Nome do Item:</label><input type="text" id="input-item-nome">
                <label>Categoria:</label>
                <select id="input-item-categoria">
              
                    ${categoriasAtivas.map(c => `<option value="${c.nome_categoria || c.categoria}">${c.nome_categoria || c.categoria}</option>`).join('')}
                </select>
                <label>Quantidade de Alerta:</label><input type="number" id="input-item-alerta" min="0" value="0">
            `;
        }
        
        modalContentArea.innerHTML = `
            <h3>${title}</h3>
            ${formHtml}
            <p>Confirma?</p>
            <div class="modal-buttons">
                <button id="btn-confirmar-nao" class="btn-cancelar">Não</button>
               
                <button id="btn-confirmar-sim" class="btn-confirmar">Sim</button>
            </div>
        `;
        modal.style.display = 'block';
        
        document.getElementById('btn-confirmar-sim').onclick = () => {
            handleInclusaoConfirm(tabName);
        };
        document.getElementById('btn-confirmar-nao').onclick = closeModal;
        window.onkeydown = (e) => {
            if (e.key === 'Escape') closeModal();
        };
    }
    
    async function handleInclusaoConfirm(tabName) {
        const isSuperOrAdmin = userProfile === 'SUPERADMIN' ||
        userProfile === 'Administrador';
        if (!isSuperOrAdmin) return;
        
        let data = {};
        let tableName = tabName;
        let isUserSuper = false;
        if (tabName === 'usuarios') {
            const perfilDisplay = document.getElementById('input-usuario-perfil').value;
            const uuid = document.getElementById('input-usuario-id').value.trim();
            
            if (perfilDisplay === 'SUPERADMIN') {
                 isUserSuper = true;
            }
            
            if (userProfile === 'Administrador' && isUserSuper) {
                 alert("Seu perfil não permite o cadastro de SUPERADMIN.");
                 return;
            }
            
            if (!uuid) {
                 alert("O ID (UUID) do usuário é obrigatório.");
                 return;
            }

            data.id = uuid;
            data.usuario = document.getElementById('input-usuario-nome').value.trim() ||
            'Usuário Não Nomeado';
            data.nivel_acesso = mapDisplayToDb(perfilDisplay);
            data.status = 'A';

        } else if (tabName === 'local') { // CORRIGIDO: de 'locais' para 'local'
            data.local = document.getElementById('input-local-nome').value.trim().toUpperCase();
            data.status = 'A';
            if (!data.local) { alert("O nome do Local é obrigatório."); return;
            }
        } else if (tabName === 'categoria') { // CORRIGIDO: de 'categorias' para 'categoria'
            data.nome_categoria = document.getElementById('input-categoria-nome').value.trim().toUpperCase();
            data.status = 'A';
            if (!data.nome_categoria) { alert("O nome da Categoria é obrigatório."); return;
            }
        } else if (tabName === 'item') { // CORRIGIDO: de 'itens' para 'item'
            data.item = document.getElementById('input-item-nome').value.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            data.categoria = document.getElementById('input-item-categoria').value;
            data.alerta = parseInt(document.getElementById('input-item-alerta').value) || 0;
            data.quantidade = 0; 
            data.status = 'A';
            if (!data.item) { alert("O nome do Item é obrigatório."); return;
            }
        }
        
        const { error } = await supabase
            .from(tableName)
            .insert([data]);
        if (error) {
            console.error(`Erro ao incluir ${tabName}:`, error);
            // Mensagem atualizada
            alert(`Erro ao incluir ${tabName}: ${error.message}. (Verifique se o UUID já existe ou se o RLS está bloqueando o INSERT)`); 
        } else {
            alert(`${tabName} incluído com sucesso!`);
            closeModal();
            renderTab(tabName);
        }
    }
    
    async function handleInativar(tabName) {
        const isSuperOrAdmin = userProfile === 'SUPERADMIN' ||
        userProfile === 'Administrador';
        if (!isSuperOrAdmin) return alert('Seu perfil não permite esta ação.');
        if (!selectedRowId) {
            alert(`Selecione um ${tabName} para inativar.`);
            return;
        }
        
        if (tabName === 'item') { // CORRIGIDO: de 'itens' para 'item'
            const { data: itemData, error: itemError } = await supabase.from('item').select('quantidade').eq('id', selectedRowId).single(); // CORRIGIDO: de 'itens' para 'item'
            if (itemError || !itemData) {
                 alert('Erro ao buscar item.');
                 return;
            }
            if (itemData.quantidade > 0) {
                alert('ERRO: Só é permitido inativar itens com estoque zerado!');
                return;
            }
        }
        
        if (tabName === 'usuarios' && userProfile === 'Administrador') {
             const { data: userData, error: userError } = await supabase.from('usuarios').select('nivel_acesso').eq('id', selectedRowId).single();
             if (userError || !userData) {
                 alert('Erro ao buscar usuário.');
                 return;
             }
             if (userData.nivel_acesso !== 'comum') {
                  alert('ERRO: Seu perfil não permite inativar outros Administradores ou SUPERADMIN.');
                  return;
             }
        }
        
        if (confirm(`Confirma a inativação do registro ID ${selectedRowId} da aba ${tabName}?`)) {
            const { error } = await supabase
                .from(tabName)
                .update({ status: 'I' })
           
             .eq('id', selectedRowId);

            if (error) {
                console.error(`Erro ao inativar ${tabName}:`, error);
                alert(`Erro ao inativar ${tabName}: ${error.message}. (Verifique o RLS para UPDATE)`);
            } else {
                alert('Registro inativado. A lista de Ativos foi atualizada.');
                selectedRowId = null; 
                renderTab(tabName); 
            }
        }
    }
    
    async function handleApagar(tabName) {
        if (userProfile !== 'SUPERADMIN') return alert('Seu perfil não permite esta ação.');
        
        // Regra do usuário: SUPERADMIN não pode apagar registros no 'historico'
        if (tabName === 'historico') {
             alert('ERRO: O SUPERADMIN não pode apagar registros do Histórico.');
             return;
        }
        
        if (!selectedRowId) {
            alert(`Selecione um ${tabName} para apagar.`);
            return;
        }
        
        // ** REGRA ESPECÍFICA DO SUPERADMIN: SÓ PODE APAGAR REGISTROS INATIVOS **
        if (tabName !== 'usuarios') { // Aplica a regra para item, local, categoria
            const { data: rowData, error: statusError } = await supabase.from(tabName).select('status').eq('id', selectedRowId).single();
            if (statusError || !rowData) {
                alert('Erro ao buscar status do registro.');
                return;
            }
            if (rowData.status !== 'I') {
                alert('ERRO: O SUPERADMIN só pode apagar registros que estejam INATIVOS!');
                return;
            }
        }
        
        if (confirm(`ATENÇÃO SUPERADMIN! Confirma a EXCLUSÃO PERMANENTE do registro ID ${selectedRowId} da aba ${tabName}?`)) {
             const { error } = await supabase
                 .from(tabName)
                 .delete()
                 
             .eq('id', selectedRowId);

             if (error) {
                 console.error(`Erro ao apagar ${tabName}:`, error);
                 alert(`Erro ao apagar ${tabName}: ${error.message}. (Verifique o RLS para DELETE)`);
             } else {
                 alert('Registro apagado PERMANENTEMENTE.');
                 selectedRowId = null; 
                 renderTab(tabName); 
             }
        }
    }
    
    async function handleRestaurarConfirm(tabName, idToRestore) {
        const isSuperOrAdmin = userProfile === 'SUPERADMIN' ||
        userProfile === 'Administrador';
        if (!isSuperOrAdmin) return; 
        
        if (tabName === 'usuarios' && userProfile === 'Administrador') {
             const { data: userData } = await supabase.from('usuarios').select('nivel_acesso').eq('id', idToRestore).single();
             if (userData?.nivel_acesso === 'super') {
                 alert('ERRO: Seu perfil não permite restaurar o SUPERADMIN.');
                 return;
             }
        }
        
        const { error } = await supabase
            .from(tabName)
            .update({ status: 'A' })
            .eq('id', idToRestore);
        if (error) {
            console.error(`Erro ao restaurar ${tabName}:`, error);
            alert(`Erro ao restaurar ${tabName}: ${error.message}. (Verifique o RLS para UPDATE)`);
        } else {
            alert('Registro restaurado. A lista de Ativos foi atualizada.');
            closeModal();
            renderTab(tabName); 
        }
    }
    
    async function showLancamentoModal(tabName, tipoMovimento) {
        const isSuperOrAdmin = userProfile === 'SUPERADMIN' ||
        userProfile === 'Administrador';
        if (!isSuperOrAdmin) return alert('Seu perfil não permite esta ação.');
        if (!selectedRowId) {
            alert('Selecione um item da lista para lançar a movimentação.');
            return;
        }
        
        const { data: itemData, error: itemError } = await supabase.from('item').select('*').eq('id', selectedRowId).single(); // CORRIGIDO: de 'itens' para 'item'
        if (itemError || !itemData) {
            alert('Erro ao buscar item.');
            return;
        }
        const item = itemData;

        const locaisAtivos = await fetchData('local', 'A'); // CORRIGIDO: de 'locais' para 'local'
        let title = `Lançar ${tipoMovimento} para: ${item.item}`;
        let localSelectHtml = '';
        if (tipoMovimento === 'Saída') {
            localSelectHtml = `
                <label>Local de Destino:</label>
                <select id="input-lancamento-local">
                    <option value="">-- Selecione o Local --</option>
                    ${locaisAtivos.map(l => 
 
                    `<option value="${l.local}">${l.local}</option>`).join('')}
                </select>
            `;
        }

        modalContentArea.innerHTML = `
            <h3>${title}</h3>
            <p>Quantidade Atual: <strong>${item.quantidade}</strong></p>
            <label>Quantidade de ${tipoMovimento}:</label>
            <input type="number" id="input-lancamento-quantidade" min="1">
            ${localSelectHtml}
            <p>Confirma?</p>
           
             <div class="modal-buttons">
                <button id="btn-confirmar-nao" class="btn-cancelar">Não</button>
                <button id="btn-confirmar-sim" class="btn-confirmar">Sim</button>
            </div>
        `;
        modal.style.display = 'block';

        document.getElementById('btn-confirmar-sim').onclick = () => {
            handleLancamentoConfirm(tipoMovimento, item);
        };
        document.getElementById('btn-confirmar-nao').onclick = () => {
             closeModal();
             document.querySelector('.selected-row')?.classList.remove('selected-row');
             selectedRowId = null;
        };
        window.onkeydown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.querySelector('.selected-row')?.classList.remove('selected-row');
                selectedRowId = null;
            }
        };
    }

    // INSERIR este bloco perto dos outros modais (por exemplo logo após showLancamentoModal)

    // --- Modal: Ajustar Alerta (Admin / SUPER) ---
    async function showAjustarAlertaModal() {
        if (!selectedRowId) {
            alert('Selecione um item para ajustar o alerta.');
            return;
        }
        // busca item
        const { data: itemData, error: itemError } = await supabase.from('item').select('*').eq('id', selectedRowId).single();
        if (itemError || !itemData) {
            alert('Erro ao buscar item selecionado.');
            return;
        }
        const atualAlerta = itemData.alerta || 0;
        modalContentArea.innerHTML = `
            <h3>Ajustar Alerta - ${itemData.item}</h3>
            <label>Quantidade de alerta:</label>
            <input type="number" id="input-ajustar-alerta" min="0" value="${atualAlerta}">
            <p>Confirma alteração do valor de alerta?</p>
            <div class="modal-buttons">
                <button id="btn-confirmar-nao" class="btn-cancelar">Não</button>
                <button id="btn-confirmar-sim" class="btn-confirmar">Sim</button>
            </div>
        `;
        modal.style.display = 'block';
        document.getElementById('btn-confirmar-sim').onclick = () => handleAjustarAlertaConfirm(selectedRowId);
        document.getElementById('btn-confirmar-nao').onclick = closeModal;
        window.onkeydown = (e) => { if (e.key === 'Escape') closeModal(); };
    }

    async function handleAjustarAlertaConfirm(itemId) {
        const newVal = parseInt(document.getElementById('input-ajustar-alerta').value);
        if (isNaN(newVal) || newVal < 0) {
            alert('Valor de alerta inválido.');
            return;
        }
        const { error } = await supabase.from('item').update({ alerta: newVal }).eq('id', itemId);
        if (error) {
            console.error('Erro ao ajustar alerta:', error);
            alert('Erro ao atualizar alerta. Verifique o console.');
        } else {
            alert('Alerta atualizado com sucesso.');
            closeModal();
            await renderTab('item');
        }
    }

    // --- Modal: Atualizar Senha (usuário logado) ---
    function showUpdatePasswordModal() {
        modalContentArea.innerHTML = `
            <h3>Atualizar Senha</h3>
            <label>Nova senha:</label>
            <input type="password" id="input-nova-senha" placeholder="Digite a nova senha">
            <label>Confirme a nova senha:</label>
            <input type="password" id="input-confirma-senha" placeholder="Confirme a nova senha">
            <p>Deseja alterar sua senha de acesso?</p>
            <div class="modal-buttons">
                <button id="btn-confirmar-nao" class="btn-cancelar">Não</button>
                <button id="btn-confirmar-sim" class="btn-confirmar">Sim</button>
            </div>
        `;
        modal.style.display = 'block';
        document.getElementById('btn-confirmar-sim').onclick = () => handleUpdatePassword();
        document.getElementById('btn-confirmar-nao').onclick = closeModal;
        window.onkeydown = (e) => { if (e.key === 'Escape') closeModal(); };
    }

    async function handleUpdatePassword() {
        const nova = document.getElementById('input-nova-senha').value || '';
        const conf = document.getElementById('input-confirma-senha').value || '';
        if (!nova || !conf) {
            alert('Preencha ambos os campos de senha.');
            return;
        }
        if (nova !== conf) {
            alert('As senhas não coincidem.');
            return;
        }
        // Atualiza a senha do usuário atualmente logado via Supabase Auth
        try {
            const { data, error } = await supabase.auth.updateUser({ password: nova });
            if (error) {
                console.error('Erro ao atualizar senha:', error);
                alert('Erro ao atualizar senha. Verifique o console.');
                return;
            }
            alert('Senha atualizada com sucesso.');
            closeModal();
        } catch (e) {
            console.error('Erro inesperado ao atualizar senha:', e);
            alert('Erro inesperado ao atualizar senha. Verifique o console.');
        }
    }


    async function handleLancamentoConfirm(tipoMovimento, item) {
        const isSuperOrAdmin = userProfile === 'SUPERADMIN' ||
        userProfile === 'Administrador';
        if (!isSuperOrAdmin) return;
        
        const quantidadeInput = document.getElementById('input-lancamento-quantidade');
        const quantidadeMov = parseInt(quantidadeInput.value);
        if (isNaN(quantidadeMov) || quantidadeMov <= 0) {
            alert("Quantidade inválida. Insira um valor positivo.");
            return;
        }

        let novoEstoque = item.quantidade;
        let localDestino = null;
        if (tipoMovimento === 'Saída') {
            const localInput = document.getElementById('input-lancamento-local');
            localDestino = localInput ? localInput.value : null;
            
            if (!localDestino) {
                 alert("Selecione um Local de Destino para a Saída.");
                 return;
            }
            if (quantidadeMov > item.quantidade) {
                alert(`ERRO: A saída (${quantidadeMov}) não pode ser maior que o estoque atual (${item.quantidade}).`);
                return;
            }
            novoEstoque = item.quantidade - quantidadeMov;
        } else { 
            novoEstoque = item.quantidade + quantidadeMov;
        }

        // 1. Atualizar ITEM
        const { error: updateError } = await supabase
            .from('item') // CORRIGIDO: de 'itens' para 'item'
            .update({ quantidade: novoEstoque })
            .eq('id', item.id);
        if (updateError) {
            console.error("Erro ao atualizar estoque:", updateError);
            alert("Erro ao atualizar estoque. Verifique o console.");
            return;
        }
        
        // 2. Inserir HISTÓRICO
        // Obtém o nome do usuário logado diretamente da sessão Supabase Auth
        const { data: { user } } = await supabase.auth.getUser();
        const nomeUsuario = user ? user.email : 'Usuário Desconhecido';
        
        const historicoData = {
            item_id: item.id,
            nome_item: item.item,
            quantidade_movimentada: quantidadeMov,
            tipo_movimento: tipoMovimento,
            local_destino: localDestino,
            usuario_responsavel_id: currentUserId,
          
            usuario_responsavel_nome: nomeUsuario,
            data_movimentacao: new Date().toISOString()
        };
        const { error: historyError } = await supabase
            .from('historico')
            .insert([historicoData]);
        if (historyError) {
             console.error("Erro ao registrar histórico:", historyError);
             alert("Estoque atualizado, mas houve erro ao registrar o histórico.");
        }
        
        alert(`Movimento de ${tipoMovimento} confirmado! Estoque atualizado para ${novoEstoque}.`);
        closeModal();
        
        const oldSelectedRowId = selectedRowId;
        await renderTab('item'); // CORRIGIDO: de 'itens' para 'item'
        
        const newRow = document.querySelector(`tr[data-id="${oldSelectedRowId}"]`);
        if (newRow) {
             newRow.classList.add('selected-row');
             selectedRowId = oldSelectedRowId;
        } else {
             selectedRowId = null;
        }
    }

    async function showRestaurarModal(tabName) {
        const isSuperOrAdmin = userProfile === 'SUPERADMIN' ||
        userProfile === 'Administrador';
        if (!isSuperOrAdmin) return alert('Seu perfil não permite esta ação.');

        let inactives = await fetchData(tabName, 'I');
        if (tabName === 'usuarios' && userProfile === 'Administrador') {
             inactives = inactives.filter(u => u.nivel_acesso !== 'super');
        }

        let html = `<h3>Restaurar ${tabName.charAt(0).toUpperCase() + tabName.slice(1)} Inativos</h3>`;
        html += renderTable(tabName, inactives);
        html += '<p>Selecione um item para restaurar:</p>';
        html += `
            <p id="restaurar-confirm-text" class="hidden">Confirma a restauração do item selecionado?</p>
            <div class="modal-buttons">
                <button id="btn-confirmar-nao" class="btn-cancelar">Não</button>
                <button id="btn-restaurar-sim" class="btn-confirmar">Sim</button>
            </div>
        `;
        modalContentArea.innerHTML = html;
        modal.style.display = 'block';
        
        let restaurarSelectedId = null;
        
        // CORREÇÃO: Busca a tabela DENTRO do modalContentArea para não confundir com a tabela do fundo
        const restoreTable = modalContentArea.querySelector('table'); 
        
        const confirmText = document.getElementById('restaurar-confirm-text');
        if (restoreTable) {
             restoreTable.addEventListener('click', (e) => {
                 let row = e.target.closest('tr');
                 if (row && row.dataset.id) {
                     // Remove seleção visual apenas de dentro do modal
                     restoreTable.querySelectorAll('tr').forEach(r => r.classList.remove('selected-row'));
                 
                     row.classList.add('selected-row');
                     restaurarSelectedId = row.dataset.id;
                     if(confirmText) confirmText.classList.remove('hidden');
                 }
             });
        }
        
        document.getElementById('btn-restaurar-sim').onclick = () => {
            if (restaurarSelectedId) {
                handleRestaurarConfirm(tabName, restaurarSelectedId);
            } else {
                alert('Por favor, selecione um registro para restaurar.');
            }
        };
        document.getElementById('btn-confirmar-nao').onclick = closeModal;
        window.onkeydown = (e) => {
            if (e.key === 'Escape') closeModal();
        };
    }
    async function handleGerarRelatorio() {
        // 1. Verifica se as bibliotecas foram carregadas
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("Erro: Biblioteca PDF não carregada. Verifique sua internet ou o index.html.");
            return;
        }

        // 2. Busca os dados atualizados de Itens Ativos
        const items = await fetchData('item', 'A');
        if (!items || items.length === 0) {
            alert("Não há itens para gerar o relatório.");
            return;
        }

        // 3. Configuração do PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4'); // Retrato, milímetros, A4

        // Título e Data
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        doc.setFontSize(16);
        doc.text("Relatório de Conferência de Estoque (Inventário)", 14, 20);
        doc.setFontSize(10);
        doc.text(`Data de Emissão: ${dataHoje}`, 14, 27);
        doc.text(`Total de Itens: ${items.length}`, 14, 32);

        // 4. Montagem dos dados da Tabela
        // Colunas: [Check, Item, Categoria, Qtd Sistema, Campo para Escrita]
        const tableBody = items.map(item => {
            return [
                '', // Coluna vazia para desenharmos o quadrado (checkbox) depois
                item.item, // Nome do item
                item.categoria || '-',
                item.quantidade, // Quantidade no sistema
                '' // Vazio para escrita manual
            ];
        });

        // 5. Geração da Tabela com AutoTable
        doc.autoTable({
            startY: 40,
            head: [['Conf.', 'Item', 'Categoria', 'Qtd. Sistema', 'Qtd. Física (Contagem)']],
            body: tableBody,
            theme: 'grid', // Estilo com linhas de grade
            styles: { 
                fontSize: 9, 
                cellPadding: 3,
                valign: 'middle'
            },
            headStyles: {
                fillColor: [0, 123, 255], // Cor azul do seu sistema
                textColor: 255
            },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' }, // Coluna do Checkbox
                1: { cellWidth: 'auto' }, // Item
                2: { cellWidth: 30 }, // Categoria
                3: { cellWidth: 25, halign: 'center' }, // Qtd Sistema
                4: { cellWidth: 40 } // Espaço para escrita
            },
            // Hook para desenhar o quadrado (checkbox) na primeira coluna
            didDrawCell: function (data) {
                if (data.section === 'body' && data.column.index === 0) {
                    const doc = data.doc;
                    // Desenha um quadrado vazio na célula
                    // x, y, tamanho, tamanho
                    doc.rect(data.cell.x + 4, data.cell.y + 2, 6, 6); 
                }
            }
        });

        // 6. Salvar/Baixar o PDF
        doc.save(`Inventario_${dataHoje.replace(/\//g, '-')}.pdf`);
    }
    // --- Modal: Editar Nome do Item ---
    // --- Modal: Editar Nome e Estoque do Item ---
    async function showEditarNomeModal() {
        // 1. Verificações de segurança e seleção
        if (activeTab !== 'item') return;
        if (!selectedRowId) {
            alert('Por favor, clique em um item na lista para selecioná-lo primeiro.');
            return;
        }

        // 2. Busca os dados atuais do item selecionado (Nome e Quantidade)
        const { data: itemData, error } = await supabase
            .from('item')
            .select('item, quantidade')
            .eq('id', selectedRowId)
            .single();

        if (error || !itemData) {
            console.error('Erro ao buscar item:', error);
            alert('Erro ao carregar dados do item.');
            return;
        }

        // 3. Monta o HTML do Modal com os dois campos
        modalContentArea.innerHTML = `
            <h3>Editar Item e Estoque</h3>
            <p>Faça as correções necessárias abaixo.</p>
            
            <label>Nome do Item:</label>
            <input type="text" id="input-editar-nome" value="${itemData.item}">
            
            <label>Quantidade em Estoque (Correção Manual):</label>
            <input type="number" id="input-editar-quantidade" value="${itemData.quantidade}" min="0">
            
            <p>Confirma as alterações?</p>
            <div class="modal-buttons">
                <button id="btn-confirmar-nao" class="btn-cancelar">Cancelar</button>
                <button id="btn-confirmar-sim" class="btn-confirmar">Salvar</button>
            </div>
        `;

        // 4. Exibe o Modal
        modal.style.display = 'block';

        // 5. Configura os botões do Modal
        document.getElementById('btn-confirmar-sim').onclick = () => handleEditarNomeConfirm(selectedRowId);
        document.getElementById('btn-confirmar-nao').onclick = closeModal;
        
        // Foco no campo de nome para agilizar
        setTimeout(() => document.getElementById('input-editar-nome').focus(), 100);

        window.onkeydown = (e) => {
            if (e.key === 'Escape') closeModal();
        };
    }

    async function handleEditarNomeConfirm(idItem) {
        const inputNome = document.getElementById('input-editar-nome');
        const inputQuantidade = document.getElementById('input-editar-quantidade');
        
        // Tratamento do Nome: Maiúsculas e sem acentos
        const novoNome = inputNome.value.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Tratamento da Quantidade: Garante que é número
        const novaQuantidade = parseInt(inputQuantidade.value);

        // Validações
        if (!novoNome) {
            alert("O nome não pode ficar vazio.");
            return;
        }
        if (isNaN(novaQuantidade) || novaQuantidade < 0) {
            alert("A quantidade informada é inválida.");
            return;
        }

        // Atualiza ambos os campos no Banco de Dados
        const { error } = await supabase
            .from('item')
            .update({ 
                item: novoNome,
                quantidade: novaQuantidade
            })
            .eq('id', idItem);

        if (error) {
            console.error("Erro ao atualizar item:", error);
            alert(`Erro ao atualizar: ${error.message}`);
        } else {
            alert("Item e estoque atualizados com sucesso!");
            closeModal();
            renderTab('item'); // Recarrega a tabela para mostrar os novos dados
        }
    }

    function closeModal() {
        modal.style.display = 'none';
        window.onkeydown = null; 
    }
    
    window.onclick = (event) => {
        if (event.target == modal) {
            closeModal();
        }
    }
});