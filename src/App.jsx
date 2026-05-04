import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  FilePlus, 
  ListTodo, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  HardHat,
  BarChart3,
  Calendar,
  Save,
  Settings,
  Lock,
  LogOut,
  Trash2,
  Plus,
  Users,
  Wrench,
  X,
  Briefcase,
  Edit2,
  ShieldAlert
} from 'lucide-react';

// Dados de exemplo atualizados com as novas nomenclaturas e equipe real
const MOCK_DATA = [
  { id: 1, codigo: 'PRJ-2024-001', projetista: 'Samuell', cliente: 'Construtora Alfa', tipo: 'ESCORAMENTOS DE LAJE', status: 'Concluído', dataInicio: '2024-05-01', area: 1200, notas: 'Projeto liberado para a obra.' },
  { id: 2, codigo: 'PRJ-2024-002', projetista: 'Vinicius', cliente: 'Engenharia Beta', tipo: 'TRAVAMENTO DE PILAR', status: 'Em Andamento', dataInicio: '2024-05-03', area: 450, notas: 'Aguardando arquitetura final.' },
  { id: 3, codigo: 'PRJ-2024-003', projetista: 'Valéria', cliente: 'Construtora Alfa', tipo: 'FORMA', status: 'Revisão', dataInicio: '2024-05-02', area: 300, notas: 'Cliente pediu alteração.' },
];

const STATUS_OPTIONS = ['Na Fila', 'Em Andamento', 'Revisão', 'Concluído', 'Cancelado'];

