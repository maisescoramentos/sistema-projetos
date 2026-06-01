import React, { useState, useMemo, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, doc, getDocs, addDoc, setDoc, deleteDoc, updateDoc, onSnapshot, writeBatch
} from 'firebase/firestore';
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
  ShieldAlert,
  BookOpen,
  FileText,
  Hash,
  Building2,
  Weight,
  Layers,
  Ruler,
  AlertTriangle,
  ChevronRight,
  Download
} from 'lucide-react';

// Dados de exemplo atualizados com as novas nomenclaturas e equipe real
const MOCK_DATA = [];

// (6) Status simplificado: apenas Concluído e Revisão
const STATUS_OPTIONS = ['Concluído', 'Revisão'];

// (6/7) Motivos de revisão padronizados (com opção "Outro motivo" livre)
const MOTIVOS_REVISAO = [
  'TROCA POR FALTA DE MATERIAL',
  'PROBLEMA NO EQUIPAMENTO',
  'PROJETO DE ESTRUTURA NÃO ATUALIZADO',
  'FALTA DE INFORMAÇÃO DE OBRA',
  'ERRO DE PROJETO DE ESCORAMENTO',
  'ADEQUAÇÃO À TAXA DE PROJETO',
  'NECESSIDADE DE ADAPTAÇÃO POR CONTA DO TERRENO',
  'SOLICITAÇÃO DO CLIENTE',
  'ERRO DE ORÇAMENTO COMERCIAL',
  'OUTRO MOTIVO'
];

// (8) Classificação do projeto recebido do cliente
const PROJETO_CLIENTE_OPCOES = [
  'Chegou com prazo',
  'Chegou atrasado',
  'Sofreu revisão',
  'Necessidade de adaptação por conta do terreno'
];

// Helper: validar máscara do contrato XXX/XXXX
const CONTRATO_REGEX = /^\d{3}\/\d{4}$/;

// Helper: formatar número da revisão com 2 dígitos
const formatarRevisao = (valor) => {
  const num = parseInt(valor, 10);
  if (Number.isNaN(num) || num <= 0) return '';
  return String(num).padStart(2, '0');
};

// Helper: estado inicial do formulário
const initialFormData = () => ({
  numeroContrato: '',
  projetista: '',
  cliente: '',
  tipo: [],
  status: 'Concluído',
  dataInicio: new Date().toISOString().split('T')[0],
  dataFim: '',
  area: '',
  peDireito: '',
  pavimento: '',
  peso: '',
  pesoPorTipo: {},
  numeroRevisao: '',
  motivoRevisao: '',
  outroMotivoTexto: '',
  projetoCliente: '',
  notas: ''
});