export default function App() {
  // --- Controle de Acesso e Usuários ---
  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  
  // Abas de navegação
  const [activeTab, setActiveTab] = useState('minhas-tarefas'); 

  // Sistema de Usuários com ID para permitir renomear com segurança
  const [usuarios, setUsuarios] = useState([
    { id: 1, nome: 'Fernanda', senha: 'admin', role: 'admin' },
    { id: 2, nome: 'Samuell', senha: '123', role: 'projetista' },
    { id: 3, nome: 'Vinicius', senha: '123', role: 'projetista' },
    { id: 4, nome: 'Victor', senha: '123', role: 'projetista' },
    { id: 5, nome: 'Valéria', senha: '123', role: 'projetista' }
  ]);

  const [tiposEstrutura, setTiposEstrutura] = useState([
    'FORMA',
    'TRAVAMENTO DE PILAR',
    'TRAVAMENTO DE VIGAS',
    'ESCORAMENTO DE VIGAS',
    'ESCORAMENTOS DE LAJE',
    'REESCORAMENTO 100%',
    'REESCORAMENTO 50%',
    'DETALHAMENTO'
  ]);

  // Estados Gerais
  const [projetos, setProjetos] = useState(MOCK_DATA);
  
  // Estados do Formulário Principal
  const [formData, setFormData] = useState({
    codigo: '', projetista: '', cliente: '', tipo: [], status: 'Na Fila', dataInicio: new Date().toISOString().split('T')[0], area: '', notas: ''
  });
  
  // Estados Específicos para a opção "Outro"
  const [isOutro, setIsOutro] = useState(false);
  const [outroValor, setOutroValor] = useState('');

  // Estados de Filtro (Aba Histórico)
  const [filtroProjetista, setFiltroProjetista] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [buscaTermo, setBuscaTermo] = useState('');

  // Estados das Configurações (Aba Configurações)
  const [novoUsuarioNome, setNovoUsuarioNome] = useState('');
  const [novoUsuarioSenha, setNovoUsuarioSenha] = useState('');
  const [novoUsuarioRole, setNovoUsuarioRole] = useState('projetista');
  const [novoTipoEstrutura, setNovoTipoEstrutura] = useState('');

  // Estados para Edição de Usuário
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserNome, setEditUserNome] = useState('');
  const [editUserSenha, setEditUserSenha] = useState('');
  const [editUserRole, setEditUserRole] = useState('projetista');

  // Estados para Edição de Tipo de Estrutura
  const [editingTipo, setEditingTipo] = useState(null); // string (nome antigo)
  const [editTipoInput, setEditTipoInput] = useState('');

  // Estado para o Modal de Detalhes do Projetista
  const [projetistaDetalhe, setProjetistaDetalhe] = useState(null);

  // --- Lógica de Acesso (Login Simples) ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = usuarios.find(u => u.nome === loginInput && u.senha === senhaInput);
    
    if (user) {
      setCurrentUser(user);
      setLoginInput('');
      setSenhaInput('');
      
      setActiveTab(user.role === 'admin' ? 'dashboard' : 'minhas-tarefas');
      
      if (user.role === 'projetista') {
        setFormData(prev => ({ ...prev, projetista: user.nome }));
      }
    } else {
      alert('Usuário ou senha incorretos! Verifique e tente novamente.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // --- Lógica do Formulário de Projetos ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTipoChange = (tipoOption) => {
    setFormData(prev => {
      const isSelected = prev.tipo.includes(tipoOption);
      return { 
        ...prev, 
        tipo: isSelected ? prev.tipo.filter(t => t !== tipoOption) : [...prev.tipo, tipoOption] 
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    let tiposSelecionados = [...formData.tipo];
    if (isOutro && outroValor.trim() !== '') {
      tiposSelecionados.push(outroValor.trim().toUpperCase());
    }

    if (tiposSelecionados.length === 0) {
      alert('Por favor, selecione pelo menos um Tipo de Estrutura ou preencha a opção "Outro".');
      return;
    }

    const baseId = Date.now();
    const novosProjetos = tiposSelecionados.map((tipoSelecionado, index) => ({
      ...formData,
      id: baseId + index,
      tipo: tipoSelecionado,
      area: Number(formData.area) || 0
    }));

    setProjetos(prev => [...novosProjetos, ...prev]);
    
    setFormData({
      codigo: '', 
      projetista: currentUser?.role === 'projetista' ? currentUser.nome : '', 
      cliente: '', tipo: [], status: 'Na Fila', dataInicio: new Date().toISOString().split('T')[0], area: '', notas: ''
    });
    setIsOutro(false);
    setOutroValor('');
    
    alert(novosProjetos.length > 1 ? `${novosProjetos.length} projetos cadastrados!` : 'Projeto cadastrado com sucesso!');
    setActiveTab(currentUser.role === 'admin' ? 'lista' : 'minhas-tarefas');
  };

  // --- Lógica para Mudar o Status de um Projeto ---
  const handleStatusChange = (idProjeto, novoStatus) => {
    setProjetos(prevProjetos => 
      prevProjetos.map(p => p.id === idProjeto ? { ...p, status: novoStatus } : p)
    );
  };

  const renderStatusDropdown = (projeto) => (
    <select
      value={projeto.status}
      onChange={(e) => handleStatusChange(projeto.id, e.target.value)}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors
        ${projeto.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 
          projeto.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 
          projeto.status === 'Revisão' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 
          projeto.status === 'Cancelado' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 
          'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}
      `}
    >
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  // --- Lógica de Filtros (Histórico) ---
  const projetosFiltrados = useMemo(() => {
    return projetos.filter(p => {
      const matchProjetista = filtroProjetista ? p.projetista === filtroProjetista : true;
      const matchStatus = filtroStatus ? p.status === filtroStatus : true;
      const matchBusca = buscaTermo ? 
        p.codigo.toLowerCase().includes(buscaTermo.toLowerCase()) || 
        p.cliente.toLowerCase().includes(buscaTermo.toLowerCase()) : true;
      return matchProjetista && matchStatus && matchBusca;
    });
  }, [projetos, filtroProjetista, filtroStatus, buscaTermo]);

  // --- Lógica do Dashboard ---
  const stats = useMemo(() => {
    const total = projetos.length;
    const concluidos = projetos.filter(p => p.status === 'Concluído').length;
    const emAndamento = projetos.filter(p => p.status === 'Em Andamento' || p.status === 'Revisão').length;
    
    const porProjetista = projetos.reduce((acc, p) => {
      if (!acc[p.projetista]) {
        acc[p.projetista] = { total: 0, porStatus: {} };
      }
      acc[p.projetista].total += 1;
      acc[p.projetista].porStatus[p.status] = (acc[p.projetista].porStatus[p.status] || 0) + 1;
      return acc;
    }, {});

    const rankingProjetistas = Object.entries(porProjetista)
      .map(([nome, dados]) => ({ nome, ...dados }))
      .sort((a, b) => b.total - a.total);

    return { total, concluidos, emAndamento, rankingProjetistas };
  }, [projetos]);

  // --- Lógica de Configurações (Usuários) ---
  const adicionarUsuario = (e) => {
    e.preventDefault();
    if (novoUsuarioNome.trim() && novoUsuarioSenha.trim() && !usuarios.some(u => u.nome === novoUsuarioNome.trim())) {
      setUsuarios([...usuarios, { 
        id: Date.now(), 
        nome: novoUsuarioNome.trim(), 
        senha: novoUsuarioSenha.trim(), 
        role: novoUsuarioRole 
      }]);
      setNovoUsuarioNome('');
      setNovoUsuarioSenha('');
      setNovoUsuarioRole('projetista');
    } else {
      alert('Preencha os campos ou escolha um nome de usuário que ainda não exista.');
    }
  };

  const removerUsuario = (id) => {
    const user = usuarios.find(u => u.id === id);
    if (user.id === currentUser.id) {
      alert('Você não pode excluir o seu próprio usuário enquanto está logado.');
      return;
    }

    const temProjetos = projetos.some(p => p.projetista === user.nome);
    if (temProjetos) {
      alert(`Não é possível excluir "${user.nome}" porque há projetos em seu nome. Você pode editar a senha ou o nome dele no botão de edição.`);
      return;
    }

    if(window.confirm(`Tem certeza que deseja remover ${user.nome}?`)) {
      setUsuarios(usuarios.filter(u => u.id !== id));
    }
  };

  const salvarEdicaoUsuario = (id) => {
    const newNome = editUserNome.trim();
    if (!newNome || !editUserSenha.trim()) {
      alert("O nome e a senha não podem ser vazios.");
      return;
    }

    const userToEdit = usuarios.find(u => u.id === id);
    const oldNome = userToEdit.nome;

    if (newNome !== oldNome && usuarios.some(u => u.nome === newNome)) {
      alert("Já existe outro usuário com esse nome.");
      return;
    }

    // Atualiza a lista de usuários
    setUsuarios(usuarios.map(u => u.id === id ? { ...u, nome: newNome, senha: editUserSenha.trim(), role: editUserRole } : u));
    
    // Se o nome mudou, transfere todos os projetos do nome antigo para o nome novo
    if (newNome !== oldNome) {
      setProjetos(prev => prev.map(p => p.projetista === oldNome ? { ...p, projetista: newNome } : p));
    }

    // Se o usuário editou a si mesmo, atualiza a sessão logada para não bugar
    if (currentUser.id === id) {
      setCurrentUser({ id, nome: newNome, senha: editUserSenha.trim(), role: editUserRole });
    }

    setEditingUserId(null);
  };

  // --- Lógica de Configurações (Tipos de Estrutura) ---
  const adicionarTipoEstrutura = (e) => {
    e.preventDefault();
    const tipo = novoTipoEstrutura.trim().toUpperCase();
    if (tipo && !tiposEstrutura.includes(tipo)) {
      setTiposEstrutura([...tiposEstrutura, tipo]);
      setNovoTipoEstrutura('');
    }
  };

  const removerTipoEstrutura = (tipo) => {
    if(window.confirm(`Tem certeza que deseja remover o tipo "${tipo}"? Os projetos que já usam esse tipo não serão apagados.`)) {
      setTiposEstrutura(tiposEstrutura.filter(t => t !== tipo));
    }
  };

  const salvarEdicaoTipo = (oldTipo) => {
    const newTipo = editTipoInput.trim().toUpperCase();
    if (!newTipo) return;
    
    if (newTipo !== oldTipo && tiposEstrutura.includes(newTipo)) {
      alert('Já existe uma estrutura com esse nome.');
      return;
    }

    setTiposEstrutura(prev => prev.map(t => t === oldTipo ? newTipo : t));
    
    // Atualiza os projetos existentes que tinham o nome antigo para o novo
    if (newTipo !== oldTipo) {
      setProjetos(prev => prev.map(p => p.tipo === oldTipo ? { ...p, tipo: newTipo } : p));
    }

    setEditingTipo(null);
  };

  // --- Modal de Detalhes do Projetista ---
  const renderModalDetalhes = () => {
    if (!projetistaDetalhe) return null;
    const projetosDoProjetista = projetos.filter(p => p.projetista === projetistaDetalhe);

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-blue-600" /> Projetos sob responsabilidade de: <span className="text-blue-700">{projetistaDetalhe}</span>
              </h3>
              <p className="text-sm text-slate-500 mt-1">Total de {projetosDoProjetista.length} projeto(s) encontrados.</p>
            </div>
            <button onClick={() => setProjetistaDetalhe(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors" title="Fechar">
              <X size={24} />
            </button>
          </div>
          <div className="overflow-y-auto p-6 bg-slate-100">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="px-6 py-4">Código / Cliente</th>
                    <th className="px-6 py-4">Data Entrada</th>
                    <th className="px-6 py-4">Tipo Estrutura</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projetosDoProjetista.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">Nenhum projeto encontrado.</td></tr>
                  ) : (
                    projetosDoProjetista.map(projeto => (
                      <tr key={projeto.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{projeto.codigo}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{projeto.cliente}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 flex items-center gap-2 mt-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          {projeto.dataInicio.split('-').reverse().join('/')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-700 font-medium uppercase text-xs">{projeto.tipo}</div>
                          {projeto.area > 0 && <div className="text-slate-500 text-xs mt-0.5">{projeto.area} m²</div>}
                        </td>
                        <td className="px-6 py-4">
                          {renderStatusDropdown(projeto)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Renderização dos Componentes das Abas ---

  const renderMinhasTarefas = () => {
    const meusProjetos = projetos.filter(p => p.projetista === currentUser?.nome);
    
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Briefcase className="text-blue-600" /> Minhas Tarefas
            </h2>
            <p className="text-slate-500 text-sm mt-1">Bem-vindo, <strong>{currentUser?.nome}</strong>. Acompanhe e atualize seus projetos abaixo.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Código / Cliente</th>
                  <th className="px-6 py-4">Data Entrada</th>
                  <th className="px-6 py-4">Tipo Estrutura</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meusProjetos.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      <CheckCircle2 size={32} className="mx-auto mb-3 text-slate-300" />
                      Nenhum projeto na sua fila no momento!
                    </td>
                  </tr>
                ) : (
                  meusProjetos.map(projeto => (
                    <tr key={projeto.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{projeto.codigo}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{projeto.cliente}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 flex items-center gap-2 mt-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        {projeto.dataInicio.split('-').reverse().join('/')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 font-medium uppercase text-xs">{projeto.tipo}</div>
                      </td>
                      <td className="px-6 py-4">
                        {renderStatusDropdown(projeto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="min-h-[70vh] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-100 text-blue-800 p-4 rounded-full mb-4 shadow-sm">
            <Lock size={36} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 text-center">Acesso ao Sistema</h2>
          <p className="text-slate-500 text-sm text-center mt-2">Selecione seu usuário e digite a senha.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Usuário</label>
            <select 
              required
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 font-medium"
            >
              <option value="">Selecione seu perfil...</option>
              {usuarios.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Senha</label>
            <input 
              required
              type="password" 
              value={senhaInput}
              onChange={(e) => setSenhaInput(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all tracking-widest bg-slate-50"
              placeholder="••••••"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-800 hover:bg-blue-900 text-white font-semibold py-3.5 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 mt-4"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <BarChart3 className="text-blue-600" /> Visão Geral da Produção
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
            <HardHat size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total de Projetos</p>
            <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-700 rounded-lg">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Concluídos</p>
            <p className="text-3xl font-bold text-slate-800">{stats.concluidos}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Em Andamento/Revisão</p>
            <p className="text-3xl font-bold text-slate-800">{stats.emAndamento}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Quadro Consolidado por Responsável</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Responsável</th>
                <th className="px-6 py-4 text-center">Volume Total</th>
                <th className="px-6 py-4 text-center text-slate-500">Na Fila</th>
                <th className="px-6 py-4 text-center text-blue-600">Em Andamento</th>
                <th className="px-6 py-4 text-center text-amber-600">Revisão</th>
                <th className="px-6 py-4 text-center text-green-600">Concluído</th>
                <th className="px-6 py-4 text-center text-red-600">Cancelado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.rankingProjetistas.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">Nenhum dado registrado.</td></tr>
              ) : (
                stats.rankingProjetistas.map((proj, idx) => {
                  const percentage = Math.round((proj.total / stats.total) * 100) || 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td 
                        className="px-6 py-4 font-semibold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline transition-all"
                        onClick={() => setProjetistaDetalhe(proj.nome)}
                      >
                        {proj.nome}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <span className="font-bold text-slate-800 w-6 text-right">{proj.total}</span>
                          <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden hidden sm:block">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-600 bg-slate-50/50">{proj.porStatus['Na Fila'] || '-'}</td>
                      <td className="px-6 py-4 text-center font-medium text-blue-700 bg-blue-50/30">{proj.porStatus['Em Andamento'] || '-'}</td>
                      <td className="px-6 py-4 text-center font-medium text-amber-700 bg-amber-50/30">{proj.porStatus['Revisão'] || '-'}</td>
                      <td className="px-6 py-4 text-center font-medium text-green-700 bg-green-50/30">{proj.porStatus['Concluído'] || '-'}</td>
                      <td className="px-6 py-4 text-center font-medium text-red-700 bg-red-50/30">{proj.porStatus['Cancelado'] || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
        <FilePlus className="text-blue-600" /> Cadastrar Novo Projeto
      </h2>
      <p className="text-slate-500 text-sm mb-6">Preencha os dados abaixo para registrar suas frentes de trabalho.</p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Código do Projeto *</label>
            <input required type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ex: OS-2026-105" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Data de Entrada *</label>
            <input required type="date" name="dataInicio" value={formData.dataInicio} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Responsável *</label>
            <select 
              required
              name="projetista"
              value={formData.projetista}
              onChange={handleInputChange}
              disabled={currentUser?.role === 'projetista'}
              className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${currentUser?.role === 'projetista' ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white'}`}
            >
              <option value="">Selecione na lista...</option>
              {usuarios.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Cliente / Obra *</label>
            <input required type="text" name="cliente" value={formData.cliente} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Construtora ou obra" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1 md:col-span-1">
            <label className="text-sm font-medium text-slate-700">Área (m²) / Volume</label>
            <input type="number" name="area" value={formData.area} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Valor (opcional)" />
          </div>
          <div className="space-y-1 md:col-span-1">
            <label className="text-sm font-medium text-slate-700">Status Inicial</label>
            <select name="status" value={formData.status} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white font-medium text-blue-700">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-800 uppercase tracking-wide">Tipo *</label>
          <div className="flex flex-col gap-3 ml-1">
            {tiposEstrutura.map(t => (
              <label key={t} className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={formData.tipo.includes(t)} onChange={() => handleTipoChange(t)} className="w-5 h-5 text-blue-600 rounded border-slate-400 focus:ring-blue-500 cursor-pointer" />
                <span className="text-slate-800 text-[15px] group-hover:text-blue-700 transition-colors uppercase">{t}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer group mt-1">
              <input type="checkbox" checked={isOutro} onChange={() => setIsOutro(!isOutro)} className="w-5 h-5 text-blue-600 rounded border-slate-400 focus:ring-blue-500 cursor-pointer" />
              <span className="text-slate-800 text-[15px] uppercase mr-2">Outro:</span>
              <input type="text" value={outroValor} onChange={(e) => setOutroValor(e.target.value)} disabled={!isOutro} className={`flex-1 border-b ${isOutro ? 'border-slate-500 focus:border-blue-600' : 'border-slate-300 bg-slate-50 cursor-not-allowed'} py-1 outline-none text-[15px] uppercase transition-colors`} placeholder={isOutro ? "Digite a estrutura..." : ""} />
            </label>
          </div>
        </div>

        <div className="space-y-1 pt-2">
          <label className="text-sm font-medium text-slate-700">Observações Gerais</label>
          <textarea name="notas" value={formData.notas} onChange={handleInputChange} rows="2" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" placeholder="Informações adicionais para a gestão..."></textarea>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button type="submit" className="w-full sm:w-auto bg-blue-800 hover:bg-blue-900 text-white font-medium py-3 px-8 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 text-lg">
            <Save size={22} /> Salvar Formulário
          </button>
        </div>
      </form>
    </div>
  );

  const renderList = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ListTodo className="text-blue-600" /> Tabela de Projetos Gerados
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Buscar código ou cliente..." value={buscaTermo} onChange={(e) => setBuscaTermo(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64" />
          </div>
          <select value={filtroProjetista} onChange={(e) => setFiltroProjetista(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos Responsáveis</option>
            {usuarios.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Código / Cliente</th>
              <th className="px-6 py-4">Responsável</th>
              <th className="px-6 py-4">Data Entrada</th>
              <th className="px-6 py-4">Tipo Estrutura</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projetosFiltrados.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500"><Filter size={32} className="mx-auto mb-3 text-slate-300" />Nenhum projeto encontrado.</td></tr>
            ) : (
              projetosFiltrados.map(projeto => (
                <tr key={projeto.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{projeto.codigo}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{projeto.cliente}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium">{projeto.projetista}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 flex items-center gap-2 mt-1.5"><Calendar size={14} className="text-slate-400" />{projeto.dataInicio.split('-').reverse().join('/')}</td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700 font-medium uppercase text-xs">{projeto.tipo}</div>
                    {projeto.area > 0 && <div className="text-slate-500 text-xs mt-0.5">{projeto.area} m²</div>}
                  </td>
                  <td className="px-6 py-4">{renderStatusDropdown(projeto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
        <Settings className="text-blue-600" /> Configurações do Sistema
      </h2>
      <p className="text-slate-500 mb-6">Gerencie usuários, níveis de acesso, senhas e tipos de estrutura.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bloco Usuários e Senhas */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b border-slate-100 pb-3">
            <ShieldAlert size={20} className="text-blue-600" /> Controle de Acessos
          </div>
          
          <form onSubmit={adicionarUsuario} className="flex flex-col gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" value={novoUsuarioNome} onChange={e => setNovoUsuarioNome(e.target.value)} placeholder="Nome do usuário" className="flex-1 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="text" value={novoUsuarioSenha} onChange={e => setNovoUsuarioSenha(e.target.value)} placeholder="Senha" className="w-full sm:w-28 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={novoUsuarioRole} onChange={e => setNovoUsuarioRole(e.target.value)} className="flex-1 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="projetista">Acesso Padrão (Projetista)</option>
                <option value="admin">Gestor Geral (Administrador)</option>
              </select>
              <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 p-2 rounded-lg transition-colors font-medium flex justify-center items-center gap-1 text-sm px-4">
                <Plus size={16} /> <span className="sm:hidden">Adicionar</span>
              </button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[400px]">
            {usuarios.map(u => {
              const isEditing = editingUserId === u.id;
              
              return (
                <div key={u.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-colors ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2 mb-2 sm:mb-0 sm:mr-2">
                      <div className="flex gap-2">
                        <input type="text" value={editUserNome} onChange={e => setEditUserNome(e.target.value)} className="flex-1 p-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nome" />
                        <input type="text" value={editUserSenha} onChange={e => setEditUserSenha(e.target.value)} className="w-24 p-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Senha" />
                      </div>
                      <select value={editUserRole} onChange={e => setEditUserRole(e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                        <option value="projetista">Projetista</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{u.nome}</span>
                      <div className="flex gap-3 text-xs mt-1">
                        <span className="text-slate-500 font-mono">Senha: {u.senha}</span>
                        <span className={`font-semibold ${u.role === 'admin' ? 'text-blue-600' : 'text-slate-500'}`}>{u.role === 'admin' ? 'Admin' : 'Projetista'}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1 self-end sm:self-auto mt-2 sm:mt-0">
                    {isEditing ? (
                      <>
                        <button onClick={() => salvarEdicaoUsuario(u.id)} className="text-green-600 hover:text-green-800 p-2 hover:bg-green-100 rounded transition-colors" title="Salvar">
                          <CheckCircle2 size={18} />
                        </button>
                        <button onClick={() => setEditingUserId(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded transition-colors" title="Cancelar">
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingUserId(u.id); setEditUserNome(u.nome); setEditUserSenha(u.senha); setEditUserRole(u.role); }} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition-colors" title="Editar Usuário">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => removerUsuario(u.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors" title="Remover Usuário">
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bloco Tipos de Estrutura */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b border-slate-100 pb-3">
            <Wrench size={20} className="text-blue-600" /> Tipos de Estrutura (Checkbox)
          </div>
          
          <form onSubmit={adicionarTipoEstrutura} className="flex gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <input type="text" value={novoTipoEstrutura} onChange={e => setNovoTipoEstrutura(e.target.value)} placeholder="Nova estrutura..." className="flex-1 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
            <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 p-2 rounded-lg transition-colors font-medium flex items-center gap-1 text-sm px-3">
              <Plus size={16} /> Adicionar
            </button>
          </form>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[400px]">
            {tiposEstrutura.map(t => {
              const isEditing = editingTipo === t;

              return (
                <div key={t} className={`flex justify-between items-center p-3 rounded-lg border transition-colors ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                  {isEditing ? (
                    <input type="text" value={editTipoInput} onChange={e => setEditTipoInput(e.target.value)} className="flex-1 p-1.5 mr-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="Nome da estrutura..." />
                  ) : (
                    <span className="text-sm font-bold text-slate-700 uppercase">{t}</span>
                  )}
                  
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button onClick={() => salvarEdicaoTipo(t)} className="text-green-600 hover:text-green-800 p-2 hover:bg-green-100 rounded transition-colors" title="Salvar">
                          <CheckCircle2 size={18} />
                        </button>
                        <button onClick={() => setEditingTipo(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded transition-colors" title="Cancelar">
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingTipo(t); setEditTipoInput(t); }} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition-colors" title="Editar Estrutura">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => removerTipoEstrutura(t)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors" title="Remover Estrutura">
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 opacity-60">
              <span className="text-sm font-bold text-slate-700 uppercase">OUTRO (Aberto para texto)</span>
              <span className="text-xs text-slate-400 italic">Padrão do sistema</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <header className="bg-blue-900 text-white shadow-md relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-lg">
              <HardHat className="text-blue-900" size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Mais Escoramentos</h1>
          </div>
          
          {currentUser && (
            <div className="flex items-center gap-4">
              <span className="text-blue-200 text-sm hidden sm:block">
                Olá, <strong className="text-white">{currentUser.nome}</strong>
              </span>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors border border-blue-700">
                <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentUser ? (
          renderLogin()
        ) : (
          <>
            <div className="flex flex-wrap gap-2 bg-slate-200 p-1.5 rounded-xl mb-8 w-full md:w-fit border border-slate-300 shadow-sm">
              <button onClick={() => setActiveTab('minhas-tarefas')} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'minhas-tarefas' ? 'bg-white text-blue-800 shadow shadow-slate-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300'}`}>
                <Briefcase size={18} /> {currentUser.role === 'admin' ? 'Ver Meus Projetos' : 'Minhas Tarefas'}
              </button>
              <button onClick={() => setActiveTab('form')} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'form' ? 'bg-white text-blue-800 shadow shadow-slate-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300'}`}>
                <FilePlus size={18} /> Novo Projeto
              </button>

              {currentUser.role === 'admin' && (
                <>
                  <div className="w-px bg-slate-300 my-1 mx-1 hidden sm:block"></div>
                  <button onClick={() => setActiveTab('dashboard')} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white text-blue-800 shadow shadow-slate-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300'}`}>
                    <LayoutDashboard size={18} /> Dashboard
                  </button>
                  <button onClick={() => setActiveTab('lista')} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'lista' ? 'bg-white text-blue-800 shadow shadow-slate-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300'}`}>
                    <ListTodo size={18} /> Histórico Geral
                  </button>
                  <button onClick={() => setActiveTab('config')} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'config' ? 'bg-white text-blue-800 shadow shadow-slate-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300'}`}>
                    <Settings size={18} /> Configurações
                  </button>
                </>
              )}
            </div>

            <div className="pb-12">
              {activeTab === 'form' && renderForm()}
              {activeTab === 'minhas-tarefas' && renderMinhasTarefas()}
              {activeTab === 'dashboard' && currentUser.role === 'admin' && renderDashboard()}
              {activeTab === 'lista' && currentUser.role === 'admin' && renderList()}
              {activeTab === 'config' && currentUser.role === 'admin' && renderConfig()}
            </div>
          </>
        )}
      </main>
      {renderModalDetalhes()}
    </div>
  );
}