export default function App() {
  // --- Controle de Acesso e Usuários ---
  const [currentUser, setCurrentUser] = useState(null);
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Abas de navegação
  const [activeTab, setActiveTab] = useState('minhas-tarefas');

  // Sistema de Usuários com ID para permitir renomear com segurança
  const USUARIOS_PADRAO = [
    { id: 'u1', nome: 'Fernanda', senha: 'admin', role: 'admin' },
    { id: 'u2', nome: 'Samuell', senha: '123', role: 'projetista' },
    { id: 'u3', nome: 'Vinicius', senha: '123', role: 'projetista' },
    { id: 'u4', nome: 'Victor', senha: '123', role: 'projetista' },
    { id: 'u5', nome: 'Valéria', senha: '123', role: 'projetista' }
  ];
  const [usuarios, setUsuarios] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  const TIPOS_PADRAO = [
    'FORMA', 'TRAVAMENTO DE PILAR', 'TRAVAMENTO DE VIGAS',
    'ESCORAMENTO DE VIGAS', 'ESCORAMENTOS DE LAJE',
    'REESCORAMENTO 100%', 'REESCORAMENTO 50%', 'DETALHAMENTO'
  ];
  const [tiposEstrutura, setTiposEstrutura] = useState([]);

  // Estados Gerais
  const [projetos, setProjetos] = useState([]);


  // --- Firestore: listeners em tempo real ---
  useEffect(() => {
    // Usuários
    const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), async (snap) => {
      if (snap.empty) {
        // Primeira vez: seed dos usuários padrão
        const batch = writeBatch(db);
        USUARIOS_PADRAO.forEach(u => {
          batch.set(doc(db, 'usuarios', u.id), u);
        });
        await batch.commit();
      } else {
        setUsuarios(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      }
    });

    // Tipos de estrutura
    const unsubTipos = onSnapshot(doc(db, 'config', 'tiposEstrutura'), async (snap) => {
      if (!snap.exists()) {
        await setDoc(doc(db, 'config', 'tiposEstrutura'), { lista: TIPOS_PADRAO });
      } else {
        setTiposEstrutura(snap.data().lista || TIPOS_PADRAO);
      }
    });

    // Projetos
    const unsubProjetos = onSnapshot(collection(db, 'projetos'), (snap) => {
      const lista = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      lista.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
      setProjetos(lista);
      setDbLoading(false);
    });

    return () => { unsubUsuarios(); unsubTipos(); unsubProjetos(); };
  }, []);

    // Estados do Formulário Principal (todos os novos campos incluídos)
  const [formData, setFormData] = useState(initialFormData());

  // Estados Específicos para a opção "Outro" no Tipo de Estrutura
  const [isOutro, setIsOutro] = useState(false);
  const [outroValor, setOutroValor] = useState('');

  // Estados de Edição/Exclusão de Projeto
  const [editandoProjetoId, setEditandoProjetoId] = useState(null);
  const [formEdicao, setFormEdicao] = useState({});
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState(null);

  // Estados de Filtro (Aba Histórico)
  const [filtroProjetista, setFiltroProjetista] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [buscaTermo, setBuscaTermo] = useState('');

  // (9) Estados de Filtro do Dashboard
  const [dashPeriodoInicio, setDashPeriodoInicio] = useState('');
  const [dashPeriodoFim, setDashPeriodoFim] = useState('');
  const [dashFiltroProjetista, setDashFiltroProjetista] = useState('');
  const [dashFiltroStatus, setDashFiltroStatus] = useState('');

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
  const [editingTipo, setEditingTipo] = useState(null);
  const [editTipoInput, setEditTipoInput] = useState('');

  // Estado para o Modal de Detalhes do Projetista
  const [projetistaDetalhe, setProjetistaDetalhe] = useState(null);

  // (10) Estado para abrir/fechar o modal de Documentação Técnica
  const [showDocs, setShowDocs] = useState(false);
  const [docsSection, setDocsSection] = useState('visao-geral');

  // --- Lógica de Acesso (Login Simples) ---
  const handleLogin = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    // Sanitiza entrada (remove espaços invisíveis antes/depois)
    const nomeDigitado = (loginInput || '').trim();
    const senhaDigitada = (senhaInput || '').trim();
    setLoginError('');

    const userPorNome = usuarios.find(u => u.nome === nomeDigitado);

    if (!userPorNome) {
      setLoginError('Selecione um usuário válido na lista.');
      return;
    }

    if (userPorNome.senha !== senhaDigitada) {
      setLoginError(`Senha incorreta para "${userPorNome.nome}". Confira maiúsculas/minúsculas.`);
      return;
    }

    // Login válido
    setCurrentUser(userPorNome);
    setLoginInput('');
    setSenhaInput('');
    setLoginError('');
    setActiveTab(userPorNome.role === 'admin' ? 'dashboard' : 'minhas-tarefas');

    if (userPorNome.role === 'projetista') {
      setFormData(prev => ({ ...prev, projetista: userPorNome.nome }));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // --- Lógica do Formulário de Projetos ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // Se o status sair de "Revisão", limpa os campos vinculados
      if (name === 'status' && value !== 'Revisão') {
        next.motivoRevisao = '';
        next.outroMotivoTexto = '';
        next.numeroRevisao = '';
      }
      return next;
    });
  };

  // (1) Máscara automática para o número do contrato: XXX/XXXX
  const handleContratoChange = (e) => {
    let valor = e.target.value.replace(/\D/g, '').slice(0, 7);
    if (valor.length > 3) {
      valor = `${valor.slice(0, 3)}/${valor.slice(3)}`;
    }
    setFormData(prev => ({ ...prev, numeroContrato: valor }));
  };

  // (7) Garante o formato 2 dígitos do número da revisão ao sair do campo
  const handleRevisaoBlur = () => {
    setFormData(prev => ({ ...prev, numeroRevisao: formatarRevisao(prev.numeroRevisao) }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação: formato do contrato
    if (!CONTRATO_REGEX.test(formData.numeroContrato)) {
      alert('Número do contrato inválido. Use o padrão XXX/XXXX (ex: 105/2026).');
      return;
    }

    // Validação: tipo
    let tiposSelecionados = [...formData.tipo];
    if (isOutro && outroValor.trim() !== '') {
      tiposSelecionados.push(outroValor.trim().toUpperCase());
    }
    if (tiposSelecionados.length === 0) {
      alert('Por favor, selecione pelo menos um Tipo de Estrutura ou preencha a opção "Outro".');
      return;
    }

    // Validação: se status = Revisão, exige motivo e número
    if (formData.status === 'Revisão') {
      if (!formData.motivoRevisao) {
        alert('Selecione o motivo da revisão.');
        return;
      }
      if (formData.motivoRevisao === 'OUTRO MOTIVO' && !formData.outroMotivoTexto.trim()) {
        alert('Descreva o "Outro motivo" da revisão.');
        return;
      }
      if (!formData.numeroRevisao) {
        alert('Informe o número da revisão (ex: 01, 02, 03...).');
        return;
      }
    }

    // Validação: data fim >= data início (se preenchida)
    if (formData.dataFim && formData.dataFim < formData.dataInicio) {
      alert('A "Data de finalização" não pode ser anterior à "Data de início".');
      return;
    }

    const baseId = Date.now();
    const numeroRevisaoFinal = formData.status === 'Revisão'
      ? formatarRevisao(formData.numeroRevisao)
      : '';

    const motivoFinal = formData.motivoRevisao === 'OUTRO MOTIVO'
      ? `OUTRO MOTIVO: ${formData.outroMotivoTexto.trim()}`
      : formData.motivoRevisao;

    const novosProjetos = tiposSelecionados.map((tipoSelecionado, index) => {
      const chave = tipoSelecionado === (isOutro && outroValor.trim() ? outroValor.trim().toUpperCase() : null)
        ? '__outro__'
        : tipoSelecionado;
      const pesoDoTipo = Number((formData.pesoPorTipo || {})[chave] || (formData.pesoPorTipo || {})[tipoSelecionado] || 0);
      return {
        ...formData,
        id: baseId + index,
        tipo: tipoSelecionado,
        area: Number(formData.area) || 0,
        peDireito: Number(formData.peDireito) || 0,
        pavimento: formData.pavimento || '',
        peso: pesoDoTipo,
        pesoPorTipo: undefined,
        numeroRevisao: numeroRevisaoFinal,
        motivoRevisao: formData.status === 'Revisão' ? motivoFinal : ''
      };
    });

    // Salvar cada projeto no Firestore
    try {
      await Promise.all(novosProjetos.map(p => {
        const { id, ...dados } = p;
        return addDoc(collection(db, 'projetos'), { ...dados, criadoEm: Date.now() });
      }));
    } catch (err) {
      alert('Erro ao salvar no banco de dados: ' + err.message);
      return;
    }

    // Reset preservando o projetista logado (quando for projetista)
    setFormData({
      ...initialFormData(),
      projetista: currentUser?.role === 'projetista' ? currentUser.nome : ''
    });
    setIsOutro(false);
    setOutroValor('');

    alert(novosProjetos.length > 1
      ? `${novosProjetos.length} projetos cadastrados!`
      : 'Projeto cadastrado com sucesso!');
    setActiveTab(currentUser.role === 'admin' ? 'lista' : 'minhas-tarefas');
  };

  // --- Lógica para Mudar o Status de um Projeto ---
  const handleStatusChange = async (idProjeto, novoStatus) => {
    try {
      await updateDoc(doc(db, 'projetos', String(idProjeto)), { status: novoStatus });
    } catch (err) { alert('Erro ao atualizar status: ' + err.message); }
  };

  const renderStatusDropdown = (projeto) => (
    <select
      value={projeto.status}
      onChange={(e) => handleStatusChange(projeto.id, e.target.value)}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors
        ${projeto.status === 'Concluído'
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          : projeto.status === 'Revisão'
          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}
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
      const matchBusca = buscaTermo
        ? (p.numeroContrato || '').toLowerCase().includes(buscaTermo.toLowerCase()) ||
          (p.cliente || '').toLowerCase().includes(buscaTermo.toLowerCase())
        : true;
      return matchProjetista && matchStatus && matchBusca;
    });
  }, [projetos, filtroProjetista, filtroStatus, buscaTermo]);

  // (9) Dashboard com filtros de período, projetista e status
  const projetosNoPeriodo = useMemo(() => {
    return projetos.filter(p => {
      const data = p.dataInicio || '';
      if (dashPeriodoInicio && data < dashPeriodoInicio) return false;
      if (dashPeriodoFim && data > dashPeriodoFim) return false;
      if (dashFiltroProjetista && p.projetista !== dashFiltroProjetista) return false;
      if (dashFiltroStatus && p.status !== dashFiltroStatus) return false;
      return true;
    });
  }, [projetos, dashPeriodoInicio, dashPeriodoFim, dashFiltroProjetista, dashFiltroStatus]);

  const stats = useMemo(() => {
    const base = projetosNoPeriodo;
    const total = base.length;
    const concluidos = base.filter(p => p.status === 'Concluído').length;
    const emRevisao = base.filter(p => p.status === 'Revisão').length;

    // Ranking por projetista com status
    const porProjetista = base.reduce((acc, p) => {
      if (!acc[p.projetista]) {
        acc[p.projetista] = { total: 0, porStatus: {}, porTipo: {} };
      }
      acc[p.projetista].total += 1;
      acc[p.projetista].porStatus[p.status] = (acc[p.projetista].porStatus[p.status] || 0) + 1;
      const tipoKey = p.tipo || 'Não informado';
      acc[p.projetista].porTipo[tipoKey] = (acc[p.projetista].porTipo[tipoKey] || 0) + 1;
      return acc;
    }, {});

    const rankingProjetistas = Object.entries(porProjetista)
      .map(([nome, dados]) => ({
        nome,
        ...dados,
        percentual: total > 0 ? Math.round((dados.total / total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    // Todos os tipos únicos presentes no período
    const tiposUnicos = [...new Set(base.map(p => p.tipo || 'Não informado'))].sort();

    // Contagem de projetos por tipo (geral)
    const porTipoGeral = base.reduce((acc, p) => {
      const t = p.tipo || 'Não informado';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const rankingTipos = Object.entries(porTipoGeral)
      .map(([tipo, qtd]) => ({ tipo, qtd, percentual: total > 0 ? Math.round((qtd / total) * 100) : 0 }))
      .sort((a, b) => b.qtd - a.qtd);

    // Motivos de revisão
    const revisoes = base.filter(p => p.status === 'Revisão');
    const totalRevisoes = revisoes.length;
    const porMotivo = revisoes.reduce((acc, p) => {
      const motivo = p.motivoRevisao || 'Não informado';
      acc[motivo] = (acc[motivo] || 0) + 1;
      return acc;
    }, {});

    const rankingMotivos = Object.entries(porMotivo)
      .map(([motivo, qtd]) => ({
        motivo,
        qtd,
        percentual: totalRevisoes > 0 ? Math.round((qtd / totalRevisoes) * 100) : 0
      }))
      .sort((a, b) => b.qtd - a.qtd);

    return {
      total,
      concluidos,
      emRevisao,
      rankingProjetistas,
      tiposUnicos,
      rankingTipos,
      totalRevisoes,
      rankingMotivos
    };
  }, [projetosNoPeriodo]);

  // --- Lógica de Configurações (Usuários) ---
  const adicionarUsuario = async (e) => {
    e.preventDefault();
    if (novoUsuarioNome.trim() && novoUsuarioSenha.trim() && !usuarios.some(u => u.nome === novoUsuarioNome.trim())) {
      try {
        const novoDoc = await addDoc(collection(db, 'usuarios'), {
          nome: novoUsuarioNome.trim(),
          senha: novoUsuarioSenha.trim(),
          role: novoUsuarioRole
        });
        // onSnapshot já vai atualizar a lista automaticamente
        setNovoUsuarioNome('');
        setNovoUsuarioSenha('');
        setNovoUsuarioRole('projetista');
      } catch (err) { alert('Erro ao adicionar usuário: ' + err.message); }
    } else {
      alert('Preencha os campos ou escolha um nome de usuário que ainda não exista.');
    }
  };

  const removerUsuario = async (id) => {
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

    if (window.confirm(`Tem certeza que deseja remover ${user.nome}?`)) {
      try {
        await deleteDoc(doc(db, 'usuarios', String(id)));
      } catch (err) { alert('Erro ao remover usuário: ' + err.message); }
    }
  };

  const salvarEdicaoUsuario = async (id) => {
    const newNome = editUserNome.trim();
    if (!newNome || !editUserSenha.trim()) {
      alert('O nome e a senha não podem ser vazios.');
      return;
    }

    const userToEdit = usuarios.find(u => u.id === id);
    const oldNome = userToEdit.nome;

    if (newNome !== oldNome && usuarios.some(u => u.nome === newNome)) {
      alert('Já existe outro usuário com esse nome.');
      return;
    }

    try {
      await updateDoc(doc(db, 'usuarios', String(id)), {
        nome: newNome, senha: editUserSenha.trim(), role: editUserRole
      });
      if (newNome !== oldNome) {
        // Atualiza todos os projetos do usuário renomeado
        const projetosDoUser = projetos.filter(p => p.projetista === oldNome);
        await Promise.all(projetosDoUser.map(p =>
          updateDoc(doc(db, 'projetos', String(p.id)), { projetista: newNome })
        ));
      }
      if (currentUser.id === id) {
        setCurrentUser({ id, nome: newNome, senha: editUserSenha.trim(), role: editUserRole });
      }
      setEditingUserId(null);
    } catch (err) { alert('Erro ao editar usuário: ' + err.message); }
  };

  // --- Lógica de Configurações (Tipos de Estrutura) ---
  const adicionarTipoEstrutura = async (e) => {
    e.preventDefault();
    const tipo = novoTipoEstrutura.trim().toUpperCase();
    if (tipo && !tiposEstrutura.includes(tipo)) {
      try {
        const novaLista = [...tiposEstrutura, tipo];
        await setDoc(doc(db, 'config', 'tiposEstrutura'), { lista: novaLista });
        setNovoTipoEstrutura('');
      } catch (err) { alert('Erro ao adicionar tipo: ' + err.message); }
    }
  };

  const removerTipoEstrutura = async (tipo) => {
    if (window.confirm(`Tem certeza que deseja remover o tipo "${tipo}"? Os projetos que já usam esse tipo não serão apagados.`)) {
      try {
        const novaLista = tiposEstrutura.filter(t => t !== tipo);
        await setDoc(doc(db, 'config', 'tiposEstrutura'), { lista: novaLista });
      } catch (err) { alert('Erro ao remover tipo: ' + err.message); }
    }
  };

  const salvarEdicaoTipo = async (oldTipo) => {
    const newTipo = editTipoInput.trim().toUpperCase();
    if (!newTipo) return;

    if (newTipo !== oldTipo && tiposEstrutura.includes(newTipo)) {
      alert('Já existe uma estrutura com esse nome.');
      return;
    }

    try {
      const novaLista = tiposEstrutura.map(t => t === oldTipo ? newTipo : t);
      await setDoc(doc(db, 'config', 'tiposEstrutura'), { lista: novaLista });
      if (newTipo !== oldTipo) {
        const projetosDoTipo = projetos.filter(p => p.tipo === oldTipo);
        await Promise.all(projetosDoTipo.map(p =>
          updateDoc(doc(db, 'projetos', String(p.id)), { tipo: newTipo })
        ));
      }
    } catch (err) { alert('Erro ao editar tipo: ' + err.message); }

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
                    <th className="px-6 py-4">Contrato / Cliente</th>
                    <th className="px-6 py-4">Início → Fim</th>
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
                          <div className="font-semibold text-slate-800">{projeto.numeroContrato}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{projeto.cliente}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            <span>{projeto.dataInicio ? projeto.dataInicio.split('-').reverse().join('/') : '—'}</span>
                            <ChevronRight size={14} className="text-slate-300" />
                            <span>{projeto.dataFim ? projeto.dataFim.split('-').reverse().join('/') : '—'}</span>
                          </div>
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

  // --- Excluir Projeto ---
  const excluirProjeto = async (id) => {
    try {
      await deleteDoc(doc(db, 'projetos', String(id)));
      setConfirmandoExclusaoId(null);
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
  };

  // --- Salvar Edição de Projeto ---
  const salvarEdicaoProjeto = async (id) => {
    try {
      const { id: _id, ...dados } = formEdicao;
      await updateDoc(doc(db, 'projetos', String(id)), dados);
      setEditandoProjetoId(null);
      setFormEdicao({});
    } catch (err) { alert('Erro ao salvar edição: ' + err.message); }
  };

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
                  <th className="px-6 py-4">Contrato / Cliente</th>
                  <th className="px-6 py-4">Início → Fim</th>
                  <th className="px-6 py-4">Tipo Estrutura</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meusProjetos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                      <CheckCircle2 size={32} className="mx-auto mb-3 text-slate-300" />
                      Nenhum projeto na sua fila no momento!
                    </td>
                  </tr>
                ) : (
                  meusProjetos.map(projeto => (
                    <React.Fragment key={projeto.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          {editandoProjetoId === projeto.id ? (
                            <div className="flex flex-col gap-1">
                              <input className="border border-slate-300 rounded px-2 py-1 text-xs w-32" value={formEdicao.numeroContrato || ''} onChange={e => setFormEdicao(p => ({...p, numeroContrato: e.target.value}))} placeholder="Contrato" />
                              <input className="border border-slate-300 rounded px-2 py-1 text-xs w-48" value={formEdicao.cliente || ''} onChange={e => setFormEdicao(p => ({...p, cliente: e.target.value}))} placeholder="Cliente" />
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-slate-800">{projeto.numeroContrato}</div>
                              <div className="text-slate-500 text-xs mt-0.5">{projeto.cliente}</div>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {editandoProjetoId === projeto.id ? (
                            <div className="flex flex-col gap-1">
                              <input type="date" className="border border-slate-300 rounded px-2 py-1 text-xs" value={formEdicao.dataInicio || ''} onChange={e => setFormEdicao(p => ({...p, dataInicio: e.target.value}))} />
                              <input type="date" className="border border-slate-300 rounded px-2 py-1 text-xs" value={formEdicao.dataFim || ''} onChange={e => setFormEdicao(p => ({...p, dataFim: e.target.value}))} />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-slate-400" />
                              <span>{projeto.dataInicio ? projeto.dataInicio.split('-').reverse().join('/') : '—'}</span>
                              <ChevronRight size={14} className="text-slate-300" />
                              <span>{projeto.dataFim ? projeto.dataFim.split('-').reverse().join('/') : '—'}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editandoProjetoId === projeto.id ? (
                            <div className="flex flex-col gap-1">
                              <input className="border border-slate-300 rounded px-2 py-1 text-xs w-48" value={formEdicao.tipo || ''} onChange={e => setFormEdicao(p => ({...p, tipo: e.target.value}))} placeholder="Tipo" />
                              <input className="border border-slate-300 rounded px-2 py-1 text-xs w-24" type="number" value={formEdicao.peso || ''} onChange={e => setFormEdicao(p => ({...p, peso: Number(e.target.value)}))} placeholder="Peso (kg)" />
                            </div>
                          ) : (
                            <>
                              <div className="text-slate-700 font-medium uppercase text-xs">{projeto.tipo}</div>
                              {projeto.status === 'Revisão' && projeto.numeroRevisao && (
                                <div className="text-amber-700 text-xs mt-0.5 font-semibold">Revisão #{projeto.numeroRevisao}</div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editandoProjetoId === projeto.id ? (
                            <select className="border border-slate-300 rounded px-2 py-1 text-xs" value={formEdicao.status || ''} onChange={e => setFormEdicao(p => ({...p, status: e.target.value}))}>
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            renderStatusDropdown(projeto)
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editandoProjetoId === projeto.id ? (
                            <div className="flex gap-2">
                              <button onClick={() => salvarEdicaoProjeto(projeto.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                <Save size={13} /> Salvar
                              </button>
                              <button onClick={() => { setEditandoProjetoId(null); setFormEdicao({}); }} className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors">
                                <X size={13} /> Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => { setEditandoProjetoId(projeto.id); setFormEdicao({...projeto}); }} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors" title="Editar">
                                <Edit2 size={15} />
                              </button>
                              <button onClick={() => setConfirmandoExclusaoId(projeto.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {confirmandoExclusaoId === projeto.id && (
                        <tr className="bg-red-50">
                          <td colSpan="5" className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <AlertTriangle size={16} className="text-red-500 shrink-0" />
                              <span className="text-sm text-red-700 font-medium">Confirma exclusão de <strong>{projeto.numeroContrato} — {projeto.tipo}</strong>? Esta ação não pode ser desfeita.</span>
                              <button onClick={() => excluirProjeto(projeto.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors">Excluir</button>
                              <button onClick={() => setConfirmandoExclusaoId(null)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(e); }}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 font-medium"
            >
              <option value="">Selecione seu perfil...</option>
              {usuarios.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Senha</label>
            <input
              type="password"
              value={senhaInput}
              onChange={(e) => setSenhaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(e); }}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all tracking-widest bg-slate-50"
              placeholder="••••••"
            />
          </div>
          {loginError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogin}
            className="w-full bg-blue-800 hover:bg-blue-900 text-white font-semibold py-3.5 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 mt-4"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );

  // (9) Dashboard com filtros de período, projetista e status
  const renderDashboard = () => {
    const limparFiltros = () => {
      setDashPeriodoInicio('');
      setDashPeriodoFim('');
      setDashFiltroProjetista('');
      setDashFiltroStatus('');
    };

    const setPeriodoMes = () => {
      const hoje = new Date();
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
      setDashPeriodoInicio(primeiroDia);
      setDashPeriodoFim(ultimoDia);
    };

    const setPeriodoAno = () => {
      const hoje = new Date();
      setDashPeriodoInicio(`${hoje.getFullYear()}-01-01`);
      setDashPeriodoFim(`${hoje.getFullYear()}-12-31`);
    };

    const filtrosAtivos = [dashPeriodoInicio, dashPeriodoFim, dashFiltroProjetista, dashFiltroStatus].filter(Boolean).length;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="text-blue-600" /> Visão Geral da Produção
        </h2>

        {/* Painel de Filtros */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <Filter size={14} /> Filtros do Dashboard
            </span>
            {filtrosAtivos > 0 && (
              <button
                onClick={limparFiltros}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 transition-colors"
              >
                <X size={13} /> Limpar filtros {filtrosAtivos > 0 && <span className="bg-red-100 text-red-600 rounded-full px-1.5">{filtrosAtivos}</span>}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Período De */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Período de</label>
              <input
                type="date"
                value={dashPeriodoInicio}
                onChange={(e) => setDashPeriodoInicio(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Período Até */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Até</label>
              <input
                type="date"
                value={dashPeriodoFim}
                onChange={(e) => setDashPeriodoFim(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Filtro Projetista */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Responsável</label>
              <select
                value={dashFiltroProjetista}
                onChange={(e) => setDashFiltroProjetista(e.target.value)}
                className={`w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors ${dashFiltroProjetista ? 'border-blue-400 bg-blue-50 text-blue-800 font-semibold' : 'border-slate-300'}`}
              >
                <option value="">Todos os responsáveis</option>
                {usuarios.filter(u => u.role === 'projetista' || u.role === 'admin').map(u => (
                  <option key={u.id} value={u.nome}>{u.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro Status */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</label>
              <select
                value={dashFiltroStatus}
                onChange={(e) => setDashFiltroStatus(e.target.value)}
                className={`w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors ${dashFiltroStatus === 'Concluído' ? 'border-green-400 bg-green-50 text-green-800 font-semibold' : dashFiltroStatus === 'Revisão' ? 'border-amber-400 bg-amber-50 text-amber-800 font-semibold' : 'border-slate-300'}`}
              >
                <option value="">Todos os status</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Atalhos de período + resumo dos filtros ativos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
              <button onClick={setPeriodoMes} className="text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors">
                Mês atual
              </button>
              <button onClick={setPeriodoAno} className="text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors">
                Ano atual
              </button>
            </div>
            {filtrosAtivos > 0 && (
              <p className="text-xs text-slate-500 italic">
                {dashFiltroProjetista && <span className="mr-2">👤 <strong>{dashFiltroProjetista}</strong></span>}
                {dashFiltroStatus && <span className="mr-2">🔖 <strong>{dashFiltroStatus}</strong></span>}
                {(dashPeriodoInicio || dashPeriodoFim) && (
                  <span>📅 <strong>{dashPeriodoInicio ? dashPeriodoInicio.split('-').reverse().join('/') : '...'}</strong> → <strong>{dashPeriodoFim ? dashPeriodoFim.split('-').reverse().join('/') : '...'}</strong></span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4 transition-colors ${dashFiltroStatus === '' || dashFiltroStatus === undefined ? 'border-blue-200' : 'border-slate-200'}`}>
            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
              <HardHat size={28} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{dashFiltroProjetista ? `Projetos de ${dashFiltroProjetista}` : 'Total de Projetos'}</p>
              <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>

          <div className={`bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4 transition-colors ${dashFiltroStatus === 'Concluído' ? 'border-green-400 ring-2 ring-green-200' : 'border-slate-200'}`}>
            <div className="p-3 bg-green-100 text-green-700 rounded-lg">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Concluídos</p>
              <p className="text-3xl font-bold text-slate-800">{stats.concluidos}</p>
              {stats.total > 0 && <p className="text-xs text-green-600 font-semibold mt-0.5">{Math.round((stats.concluidos / stats.total) * 100)}% do total</p>}
            </div>
          </div>

          <div className={`bg-white p-6 rounded-xl border shadow-sm flex items-center gap-4 transition-colors ${dashFiltroStatus === 'Revisão' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}>
            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
              <AlertCircle size={28} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Em Revisão</p>
              <p className="text-3xl font-bold text-slate-800">{stats.emRevisao}</p>
              {stats.total > 0 && <p className="text-xs text-amber-600 font-semibold mt-0.5">{Math.round((stats.emRevisao / stats.total) * 100)}% do total</p>}
            </div>
          </div>
        </div>

        {/* BLOCO 1 — Participação e Volume por Responsável */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-blue-600" /> Participação e Volume por Responsável
            </h3>
            <p className="text-xs text-slate-500 mt-1">Quantidade de projetos e percentual de participação de cada projetista no período.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Responsável</th>
                  <th className="px-6 py-4 text-center">Projetos</th>
                  <th className="px-6 py-4 text-center">% do Total</th>
                  <th className="px-6 py-4 text-center text-green-600">Concluídos</th>
                  <th className="px-6 py-4 text-center text-amber-600">Revisões</th>
                  <th className="px-6 py-4">Distribuição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.rankingProjetistas.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">Nenhum dado registrado no período selecionado.</td></tr>
                ) : (
                  stats.rankingProjetistas.map((proj, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td
                        className="px-6 py-4 font-semibold text-blue-600 cursor-pointer hover:text-blue-800 hover:underline transition-all"
                        onClick={() => setProjetistaDetalhe(proj.nome)}
                      >
                        {proj.nome}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-800 text-base">{proj.total}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${proj.percentual >= 30 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {proj.percentual}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-green-700 bg-green-50/30">
                        {proj.porStatus['Concluído'] || 0}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-amber-700 bg-amber-50/30">
                        {proj.porStatus['Revisão'] || 0}
                      </td>
                      <td className="px-6 py-4 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all duration-700"
                              style={{ width: `${proj.percentual}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{proj.percentual}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {stats.rankingProjetistas.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td className="px-6 py-3 font-bold text-slate-700">TOTAL</td>
                    <td className="px-6 py-3 text-center font-bold text-slate-800">{stats.total}</td>
                    <td className="px-6 py-3 text-center font-bold text-slate-700">100%</td>
                    <td className="px-6 py-3 text-center font-bold text-green-700">{stats.concluidos}</td>
                    <td className="px-6 py-3 text-center font-bold text-amber-700">{stats.emRevisao}</td>
                    <td className="px-6 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* BLOCO 2 — Projetos por Tipo × Responsável */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Wrench size={18} className="text-blue-600" /> Projetos por Tipo de Estrutura × Responsável
            </h3>
            <p className="text-xs text-slate-500 mt-1">Cruzamento de quantos projetos de cada tipo cada projetista realizou no período.</p>
          </div>
          {stats.rankingTipos.length === 0 ? (
            <p className="px-6 py-8 text-center text-slate-500">Nenhum dado registrado no período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="px-6 py-4 min-w-[220px]">Tipo de Estrutura</th>
                    {stats.rankingProjetistas.map((p, i) => (
                      <th key={i} className="px-4 py-4 text-center whitespace-nowrap">{p.nome}</th>
                    ))}
                    <th className="px-4 py-4 text-center font-bold text-slate-700 bg-slate-50">Total</th>
                    <th className="px-4 py-4 text-center font-bold text-slate-700 bg-slate-50">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.rankingTipos.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-800 uppercase text-xs">{item.tipo}</span>
                      </td>
                      {stats.rankingProjetistas.map((proj, i) => {
                        const qtd = proj.porTipo[item.tipo] || 0;
                        return (
                          <td key={i} className="px-4 py-3 text-center">
                            {qtd > 0
                              ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">{qtd}</span>
                              : <span className="text-slate-300 text-xs">—</span>
                            }
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center bg-slate-50">
                        <span className="font-bold text-slate-800">{item.qtd}</span>
                      </td>
                      <td className="px-4 py-3 text-center bg-slate-50">
                        <span className="text-xs font-semibold text-slate-500">{item.percentual}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td className="px-6 py-3 font-bold text-slate-700">TOTAL</td>
                    {stats.rankingProjetistas.map((proj, i) => (
                      <td key={i} className="px-4 py-3 text-center font-bold text-slate-800">{proj.total}</td>
                    ))}
                    <td className="px-4 py-3 text-center font-bold text-slate-800 bg-slate-100">{stats.total}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700 bg-slate-100">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* BLOCO 3 — Motivos de Revisão */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" /> Análise de Motivos de Revisão
              </h3>
              <p className="text-xs text-slate-500 mt-1">Frequência de cada motivo nos projetos com status "Revisão" no período.</p>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <AlertCircle size={16} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">{stats.totalRevisoes} revis{stats.totalRevisoes !== 1 ? 'ões' : 'ão'} no período</span>
            </div>
          </div>
          {stats.rankingMotivos.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-green-300" />
              <p className="font-medium">Nenhuma revisão registrada no período.</p>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {stats.rankingMotivos.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/40 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-amber-300 text-amber-900' : 'bg-slate-200 text-slate-600'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800 uppercase truncate" title={item.motivo}>
                      {item.motivo}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden hidden sm:block">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-700"
                        style={{ width: `${item.percentual}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-amber-700 w-8 text-right">{item.percentual}%</span>
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold min-w-[2.5rem]">
                      {item.qtd}×
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    );
  };

  // (1)-(8) Formulário com TODOS os novos campos
  const renderForm = () => {
    const isRevisao = formData.status === 'Revisão';
    const isOutroMotivo = formData.motivoRevisao === 'OUTRO MOTIVO';

    return (
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
          <FilePlus className="text-blue-600" /> Cadastrar Novo Projeto
        </h2>
        <p className="text-slate-500 text-sm mb-6">Preencha os dados abaixo para registrar suas frentes de trabalho.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Hash size={14} className="text-slate-400" /> Número do contrato (PADRÃO XXX/XXXX) *
              </label>
              <input
                required
                type="text"
                name="numeroContrato"
                value={formData.numeroContrato}
                onChange={handleContratoChange}
                maxLength={8}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                placeholder="Ex: 105/2026"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" /> Cliente / Obra *
              </label>
              <input required type="text" name="cliente" value={formData.cliente} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Construtora ou obra" />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" /> Data de início *
              </label>
              <input required type="date" name="dataInicio" value={formData.dataInicio} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" /> Data de finalização
              </label>
              <input type="date" name="dataFim" value={formData.dataFim} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>

          {/* Responsável e Projeto do cliente */}
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
              <label className="text-sm font-medium text-slate-700">Projeto do cliente</label>
              <select
                name="projetoCliente"
                value={formData.projetoCliente}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
              >
                <option value="">Selecione...</option>
                {PROJETO_CLIENTE_OPCOES.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
          </div>

          {/* Medidas Técnicas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Ruler size={14} className="text-slate-400" /> Área (m²)
              </label>
              <input type="number" step="0.01" min="0" name="area" value={formData.area} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ex: 250" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Ruler size={14} className="text-slate-400" /> Pé direito (m)
              </label>
              <input type="number" step="0.01" min="0" name="peDireito" value={formData.peDireito} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ex: 2.80" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Layers size={14} className="text-slate-400" /> Pavimento
              </label>
              <input type="text" name="pavimento" value={formData.pavimento} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ex: Térreo, 1º Pav..." />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Weight size={14} className="text-slate-400" /> Peso do projeto (kg)
              </label>
              <input type="number" step="0.01" min="0" name="peso" value={formData.peso} onChange={handleInputChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ex: 1200" />
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Status *</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white font-semibold ${isRevisao ? 'text-amber-700' : 'text-green-700'}`}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* (7) Campo Número da Revisão (somente em status Revisão) */}
            {isRevisao && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-400" /> Número da revisão (2 dígitos) *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max="99"
                  name="numeroRevisao"
                  value={formData.numeroRevisao}
                  onChange={handleInputChange}
                  onBlur={handleRevisaoBlur}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono"
                  placeholder="Ex: 01, 02, 03..."
                />
              </div>
            )}
          </div>

          {/* (6) Bloco condicional: Motivos de Revisão */}
          {isRevisao && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 text-amber-800 font-semibold">
                <AlertTriangle size={18} /> Motivo da Revisão
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Selecione o motivo *</label>
                <select
                  required
                  name="motivoRevisao"
                  value={formData.motivoRevisao}
                  onChange={handleInputChange}
                  className="w-full p-2.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all bg-white"
                >
                  <option value="">Selecione...</option>
                  {MOTIVOS_REVISAO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {isOutroMotivo && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Descreva o outro motivo *</label>
                  <input
                    required
                    type="text"
                    name="outroMotivoTexto"
                    value={formData.outroMotivoTexto}
                    onChange={handleInputChange}
                    className="w-full p-2.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    placeholder="Descreva o motivo..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Tipo de Estrutura */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-800 uppercase tracking-wide">Tipo *</label>
            <div className="flex flex-col gap-2 ml-1">
              {tiposEstrutura.map(t => (
                <div key={t} className="flex items-center gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group min-w-[260px]">
                    <input type="checkbox" checked={formData.tipo.includes(t)} onChange={() => handleTipoChange(t)} className="w-5 h-5 text-blue-600 rounded border-slate-400 focus:ring-blue-500 cursor-pointer" />
                    <span className="text-slate-800 text-[15px] group-hover:text-blue-700 transition-colors uppercase">{t}</span>
                  </label>
                  {formData.tipo.includes(t) && (
                    <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                      <Weight size={13} className="text-slate-400 shrink-0" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Peso (kg)"
                        value={formData.pesoPorTipo?.[t] || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          pesoPorTipo: { ...(prev.pesoPorTipo || {}), [t]: e.target.value }
                        }))}
                        className="w-32 p-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="text-xs text-slate-400">kg</span>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3 mt-1">
                <label className="flex items-center gap-3 cursor-pointer group min-w-[260px]">
                  <input type="checkbox" checked={isOutro} onChange={() => setIsOutro(!isOutro)} className="w-5 h-5 text-blue-600 rounded border-slate-400 focus:ring-blue-500 cursor-pointer" />
                  <span className="text-slate-800 text-[15px] uppercase mr-2">Outro:</span>
                  <input type="text" value={outroValor} onChange={(e) => setOutroValor(e.target.value)} disabled={!isOutro} className={`flex-1 border-b ${isOutro ? 'border-slate-500 focus:border-blue-600' : 'border-slate-300 bg-slate-50 cursor-not-allowed'} py-1 outline-none text-[15px] uppercase transition-colors`} placeholder={isOutro ? 'Digite a estrutura...' : ''} />
                </label>
                {isOutro && outroValor.trim() && (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <Weight size={13} className="text-slate-400 shrink-0" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Peso (kg)"
                      value={formData.pesoPorTipo?.['__outro__'] || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        pesoPorTipo: { ...(prev.pesoPorTipo || {}), ['__outro__']: e.target.value }
                      }))}
                      className="w-32 p-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <span className="text-xs text-slate-400">kg</span>
                  </div>
                )}
              </div>
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
  };

  const renderList = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ListTodo className="text-blue-600" /> Tabela de Projetos Gerados
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Buscar contrato ou cliente..." value={buscaTermo} onChange={(e) => setBuscaTermo(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64" />
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
              <th className="px-6 py-4">Contrato / Cliente</th>
              <th className="px-6 py-4">Responsável</th>
              <th className="px-6 py-4">Início → Fim</th>
              <th className="px-6 py-4">Tipo Estrutura</th>
              <th className="px-6 py-4">Medidas</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projetosFiltrados.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500"><Filter size={32} className="mx-auto mb-3 text-slate-300" />Nenhum projeto encontrado.</td></tr>
            ) : (
              projetosFiltrados.map(projeto => (
                <tr key={projeto.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{projeto.numeroContrato}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{projeto.cliente}</div>
                    {projeto.projetoCliente && (
                      <div className="text-blue-600 text-xs mt-0.5 italic">{projeto.projetoCliente}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium">{projeto.projetista}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{projeto.dataInicio ? projeto.dataInicio.split('-').reverse().join('/') : '—'}</span>
                      <ChevronRight size={14} className="text-slate-300" />
                      <span>{projeto.dataFim ? projeto.dataFim.split('-').reverse().join('/') : '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700 font-medium uppercase text-xs">{projeto.tipo}</div>
                    {projeto.status === 'Revisão' && projeto.numeroRevisao && (
                      <div className="text-amber-700 text-xs mt-0.5 font-semibold">Rev. #{projeto.numeroRevisao}</div>
                    )}
                    {projeto.status === 'Revisão' && projeto.motivoRevisao && (
                      <div className="text-amber-600 text-xs mt-0.5 italic" title={projeto.motivoRevisao}>
                        {projeto.motivoRevisao.length > 32 ? projeto.motivoRevisao.slice(0, 32) + '…' : projeto.motivoRevisao}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {projeto.area > 0 && <div>{projeto.area} m²</div>}
                    {projeto.peDireito > 0 && <div>PD: {projeto.peDireito} m</div>}
                    {projeto.pavimento > 0 && <div>Pav: {projeto.pavimento} m</div>}
                    {projeto.peso > 0 && <div>{projeto.peso} kg</div>}
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

  // =====================================================
  // (10) MODAL DE DOCUMENTAÇÃO TÉCNICA COMPLETA
  // =====================================================
  const DOCS_SECTIONS = [
    { id: 'visao-geral', label: '📋 Visão Geral', group: 'Introdução' },
    { id: 'infraestrutura', label: '🚀 Infraestrutura e Deploy', group: 'Introdução' },
    { id: 'arquitetura', label: '🏗️ Arquitetura do Sistema', group: 'Introdução' },
    { id: 'tecnologias', label: '⚡ Stack Tecnológico', group: 'Introdução' },
    { id: 'mod-form', label: '📝 Cadastro de Projeto', group: 'Módulos' },
    { id: 'mod-tarefas', label: '👷 Minhas Tarefas', group: 'Módulos' },
    { id: 'mod-dashboard', label: '📊 Dashboard', group: 'Módulos' },
    { id: 'mod-historico', label: '📜 Histórico Geral', group: 'Módulos' },
    { id: 'mod-config', label: '⚙️ Configurações', group: 'Módulos' },
    { id: 'estados', label: '📦 Estados (useState)', group: 'Dados' },
    { id: 'schemas', label: '📐 Schemas de Dados', group: 'Dados' },
    { id: 'permissoes', label: '🔐 Permissões e Acessos', group: 'Dados' },
    { id: 'manutencao', label: '🛠️ Manutenção', group: 'Operação' },
    { id: 'faq', label: '❓ FAQ Técnico', group: 'Operação' }
  ];

  const renderDocsContent = () => {
    switch (docsSection) {
      case 'visao-geral':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">📋 Visão Geral do Sistema</h2>
            <p className="text-slate-600 leading-relaxed">
              O <strong>Mais Projetos</strong> é o sistema interno de gestão de projetos de escoramento da
              <strong> Mais Escoramentos</strong>. Ele controla a entrada, execução e revisão de cada projeto
              técnico produzido pela equipe de projetistas, com painéis específicos para administradores e
              projetistas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600 font-semibold uppercase">Versão</div>
                <div className="text-2xl font-bold text-slate-800">v2.0.0</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600 font-semibold uppercase">Linhas de código</div>
                <div className="text-2xl font-bold text-slate-800">~1.500</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600 font-semibold uppercase">Framework</div>
                <div className="text-2xl font-bold text-slate-800">React 18</div>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Objetivos do Sistema</h3>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Padronizar o cadastro de projetos de escoramento (forma, lajes, vigas, cimbramento, etc.).</li>
              <li>Controlar o ciclo de vida do projeto: <strong>Concluído</strong> ou <strong>Revisão</strong>.</li>
              <li>Rastrear motivos de revisão e número de revisões por projeto.</li>
              <li>Consolidar produção por projetista e período no dashboard administrativo.</li>
              <li>Centralizar o controle de acessos e tipos de estrutura.</li>
            </ul>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Perfis de Usuário</h3>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li><strong>Administrador (admin)</strong>: acesso total — Dashboard, Histórico Geral, Configurações, Novo Projeto e Minhas Tarefas.</li>
              <li><strong>Projetista (projetista)</strong>: vê apenas <em>Minhas Tarefas</em> e cadastra <em>Novo Projeto</em> com o próprio nome travado.</li>
            </ul>
          </div>
        );

      case 'infraestrutura':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">🚀 Infraestrutura e Deploy</h2>
            <p className="text-slate-600">
              Aplicação <strong>front-end pura</strong> em React, sem backend dedicado. Pode ser hospedada em
              qualquer serviço de páginas estáticas (Vercel, Netlify, GitHub Pages, S3, etc.).
            </p>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Estrutura de pastas recomendada</h3>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`mais-projetos/
├── public/
│   └── Logo Mais.jpg        ← Logotipo exibido no header
├── src/
│   ├── App.jsx              ← Componente raiz (este arquivo)
│   ├── main.jsx             ← Bootstrap do React
│   └── index.css            ← TailwindCSS
├── package.json
├── tailwind.config.js
└── vite.config.js`}
            </pre>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Comandos principais</h3>
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr><th className="border border-slate-200 p-2 text-left">Comando</th><th className="border border-slate-200 p-2 text-left">Função</th></tr>
              </thead>
              <tbody>
                <tr><td className="border border-slate-200 p-2 font-mono">npm install</td><td className="border border-slate-200 p-2">Instala dependências</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">npm run dev</td><td className="border border-slate-200 p-2">Sobe o servidor de desenvolvimento</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">npm run build</td><td className="border border-slate-200 p-2">Gera o build de produção</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">vercel --prod</td><td className="border border-slate-200 p-2">Publica em produção (caso use Vercel)</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Rollback</h3>
            <ol className="list-decimal pl-6 space-y-1 text-slate-700">
              <li>Acesse o painel do provedor de deploy (Vercel/Netlify).</li>
              <li>Selecione o projeto <strong>Mais Projetos</strong>.</li>
              <li>Vá em <em>Deployments</em>, escolha a versão estável e clique em <strong>Promote to Production</strong>.</li>
            </ol>
          </div>
        );

      case 'arquitetura':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">🏗️ Arquitetura do Sistema</h2>
            <p className="text-slate-600">
              O sistema é um SPA (Single Page Application) com <strong>um único componente raiz</strong> (App.jsx)
              que renderiza condicionalmente as abas. O estado é mantido em memória via <code className="bg-slate-100 px-1 rounded">useState</code>.
            </p>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Camadas do App.jsx</h3>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`┌──────────────────────────────────────────────────┐
│ CONSTANTES (STATUS_OPTIONS, MOTIVOS_REVISAO, …)  │
├──────────────────────────────────────────────────┤
│ HELPERS (regex contrato, formatar revisão, …)    │
├──────────────────────────────────────────────────┤
│ ESTADOS (useState)                               │
│  - sessão / login                                │
│  - usuários, tipos, projetos                     │
│  - formData (formulário principal)               │
│  - filtros do histórico / dashboard              │
├──────────────────────────────────────────────────┤
│ HANDLERS (login, submit, status, ediçao, …)      │
├──────────────────────────────────────────────────┤
│ MEMOS (projetosFiltrados, stats, periodo)        │
├──────────────────────────────────────────────────┤
│ RENDERIZADORES                                   │
│  - renderLogin                                   │
│  - renderMinhasTarefas                           │
│  - renderForm                                    │
│  - renderDashboard (com filtro de período)       │
│  - renderList                                    │
│  - renderConfig                                  │
│  - renderModalDetalhes                           │
│  - renderDocs (documentação técnica)             │
├──────────────────────────────────────────────────┤
│ RETURN (header + tabs + main + modais)           │
└──────────────────────────────────────────────────┘`}
            </pre>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Fluxo de Dados</h3>
            <ol className="list-decimal pl-6 space-y-1 text-slate-700">
              <li>Login carrega o usuário e seta a aba inicial conforme a role.</li>
              <li>O formulário grava cada item selecionado em <code className="bg-slate-100 px-1 rounded">projetos</code>.</li>
              <li>O dashboard filtra projetos pelo período e gera as métricas.</li>
              <li>O histórico aplica filtros adicionais (responsável, status, busca).</li>
            </ol>
          </div>
        );

      case 'tecnologias':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">⚡ Stack Tecnológico</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="font-bold text-blue-700">React 18</div>
                <p className="text-sm text-slate-600 mt-1">Biblioteca principal para UI. Usa hooks: <code className="bg-slate-100 px-1 rounded">useState</code>, <code className="bg-slate-100 px-1 rounded">useMemo</code>.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="font-bold text-blue-700">Vite</div>
                <p className="text-sm text-slate-600 mt-1">Bundler/dev server. Build rápido e HMR instantâneo.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="font-bold text-blue-700">TailwindCSS</div>
                <p className="text-sm text-slate-600 mt-1">Framework de estilização utilitária — todas as classes são utilitárias do Tailwind.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="font-bold text-blue-700">lucide-react</div>
                <p className="text-sm text-slate-600 mt-1">Biblioteca de ícones SVG (HardHat, Calendar, BarChart3, etc.).</p>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Dependências mínimas (package.json)</h3>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.0.0"
  }
}`}
            </pre>
          </div>
        );

      case 'mod-form':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">📝 Módulo: Cadastro de Projeto</h2>
            <p className="text-slate-600">Função: <code className="bg-slate-100 px-1 rounded">renderForm()</code>. Aba: <strong>Novo Projeto</strong>.</p>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Campos do formulário</h3>
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-200 p-2 text-left">Campo</th>
                  <th className="border border-slate-200 p-2 text-left">Estado</th>
                  <th className="border border-slate-200 p-2 text-left">Observação</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr><td className="border border-slate-200 p-2">Número do contrato</td><td className="border border-slate-200 p-2 font-mono">numeroContrato</td><td className="border border-slate-200 p-2">Padrão XXX/XXXX validado por regex</td></tr>
                <tr><td className="border border-slate-200 p-2">Cliente / Obra</td><td className="border border-slate-200 p-2 font-mono">cliente</td><td className="border border-slate-200 p-2">Texto livre</td></tr>
                <tr><td className="border border-slate-200 p-2">Data de início</td><td className="border border-slate-200 p-2 font-mono">dataInicio</td><td className="border border-slate-200 p-2">Obrigatório</td></tr>
                <tr><td className="border border-slate-200 p-2">Data de finalização</td><td className="border border-slate-200 p-2 font-mono">dataFim</td><td className="border border-slate-200 p-2">Opcional — não pode ser anterior ao início</td></tr>
                <tr><td className="border border-slate-200 p-2">Responsável</td><td className="border border-slate-200 p-2 font-mono">projetista</td><td className="border border-slate-200 p-2">Bloqueado para usuários projetistas</td></tr>
                <tr><td className="border border-slate-200 p-2">Projeto do cliente</td><td className="border border-slate-200 p-2 font-mono">projetoCliente</td><td className="border border-slate-200 p-2">Lista fechada (PROJETO_CLIENTE_OPCOES)</td></tr>
                <tr><td className="border border-slate-200 p-2">Área (m²)</td><td className="border border-slate-200 p-2 font-mono">area</td><td className="border border-slate-200 p-2">Número decimal</td></tr>
                <tr><td className="border border-slate-200 p-2">Pé direito (m)</td><td className="border border-slate-200 p-2 font-mono">peDireito</td><td className="border border-slate-200 p-2">Número decimal</td></tr>
                <tr><td className="border border-slate-200 p-2">Pavimento (m)</td><td className="border border-slate-200 p-2 font-mono">pavimento</td><td className="border border-slate-200 p-2">Número decimal</td></tr>
                <tr><td className="border border-slate-200 p-2">Peso do projeto (kg)</td><td className="border border-slate-200 p-2 font-mono">peso</td><td className="border border-slate-200 p-2">Número decimal</td></tr>
                <tr><td className="border border-slate-200 p-2">Status</td><td className="border border-slate-200 p-2 font-mono">status</td><td className="border border-slate-200 p-2">Concluído | Revisão</td></tr>
                <tr><td className="border border-slate-200 p-2">Número da revisão</td><td className="border border-slate-200 p-2 font-mono">numeroRevisao</td><td className="border border-slate-200 p-2">Obrigatório se status = Revisão. Formato 2 dígitos.</td></tr>
                <tr><td className="border border-slate-200 p-2">Motivo da revisão</td><td className="border border-slate-200 p-2 font-mono">motivoRevisao</td><td className="border border-slate-200 p-2">Lista fechada (MOTIVOS_REVISAO)</td></tr>
                <tr><td className="border border-slate-200 p-2">Outro motivo</td><td className="border border-slate-200 p-2 font-mono">outroMotivoTexto</td><td className="border border-slate-200 p-2">Aparece se motivo = OUTRO MOTIVO</td></tr>
                <tr><td className="border border-slate-200 p-2">Tipo de estrutura</td><td className="border border-slate-200 p-2 font-mono">tipo[]</td><td className="border border-slate-200 p-2">Multi-seleção; cada item vira 1 projeto separado</td></tr>
                <tr><td className="border border-slate-200 p-2">Observações</td><td className="border border-slate-200 p-2 font-mono">notas</td><td className="border border-slate-200 p-2">Texto livre</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Lógica de Submit (handleSubmit)</h3>
            <ol className="list-decimal pl-6 space-y-1 text-slate-700">
              <li>Valida o regex <code className="bg-slate-100 px-1 rounded">/^\d{'{3}'}\/\d{'{4}'}$/</code> para o contrato.</li>
              <li>Verifica se pelo menos um tipo foi selecionado.</li>
              <li>Se status = Revisão: exige motivo + número da revisão.</li>
              <li>Garante dataFim ≥ dataInicio (quando preenchida).</li>
              <li>Para cada tipo marcado, cria 1 projeto independente (mesma base).</li>
            </ol>
          </div>
        );

      case 'mod-tarefas':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">👷 Módulo: Minhas Tarefas</h2>
            <p className="text-slate-600">Função: <code className="bg-slate-100 px-1 rounded">renderMinhasTarefas()</code>.</p>
            <p className="text-slate-600">
              Filtra <code className="bg-slate-100 px-1 rounded">projetos.filter(p =&gt; p.projetista === currentUser.nome)</code>.
              Cada projetista enxerga apenas seus próprios projetos. Permite atualizar o status diretamente no dropdown da tabela.
            </p>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Colunas exibidas</h3>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Contrato / Cliente</li>
              <li>Início → Fim (data de início e data de finalização)</li>
              <li>Tipo de estrutura + número da revisão (se houver)</li>
              <li>Status (dropdown editável)</li>
            </ul>
          </div>
        );

      case 'mod-dashboard':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">📊 Módulo: Dashboard</h2>
            <p className="text-slate-600">Função: <code className="bg-slate-100 px-1 rounded">renderDashboard()</code>. Acesso: admin.</p>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Filtro de período</h3>
            <p className="text-slate-600">Estados: <code className="bg-slate-100 px-1 rounded">dashPeriodoInicio</code>, <code className="bg-slate-100 px-1 rounded">dashPeriodoFim</code>. Atalhos disponíveis: Mês atual, Ano atual e Limpar.</p>
            <h3 className="text-lg font-bold text-slate-800 mt-4">KPIs</h3>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li><strong>Total de Projetos</strong> — total filtrado pelo período.</li>
              <li><strong>Concluídos</strong> — projetos com status Concluído.</li>
              <li><strong>Em Revisão</strong> — projetos com status Revisão.</li>
            </ul>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Ranking por responsável</h3>
            <p className="text-slate-600">Calculado em <code className="bg-slate-100 px-1 rounded">stats.rankingProjetistas</code> (useMemo). Cada nome é clicável e abre o modal de detalhes.</p>
          </div>
        );

      case 'mod-historico':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">📜 Módulo: Histórico Geral</h2>
            <p className="text-slate-600">Função: <code className="bg-slate-100 px-1 rounded">renderList()</code>. Acesso: admin.</p>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Filtros disponíveis</h3>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li><strong>buscaTermo</strong> — busca em número do contrato e cliente.</li>
              <li><strong>filtroProjetista</strong> — combo com todos os usuários.</li>
              <li><strong>filtroStatus</strong> — combo com os status atuais.</li>
            </ul>
            <p className="text-slate-600">A consolidação está em <code className="bg-slate-100 px-1 rounded">projetosFiltrados</code> (useMemo) e mostra: contrato/cliente, responsável, datas, tipo + revisão, medidas e status.</p>
          </div>
        );

      case 'mod-config':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">⚙️ Módulo: Configurações</h2>
            <p className="text-slate-600">Função: <code className="bg-slate-100 px-1 rounded">renderConfig()</code>. Acesso: admin.</p>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Sub-blocos</h3>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li><strong>Controle de Acessos</strong> — adicionar/editar/remover usuários e senhas. Renomear um usuário propaga o novo nome para todos os projetos dele.</li>
              <li><strong>Tipos de Estrutura</strong> — gerencia a lista de checkboxes do formulário de cadastro. Renomear um tipo propaga para os projetos existentes.</li>
            </ul>
            <h3 className="text-lg font-bold text-slate-800 mt-4">Regras de segurança</h3>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Não é possível excluir o próprio usuário enquanto logado.</li>
              <li>Não é possível excluir usuário com projetos atribuídos — só renomear ou alterar senha.</li>
              <li>Nomes de usuário são únicos.</li>
            </ul>
          </div>
        );

      case 'estados':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">📦 Estados (useState)</h2>
            <p className="text-slate-600">Todos os estados ficam no componente raiz. Hoje não há persistência em <em>localStorage</em>; ao recarregar a página, os dados voltam ao estado inicial.</p>
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-200 p-2 text-left">Estado</th>
                  <th className="border border-slate-200 p-2 text-left">Tipo</th>
                  <th className="border border-slate-200 p-2 text-left">Função</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr><td className="border border-slate-200 p-2 font-mono">currentUser</td><td className="border border-slate-200 p-2">object|null</td><td className="border border-slate-200 p-2">Usuário logado</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">loginInput / senhaInput</td><td className="border border-slate-200 p-2">string</td><td className="border border-slate-200 p-2">Campos da tela de login</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">activeTab</td><td className="border border-slate-200 p-2">string</td><td className="border border-slate-200 p-2">Aba ativa</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">usuarios</td><td className="border border-slate-200 p-2">array</td><td className="border border-slate-200 p-2">Lista de usuários do sistema</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">tiposEstrutura</td><td className="border border-slate-200 p-2">array</td><td className="border border-slate-200 p-2">Tipos de estrutura disponíveis</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">projetos</td><td className="border border-slate-200 p-2">array</td><td className="border border-slate-200 p-2">Base principal de projetos</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">formData</td><td className="border border-slate-200 p-2">object</td><td className="border border-slate-200 p-2">Formulário de cadastro</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">isOutro / outroValor</td><td className="border border-slate-200 p-2">bool / string</td><td className="border border-slate-200 p-2">Opção “Outro” no tipo de estrutura</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">filtroProjetista / filtroStatus / buscaTermo</td><td className="border border-slate-200 p-2">string</td><td className="border border-slate-200 p-2">Filtros do histórico</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">dashPeriodoInicio / dashPeriodoFim</td><td className="border border-slate-200 p-2">string (YYYY-MM-DD)</td><td className="border border-slate-200 p-2">Filtro de período do dashboard</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">novoUsuario* / novoTipoEstrutura</td><td className="border border-slate-200 p-2">string</td><td className="border border-slate-200 p-2">Inputs de criação em Configurações</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">editingUserId / editUser*</td><td className="border border-slate-200 p-2">vários</td><td className="border border-slate-200 p-2">Edição inline de usuário</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">editingTipo / editTipoInput</td><td className="border border-slate-200 p-2">string</td><td className="border border-slate-200 p-2">Edição inline de tipo de estrutura</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">projetistaDetalhe</td><td className="border border-slate-200 p-2">string|null</td><td className="border border-slate-200 p-2">Abre o modal de detalhes do projetista</td></tr>
                <tr><td className="border border-slate-200 p-2 font-mono">showDocs / docsSection</td><td className="border border-slate-200 p-2">bool / string</td><td className="border border-slate-200 p-2">Modal de documentação técnica</td></tr>
              </tbody>
            </table>
          </div>
        );

      case 'schemas':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">📐 Schemas de Dados</h2>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Interface: Usuário</h3>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`{
  id: number,        // ID único (Date.now())
  nome: string,      // Único na base
  senha: string,
  role: 'admin' | 'projetista'
}`}
            </pre>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Interface: Projeto</h3>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`{
  id: number,
  numeroContrato: string,   // Formato XXX/XXXX (ex: '105/2026')
  projetista: string,
  cliente: string,
  tipo: string,             // 1 projeto por tipo selecionado
  status: 'Concluído' | 'Revisão',
  dataInicio: string,       // 'YYYY-MM-DD'
  dataFim: string,          // 'YYYY-MM-DD' (opcional)
  area: number,             // m²
  peDireito: number,        // m
  pavimento: number,        // m
  peso: number,             // kg
  numeroRevisao: string,    // '01', '02', ... (apenas se Revisão)
  motivoRevisao: string,    // texto do motivo (apenas se Revisão)
  projetoCliente: string,   // PROJETO_CLIENTE_OPCOES
  notas: string
}`}
            </pre>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Constantes</h3>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`STATUS_OPTIONS = ['Concluído', 'Revisão']

MOTIVOS_REVISAO = [
  'TROCA POR FALTA DE MATERIAL',
  'PROBLEMA NO EQUIPAMENTO',
  'PROJETO DE ESTRUTURA NÃO ATUALIZADO',
  'FALTA DE INFORMAÇÃO DE OBRA',
  'ERRO DE PROJETO DE ESCORAMENTO',
  'ADEQUAÇÃO À TAXA DE PROJETO',
  'NECESSIDADE DE ADAPTAÇÃO POR CONTA DO TERRENO',
  'SOLICITAÇÃO DO CLIENTE',
  'ERRO DE ORÇAMENTO COMERCIAL',
  'OUTRO MOTIVO'
]

PROJETO_CLIENTE_OPCOES = [
  'Chegou com prazo',
  'Chegou atrasado',
  'Sofreu revisão',
  'Necessidade de adaptação por conta do terreno'
]`}
            </pre>
          </div>
        );

      case 'permissoes':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">🔐 Permissões e Acessos</h2>
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-200 p-2 text-left">Aba / Recurso</th>
                  <th className="border border-slate-200 p-2 text-center">Admin</th>
                  <th className="border border-slate-200 p-2 text-center">Projetista</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-slate-200 p-2">Minhas Tarefas</td><td className="border border-slate-200 p-2 text-center">✅</td><td className="border border-slate-200 p-2 text-center">✅ (só os próprios)</td></tr>
                <tr><td className="border border-slate-200 p-2">Novo Projeto</td><td className="border border-slate-200 p-2 text-center">✅</td><td className="border border-slate-200 p-2 text-center">✅ (responsável travado)</td></tr>
                <tr><td className="border border-slate-200 p-2">Dashboard</td><td className="border border-slate-200 p-2 text-center">✅</td><td className="border border-slate-200 p-2 text-center">❌</td></tr>
                <tr><td className="border border-slate-200 p-2">Histórico Geral</td><td className="border border-slate-200 p-2 text-center">✅</td><td className="border border-slate-200 p-2 text-center">❌</td></tr>
                <tr><td className="border border-slate-200 p-2">Configurações</td><td className="border border-slate-200 p-2 text-center">✅</td><td className="border border-slate-200 p-2 text-center">❌</td></tr>
                <tr><td className="border border-slate-200 p-2">Documentação Técnica</td><td className="border border-slate-200 p-2 text-center">✅</td><td className="border border-slate-200 p-2 text-center">✅</td></tr>
              </tbody>
            </table>
            <p className="text-slate-600 mt-3 text-sm italic">A autenticação é local (sem backend). Em produção recomenda-se evoluir para autenticação real e hash de senhas.</p>
          </div>
        );

      case 'manutencao':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">🛠️ Manutenção</h2>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Adicionar um novo tipo de estrutura</h3>
            <ol className="list-decimal pl-6 space-y-1 text-slate-700">
              <li>Faça login como Administrador.</li>
              <li>Vá em <strong>Configurações → Tipos de Estrutura</strong>.</li>
              <li>Preencha o nome e clique em <em>Adicionar</em>.</li>
              <li>O novo tipo aparece imediatamente na lista de checkboxes do formulário.</li>
            </ol>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Adicionar um novo motivo de revisão</h3>
            <p className="text-slate-600">A lista <code className="bg-slate-100 px-1 rounded">MOTIVOS_REVISAO</code> está no topo do arquivo App.jsx. Para adicionar um novo motivo, basta inserir uma string em maiúsculas no array e fazer o deploy.</p>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Adicionar um novo status</h3>
            <p className="text-slate-600">
              O sistema foi configurado para usar somente <strong>Concluído</strong> e <strong>Revisão</strong>.
              Para adicionar mais status no futuro, edite <code className="bg-slate-100 px-1 rounded">STATUS_OPTIONS</code>
              e ajuste o estilo do dropdown em <code className="bg-slate-100 px-1 rounded">renderStatusDropdown</code>.
            </p>

            <h3 className="text-lg font-bold text-slate-800 mt-4">Persistência (próximo passo recomendado)</h3>
            <p className="text-slate-600">Hoje os dados estão em memória. Caminhos sugeridos:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Curto prazo: salvar <code className="bg-slate-100 px-1 rounded">projetos</code>, <code className="bg-slate-100 px-1 rounded">usuarios</code> e <code className="bg-slate-100 px-1 rounded">tiposEstrutura</code> no <strong>localStorage</strong>.</li>
              <li>Médio prazo: integração com Supabase ou Firebase (autenticação + banco).</li>
              <li>Longo prazo: API própria + banco PostgreSQL.</li>
            </ul>
          </div>
        );

      case 'faq':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">❓ FAQ Técnico</h2>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="font-semibold text-slate-800">Por que o status só tem duas opções?</div>
              <p className="text-sm text-slate-600 mt-1">Decisão de produto: o ciclo de vida do projeto foi simplificado para refletir apenas o resultado final entregue pelo projetista (Concluído ou em Revisão). Para adicionar novos status, edite <code className="bg-slate-100 px-1 rounded">STATUS_OPTIONS</code>.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="font-semibold text-slate-800">Por que o número do contrato segue o padrão XXX/XXXX?</div>
              <p className="text-sm text-slate-600 mt-1">É o padrão administrativo da Mais Escoramentos (3 dígitos do contrato + ano). A máscara é aplicada via <code className="bg-slate-100 px-1 rounded">handleContratoChange</code> e validada por regex no submit.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="font-semibold text-slate-800">Como gerar projetos em lote (1 contrato → vários tipos)?</div>
              <p className="text-sm text-slate-600 mt-1">Basta marcar mais de um checkbox em <strong>Tipo de Estrutura</strong>. O sistema cria 1 registro independente para cada tipo, todos com a mesma identificação de contrato.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="font-semibold text-slate-800">Como exportar/relatório?</div>
              <p className="text-sm text-slate-600 mt-1">Hoje a exportação é manual (copiar a tabela). Próximos passos recomendados: botão de exportar CSV/XLSX no dashboard e no histórico (pode ser feito com SheetJS).</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="font-semibold text-slate-800">Como mudar o logotipo?</div>
              <p className="text-sm text-slate-600 mt-1">Substitua o arquivo <code className="bg-slate-100 px-1 rounded">public/Logo Mais.jpg</code> mantendo o mesmo nome, ou ajuste a tag <code className="bg-slate-100 px-1 rounded">&lt;img src="/Logo Mais.jpg" /&gt;</code> no header.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderDocsModal = () => {
    if (!showDocs) return null;
    const grupos = Array.from(new Set(DOCS_SECTIONS.map(s => s.group)));

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-blue-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg">
                <BookOpen size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">📋 Mais Projetos — Documentação Técnica</h3>
                <p className="text-xs text-blue-200">Manual técnico definitivo do sistema — v2.0.0 • Maio 2026 • React 18</p>
              </div>
            </div>
            <button onClick={() => setShowDocs(false)} className="p-2 text-blue-100 hover:text-white hover:bg-blue-800 rounded-lg transition-colors" title="Fechar">
              <X size={22} />
            </button>
          </div>

          {/* Body com sidebar + conteúdo */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto p-3 hidden md:block">
              {grupos.map(grupo => (
                <div key={grupo} className="mb-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">{grupo}</div>
                  {DOCS_SECTIONS.filter(s => s.group === grupo).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setDocsSection(s.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${docsSection === s.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-700 hover:bg-slate-200'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ))}
            </aside>

            {/* Sidebar Mobile (combo) */}
            <div className="md:hidden p-3 border-b border-slate-200 bg-slate-50 w-full">
              <select value={docsSection} onChange={(e) => setDocsSection(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                {DOCS_SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {/* Conteúdo */}
            <main className="flex-1 overflow-y-auto p-6 bg-white">
              {renderDocsContent()}

              <div className="mt-10 pt-4 border-t border-slate-200 text-xs text-slate-400 flex items-center gap-2">
                <FileText size={14} /> Documentação gerada para a Mais Escoramentos • Atualize esta página sempre que o sistema mudar.
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <header className="bg-blue-900 text-white shadow-md relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Container da Logo */}
            <div className="bg-white p-1 rounded-lg flex items-center justify-center">
              <img
                src="/Logo Mais.jpg"
                alt="Mais Projetos Logo"
                className="h-9 w-auto object-contain"
              />
            </div>
            {/* Nome do Sistema */}
            <h1 className="text-xl font-bold tracking-tight">Mais Projetos</h1>
          </div>

          {currentUser && (
            <div className="flex items-center gap-3">
              <span className="text-blue-200 text-sm hidden sm:block">
                Olá, <strong className="text-white">{currentUser.nome}</strong>
              </span>

              {/* (10) Botão de Documentação Técnica */}
              <button
                onClick={() => setShowDocs(true)}
                className="flex items-center gap-2 text-sm bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors border border-blue-700"
                title="Abrir documentação técnica do sistema"
              >
                <BookOpen size={16} />
                <span className="hidden sm:inline">Documentação</span>
              </button>

              <button onClick={handleLogout} className="flex items-center gap-2 text-sm bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors border border-blue-700">
                <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {dbLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Conectando ao banco de dados...</p>
          </div>
        ) : !currentUser ? (
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
      {renderDocsModal()}
    </div>
  );
}