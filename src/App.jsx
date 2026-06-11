import React, { useState, useMemo, useEffect } from 'react';
import { db } from './firebase';
import jsPDF from 'jspdf';
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

// (6) Status simplificado
const STATUS_OPTIONS = ['Concluído', 'Em Andamento', 'Revisão'];

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

// (11) Tipos de pavimento padronizados
const TIPO_PAVIMENTO_OPCOES = [
  'Pav. Tipo',
  '1º projeto',
  'Pav. transição',
  'Outro'
];

// Helper: validar máscara do contrato XXX/XXXX
const CONTRATO_REGEX = /^\d{3}\/\d{4}$/;

// Helper: formatar número da revisão com 2 dígitos
const formatarRevisao = (valor) => {
  const num = parseInt(valor, 10);
  if (Number.isNaN(num) || num <= 0) return '';
  return String(num).padStart(2, '0');
};

// (11) Helper: calcular duração entre dois datetime-local (string amigável)
const calcularDuracao = (inicio, fim) => {
  if (!inicio || !fim) return '';
  const i = new Date(inicio);
  const f = new Date(fim);
  if (Number.isNaN(i.getTime()) || Number.isNaN(f.getTime())) return '';
  const diffMs = f.getTime() - i.getTime();
  if (diffMs <= 0) return '';
  const totalMin = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}min`);
  return parts.join(' ');
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
  // (11) Novos campos
  tipoPavimento: '',
  outroTipoPavimentoTexto: '',
  alturaLaje: '',
  dataHoraInicio: '',
  dataHoraFim: '',
  duracao: '',
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
  const [projetoDetalhe, setProjetoDetalhe] = useState(null);

  // Modo edição completa (abre o formulário pré-preenchido)
  const [modoEdicao, setModoEdicao] = useState(false);
  const [projetoEditandoId, setProjetoEditandoId] = useState(null);

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

    // Validação: dataHoraFim >= dataHoraInicio (se preenchidas)
    if (formData.dataHoraInicio && formData.dataHoraFim && formData.dataHoraFim < formData.dataHoraInicio) {
      alert('A "Data e Hora de finalização" não pode ser anterior à "Data e Hora de início".');
      return;
    }

    const baseId = Date.now();
    const numeroRevisaoFinal = formData.status === 'Revisão'
      ? formatarRevisao(formData.numeroRevisao)
      : '';

    const motivoFinal = formData.motivoRevisao === 'OUTRO MOTIVO'
      ? `OUTRO MOTIVO: ${formData.outroMotivoTexto.trim()}`
      : formData.motivoRevisao;

    // (11) Tipo de pavimento final (com "Outro" → texto digitado)
    const tipoPavimentoFinal = formData.tipoPavimento === 'Outro'
      ? (formData.outroTipoPavimentoTexto.trim() || 'Outro')
      : (formData.tipoPavimento || '');

    // (11) Duração final (manual ou auto)
    const duracaoFinal = (formData.duracao || '').trim()
      || calcularDuracao(formData.dataHoraInicio, formData.dataHoraFim)
      || '';

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
        // (11) Sanitização dos novos campos
        tipoPavimento: tipoPavimentoFinal,
        outroTipoPavimentoTexto: undefined,
        alturaLaje: (formData.alturaLaje || '').toString().trim(),
        dataHoraInicio: formData.dataHoraInicio || '',
        dataHoraFim: formData.dataHoraFim || '',
        duracao: duracaoFinal,
        numeroRevisao: numeroRevisaoFinal,
        motivoRevisao: formData.status === 'Revisão' ? motivoFinal : ''
      };
    });

    // Modo edição: atualiza o projeto existente
    if (modoEdicao && projetoEditandoId) {
      const { id: _id, pesoPorTipo: _ppt, outroTipoPavimentoTexto: _opt, ...dadosAtualizados } = novosProjetos[0];
      try {
        await updateDoc(doc(db, 'projetos', String(projetoEditandoId)), dadosAtualizados);
      } catch (err) {
        alert('Erro ao atualizar projeto: ' + err.message);
        return;
      }
      setFormData({ ...initialFormData(), projetista: currentUser?.role === 'projetista' ? currentUser.nome : '' });
      setIsOutro(false);
      setOutroValor('');
      setModoEdicao(false);
      setProjetoEditandoId(null);
      alert('Projeto atualizado com sucesso!');
      setActiveTab('minhas-tarefas');
      return;
    }

    // Salvar cada projeto no Firestore
    try {
      await Promise.all(novosProjetos.map(p => {
        const { id, pesoPorTipo, outroTipoPavimentoTexto, ...dados } = p;
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
      onClick={e => e.stopPropagation()}
      onChange={(e) => { e.stopPropagation(); handleStatusChange(projeto.id, e.target.value); }}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors
        ${projeto.status === 'Concluído'
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          : projeto.status === 'Revisão'
          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          : projeto.status === 'Em Andamento'
          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
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

    // (11) Tipo de Pavimento — análise nova
    const porTipoPavimento = base.reduce((acc, p) => {
      const tp = (p.tipoPavimento && String(p.tipoPavimento).trim()) || 'Não informado';
      acc[tp] = (acc[tp] || 0) + 1;
      return acc;
    }, {});
    const rankingTipoPavimento = Object.entries(porTipoPavimento)
      .map(([tipoPav, qtd]) => ({
        tipoPav,
        qtd,
        percentual: total > 0 ? Math.round((qtd / total) * 100) : 0
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
      rankingMotivos,
      rankingTipoPavimento
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

  // --- Abrir formulário completo para edição ---
  const abrirEdicaoCompleta = (projeto) => {
    // Identifica se motivoRevisao é "OUTRO MOTIVO: ..."
    const motivoEhOutro = projeto.motivoRevisao?.startsWith('OUTRO MOTIVO');
    const outroMotivoTexto = motivoEhOutro ? projeto.motivoRevisao.replace(/^OUTRO MOTIVO:?\s*/, '') : '';
    // Identifica tipoPavimento "Outro"
    const tiposConhecidos = ['Pav. Tipo', '1º projeto', 'Pav. transição'];
    const ehOutroPav = projeto.tipoPavimento && !tiposConhecidos.includes(projeto.tipoPavimento);
    // Preenche o formData com os dados do projeto
    setFormData({
      numeroContrato: projeto.numeroContrato || '',
      projetista: projeto.projetista || '',
      cliente: projeto.cliente || '',
      tipo: [projeto.tipo] || [],
      status: projeto.status || 'Concluído',
      dataInicio: projeto.dataInicio || '',
      dataFim: projeto.dataFim || '',
      area: projeto.area || '',
      peDireito: projeto.peDireito || '',
      pavimento: projeto.pavimento || '',
      peso: projeto.peso || '',
      pesoPorTipo: { [projeto.tipo]: projeto.peso },
      numeroRevisao: projeto.numeroRevisao || '',
      motivoRevisao: motivoEhOutro ? 'OUTRO MOTIVO' : (projeto.motivoRevisao || ''),
      outroMotivoTexto,
      projetoCliente: projeto.projetoCliente || '',
      // (11) Restaura novos campos
      tipoPavimento: ehOutroPav ? 'Outro' : (projeto.tipoPavimento || ''),
      outroTipoPavimentoTexto: ehOutroPav ? projeto.tipoPavimento : '',
      alturaLaje: projeto.alturaLaje || '',
      dataHoraInicio: projeto.dataHoraInicio || '',
      dataHoraFim: projeto.dataHoraFim || '',
      duracao: projeto.duracao || '',
      notas: projeto.notas || ''
    });
    setIsOutro(false);
    setOutroValor('');
    setModoEdicao(true);
    setProjetoEditandoId(projeto.id);
    setActiveTab('form');
  };

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

  // --- Exportar Projeto em PDF ---
  const exportarPDF = (p) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210;
    const margin = 15;
    const col2 = W / 2 + 5;
    let y = 0;

    const fmt = (d) => d ? d.split('-').reverse().join('/') : '—';
    const num = (v) => v ? Number(v).toLocaleString('pt-BR') : '—';

    // ── Header azul ──
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MAIS ESCORAMENTOS', margin, 11);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Controle de Projetos', margin, 18);
    doc.setFontSize(10);
    doc.text('Gerado em: ' + new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}), W - margin, 18, { align: 'right' });
    y = 36;

    // ── Título do projeto ──
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Contrato ' + (p.numeroContrato || '—'), margin, y);
    y += 7;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(p.cliente || '—', margin, y);
    y += 5;

    // Status badge
    const statusColor = p.status === 'Concluído' ? [22, 163, 74] : [217, 119, 6];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(margin, y, 38, 7, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(p.status + (p.numeroRevisao ? '  Rev.#' + p.numeroRevisao : ''), margin + 19, y + 4.8, { align: 'center' });
    y += 13;

    // ── Linha divisória ──
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 7;

    // ── Helper: bloco de campo ──
    const campo = (label, valor, x, yy, w = 85) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, yy, w, 14, 2, 2, 'F');
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), x + 4, yy + 5);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(valor || '—'), x + 4, yy + 11);
    };

    // ── Seção: Informações Gerais ──
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMAÇÕES GERAIS', margin, y);
    y += 5;

    campo('Projetista', p.projetista, margin, y);
    campo('Tipo de Estrutura', p.tipo, col2, y);
    y += 17;
    campo('Data Início', fmt(p.dataInicio), margin, y);
    campo('Data Fim', fmt(p.dataFim), col2, y);
    y += 17;

    // ── Seção: Dados Técnicos ──
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS TÉCNICOS', margin, y);
    y += 5;

    campo('Área (m²)', p.area ? num(p.area) + ' m²' : '—', margin, y);
    campo('Pé Direito (m)', p.peDireito ? num(p.peDireito) + ' m' : '—', col2, y);
    y += 17;
    campo('Pavimento', p.pavimento, margin, y);
    campo('Peso Total (kg)', p.peso ? num(p.peso) + ' kg' : '—', col2, y);
    y += 17;

    // (11) Linha extra: Tipo de pavimento + Altura da laje
    if (p.tipoPavimento || (p.alturaLaje && String(p.alturaLaje).trim())) {
      campo('Tipo de Pavimento', p.tipoPavimento, margin, y);
      const lajeTxt = p.alturaLaje && String(p.alturaLaje).trim()
        ? (String(p.alturaLaje).match(/cm/i) ? p.alturaLaje : `${p.alturaLaje} cm`)
        : '—';
      campo('Altura da Laje (cm)', lajeTxt, col2, y);
      y += 17;
    }

    // (11) Linha extra: Datetime início/fim + Duração
    if (p.dataHoraInicio || p.dataHoraFim || p.duracao) {
      const fmtDH = (s) => {
        if (!s) return '—';
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return s;
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
      };
      campo('Início (data/hora)', fmtDH(p.dataHoraInicio), margin, y);
      campo('Fim (data/hora)', fmtDH(p.dataHoraFim), col2, y);
      y += 17;
      if (p.duracao) {
        campo('Duração', p.duracao, margin, y, W - margin * 2);
        y += 17;
      }
    }

    // ── Projeto do Cliente ──
    if (p.projetoCliente) {
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('PROJETO DO CLIENTE', margin, y);
      y += 5;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, W - margin * 2, 12, 2, 2, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(p.projetoCliente, margin + 4, y + 7.5);
      y += 17;
    }

    // ── Motivo Revisão ──
    if (p.motivoRevisao) {
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(margin, y, W - margin * 2, 14, 2, 2, 'F');
      doc.setDrawColor(251, 191, 36);
      doc.roundedRect(margin, y, W - margin * 2, 14, 2, 2, 'S');
      doc.setTextColor(180, 83, 9);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('MOTIVO DA REVISÃO', margin + 4, y + 5);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(p.motivoRevisao, margin + 4, y + 11);
      y += 18;
    }

    // ── Observações ──
    if (p.notas) {
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES', margin, y);
      y += 5;
      doc.setFillColor(239, 246, 255);
      const linhas = doc.splitTextToSize(p.notas, W - margin * 2 - 8);
      const hNotas = linhas.length * 5 + 8;
      doc.roundedRect(margin, y, W - margin * 2, hNotas, 2, 2, 'F');
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(linhas, margin + 4, y + 6);
      y += hNotas + 5;
    }

    // ── Footer ──
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 280, W - margin, 280);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Mais Escoramentos — Documento gerado automaticamente', margin, 285);
    doc.text('Página 1 de 1', W - margin, 285, { align: 'right' });

    const nomeArquivo = (p.numeroContrato + '_' + p.cliente + '_' + p.tipo)
      .replace(/[^a-zA-Z0-9_]/g, '_').replace(/__+/g, '_').substring(0, 60) + '.pdf';
    doc.save(nomeArquivo);
  };

  const renderMinhasTarefas = () => {
    const meusProjetos = projetos.filter(p => p.projetista === currentUser?.nome);

    const fmt = (d) => d ? d.split('-').reverse().join('/') : '—';

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">

        {/* Modal de Detalhes do Projeto */}
        {projetoDetalhe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150" onClick={() => setProjetoDetalhe(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl font-bold text-slate-800">{projetoDetalhe.numeroContrato}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${projetoDetalhe.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {projetoDetalhe.status}{projetoDetalhe.numeroRevisao ? ` — Rev. #${projetoDetalhe.numeroRevisao}` : ''}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm">{projetoDetalhe.cliente}</p>
                </div>
                <button onClick={() => setProjetoDetalhe(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Projetista</p>
                  <p className="font-semibold text-slate-800">{projetoDetalhe.projetista || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Tipo de Estrutura</p>
                  <p className="font-semibold text-slate-800 uppercase">{projetoDetalhe.tipo}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Data Início</p>
                  <p className="font-semibold text-slate-800">{fmt(projetoDetalhe.dataInicio)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Data Fim</p>
                  <p className="font-semibold text-slate-800">{fmt(projetoDetalhe.dataFim)}</p>
                </div>
                {projetoDetalhe.area > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Área</p>
                    <p className="font-semibold text-slate-800">{projetoDetalhe.area} m²</p>
                  </div>
                )}
                {projetoDetalhe.peDireito > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Pé Direito</p>
                    <p className="font-semibold text-slate-800">{projetoDetalhe.peDireito} m</p>
                  </div>
                )}
                {projetoDetalhe.pavimento && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Pavimento</p>
                    <p className="font-semibold text-slate-800">{projetoDetalhe.pavimento}</p>
                  </div>
                )}
                {projetoDetalhe.peso > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Peso</p>
                    <p className="font-semibold text-slate-800">{projetoDetalhe.peso.toLocaleString('pt-BR')} kg</p>
                  </div>
                )}
                {projetoDetalhe.tipoPavimento && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Tipo de Pavimento</p>
                    <p className="font-semibold text-slate-800">{projetoDetalhe.tipoPavimento}</p>
                  </div>
                )}
                {projetoDetalhe.alturaLaje && String(projetoDetalhe.alturaLaje).trim() && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Altura da Laje</p>
                    <p className="font-semibold text-slate-800">{String(projetoDetalhe.alturaLaje).match(/cm/i) ? projetoDetalhe.alturaLaje : `${projetoDetalhe.alturaLaje} cm`}</p>
                  </div>
                )}
                {projetoDetalhe.dataHoraInicio && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Início (data/hora)</p>
                    <p className="font-semibold text-slate-800">{new Date(projetoDetalhe.dataHoraInicio).toLocaleString('pt-BR')}</p>
                  </div>
                )}
                {projetoDetalhe.dataHoraFim && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Fim (data/hora)</p>
                    <p className="font-semibold text-slate-800">{new Date(projetoDetalhe.dataHoraFim).toLocaleString('pt-BR')}</p>
                  </div>
                )}
                {projetoDetalhe.duracao && (
                  <div className="bg-slate-50 rounded-xl p-4 col-span-2">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Duração do Projeto</p>
                    <p className="font-semibold text-slate-800 font-mono">{projetoDetalhe.duracao}</p>
                  </div>
                )}
                {projetoDetalhe.projetoCliente && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Projeto do Cliente</p>
                    <p className="font-semibold text-slate-800">{projetoDetalhe.projetoCliente}</p>
                  </div>
                )}
                {projetoDetalhe.motivoRevisao && (
                  <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs text-amber-600 uppercase font-semibold mb-1">Motivo da Revisão</p>
                    <p className="font-semibold text-amber-800">{projetoDetalhe.motivoRevisao}</p>
                  </div>
                )}
                {projetoDetalhe.notas && (
                  <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs text-blue-500 uppercase font-semibold mb-1">Observações</p>
                    <p className="text-slate-700">{projetoDetalhe.notas}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 pb-6">
                <button onClick={() => exportarPDF(projetoDetalhe)} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  <FileText size={15} /> Exportar PDF
                </button>
                <button onClick={() => { setProjetoDetalhe(null); abrirEdicaoCompleta(projetoDetalhe); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  <Edit2 size={15} /> Editar Projeto
                </button>
                <button onClick={() => setProjetoDetalhe(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
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
                  <th className="px-4 py-4">Contrato / Cliente</th>
                  <th className="px-4 py-4">Início → Fim</th>
                  <th className="px-4 py-4">Tipo Estrutura</th>
                  <th className="px-4 py-4">Status</th>
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
                    <React.Fragment key={projeto.id}>
                      <tr className="hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => { if (editandoProjetoId !== projeto.id && confirmandoExclusaoId !== projeto.id) setProjetoDetalhe(projeto); }}>
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
                        <td className="px-4 py-4 text-slate-600">
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
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
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
                        <td className="px-4 py-4">
                          {editandoProjetoId === projeto.id ? (
                            <div className="flex flex-col gap-2">
                              <select className="border border-slate-300 rounded px-2 py-1 text-xs" value={formEdicao.status || ''} onChange={e => setFormEdicao(p => ({...p, status: e.target.value}))}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <div className="flex gap-1">
                                <button onClick={() => salvarEdicaoProjeto(projeto.id)} className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors">
                                  <Save size={12} /> Salvar
                                </button>
                                <button onClick={() => { setEditandoProjetoId(null); setFormEdicao({}); }} className="flex items-center gap-1 px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded transition-colors">
                                  <X size={12} /> Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {renderStatusDropdown(projeto)}
                              <button onClick={(e) => { e.stopPropagation(); abrirEdicaoCompleta(projeto); }} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0" title="Editar projeto completo">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmandoExclusaoId(projeto.id); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0" title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {confirmandoExclusaoId === projeto.id && (
                        <tr className="bg-red-50">
                          <td colSpan="4" className="px-6 py-3">
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

  // --- Exportar Dashboard em PDF (com indicadores novos) ---
  const exportarDashboardPDF = () => {
    const docPdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297; const PH = 210; const M = 14; const tW = W - M * 2;
    let y = 0;

    const fmt  = (d) => d ? d.split('-').reverse().join('/') : '—';
    const safe = (v) => (v === undefined || v === null) ? '—' : String(v);

    const addPage = () => { docPdf.addPage(); y = 18; };
    const checkY = (needed) => { if (y + needed > 190) addPage(); };

    const sectionTitle = (txt) => {
      checkY(20);
      docPdf.setDrawColor(226,232,240);
      docPdf.line(M, y, W - M, y);
      y += 5;
      docPdf.setTextColor(30,64,175); docPdf.setFontSize(10); docPdf.setFont('helvetica','bold');
      docPdf.text(txt, M, y); y += 7;
    };

    const tableHeader = (cols, headers, bgR=30, bgG=64, bgB=175) => {
      checkY(8);
      docPdf.setFillColor(bgR,bgG,bgB); docPdf.rect(M, y, tW, 8, 'F');
      docPdf.setTextColor(255,255,255); docPdf.setFontSize(8); docPdf.setFont('helvetica','bold');
      let x = M;
      headers.forEach((h,i) => { docPdf.text(h, x+2, y+5.5); x += cols[i]; });
      y += 8;
    };

    // ── HEADER ──
    docPdf.setFillColor(30,64,175); docPdf.rect(0,0,W,22,'F');
    docPdf.setTextColor(255,255,255);
    docPdf.setFontSize(16); docPdf.setFont('helvetica','bold');
    docPdf.text('MAIS ESCORAMENTOS', M, 10);
    docPdf.setFontSize(10); docPdf.setFont('helvetica','normal');
    docPdf.text('Dashboard — Visão Geral da Produção', M, 17);
    const agora = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    docPdf.text('Gerado em: ' + agora, W - M, 17, {align:'right'});
    y = 30;

    docPdf.setTextColor(71,85,105); docPdf.setFontSize(9); docPdf.setFont('helvetica','normal');
    const periodo = (dashPeriodoInicio || dashPeriodoFim)
      ? 'Período: ' + (dashPeriodoInicio ? fmt(dashPeriodoInicio) : 'Início') + ' → ' + (dashPeriodoFim ? fmt(dashPeriodoFim) : 'Hoje')
      : 'Período: Todos os registros';
    const filtResp = dashFiltroProjetista ? '   |   Responsável: ' + dashFiltroProjetista : '';
    docPdf.text(periodo + filtResp, M, y); y += 9;

    // ── KPIs ──
    const emAndamento = Math.max(0, stats.total - stats.concluidos - stats.emRevisao);
    const pct = (n) => stats.total > 0 ? Math.round(n / stats.total * 100) + '%' : '0%';
    const kpis = [
      { label:'TOTAL DE PROJETOS', value:safe(stats.total),      sub:'',                    cor:[30,64,175],  bg:[239,246,255] },
      { label:'CONCLUÍDOS',        value:safe(stats.concluidos), sub:pct(stats.concluidos), cor:[22,101,52],  bg:[240,253,244] },
      { label:'EM ANDAMENTO',      value:safe(emAndamento),      sub:pct(emAndamento),      cor:[29,78,216],  bg:[219,234,254] },
      { label:'REVISÃO',           value:safe(stats.emRevisao),  sub:pct(stats.emRevisao),  cor:[146,64,14],  bg:[255,251,235] },
    ];
    const cW = (tW - 9) / 4;
    kpis.forEach((k, i) => {
      const x = M + i*(cW+3);
      docPdf.setFillColor(k.bg[0], k.bg[1], k.bg[2]); docPdf.roundedRect(x, y, cW, 20, 2, 2, 'F');
      docPdf.setTextColor(100,116,139); docPdf.setFontSize(7); docPdf.setFont('helvetica','bold');
      docPdf.text(k.label, x+4, y+6);
      docPdf.setTextColor(k.cor[0], k.cor[1], k.cor[2]); docPdf.setFontSize(20); docPdf.setFont('helvetica','bold');
      docPdf.text(k.value, x+4, y+15.5);
      if (k.sub) {
        const vw = docPdf.getTextWidth(k.value);
        docPdf.setFontSize(8); docPdf.setFont('helvetica','normal');
        docPdf.text(k.sub + ' do total', x + 6 + vw, y + 15.5);
      }
    });
    y += 28;

    // ── 1. Participação por Responsável ──
    sectionTitle('1. PARTICIPAÇÃO E VOLUME POR RESPONSÁVEL');
    const colR = [65, 24, 24, 28, 24, tW-65-24-24-28-24];
    tableHeader(colR, ['Responsável','Projetos','% Total','Concluídos','Revisões','Tipos Principais']);
    stats.rankingProjetistas.forEach((proj, idx) => {
      checkY(8);
      const tipos = Object.entries(proj.porTipo||{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t])=>t).join(', ') || '—';
      const bg = idx%2===0?[248,250,252]:[255,255,255];
      docPdf.setFillColor(bg[0], bg[1], bg[2]); docPdf.rect(M, y, tW, 8, 'F');
      let x = M;
      docPdf.setTextColor(15,23,42); docPdf.setFontSize(8.5); docPdf.setFont('helvetica', idx===0?'bold':'normal');
      docPdf.text(proj.nome, x+2, y+5.5); x += colR[0];
      docPdf.text(safe(proj.total), x+2, y+5.5); x += colR[1];
      docPdf.setFont('helvetica','normal');
      docPdf.text(proj.percentual+'%', x+2, y+5.5); x += colR[2];
      docPdf.setTextColor(22,101,52); docPdf.setFont('helvetica','bold');
      docPdf.text(safe(proj.porStatus['Concluído']||0), x+2, y+5.5); x += colR[3];
      docPdf.setTextColor(146,64,14);
      docPdf.text(safe(proj.porStatus['Revisão']||0), x+2, y+5.5); x += colR[4];
      docPdf.setTextColor(15,23,42); docPdf.setFontSize(7.5); docPdf.setFont('helvetica','normal');
      docPdf.text(docPdf.splitTextToSize(tipos, colR[5]-4)[0] || '', x+2, y+5.5);
      y += 8;
    });
    y += 6;

    // ── 2. Distribuição por Tipo de Estrutura ──
    sectionTitle('2. DISTRIBUIÇÃO POR TIPO DE ESTRUTURA');
    const barAreaW = tW - 110 - 26 - 26;
    const colD = [110, 26, 26, barAreaW];
    tableHeader(colD, ['Tipo de Estrutura','Projetos','% Total','Distribuição Visual']);
    stats.rankingTipos.forEach((t, idx) => {
      checkY(8);
      const bg = idx%2===0?[248,250,252]:[255,255,255];
      docPdf.setFillColor(bg[0], bg[1], bg[2]); docPdf.rect(M, y, tW, 8, 'F');
      docPdf.setTextColor(15,23,42); docPdf.setFontSize(8.5); docPdf.setFont('helvetica','normal');
      let x = M;
      docPdf.text(t.tipo, x+2, y+5.5); x += colD[0];
      docPdf.text(safe(t.qtd), x+2, y+5.5); x += colD[1];
      docPdf.text(t.percentual+'%', x+2, y+5.5); x += colD[2];
      const bW = barAreaW - 6;
      docPdf.setFillColor(220,230,240); docPdf.roundedRect(x+1, y+2.5, bW, 3.5, 1, 1, 'F');
      const fill = Math.max(2, bW * (t.percentual / 100));
      docPdf.setFillColor(30,64,175); docPdf.roundedRect(x+1, y+2.5, fill, 3.5, 1, 1, 'F');
      docPdf.setTextColor(255,255,255); docPdf.setFontSize(6); docPdf.setFont('helvetica','bold');
      if (fill > 12) docPdf.text(t.percentual+'%', x+3, y+5.2);
      y += 8;
    });
    y += 6;

    // ── 3. Distribuição por Tipo de Pavimento (NOVO) ──
    if (stats.rankingTipoPavimento && stats.rankingTipoPavimento.length > 0) {
      sectionTitle('3. DISTRIBUIÇÃO POR TIPO DE PAVIMENTO');
      const colTP = [110, 26, 26, barAreaW];
      tableHeader(colTP, ['Tipo de Pavimento','Projetos','% Total','Distribuição Visual'], 79, 70, 229);
      stats.rankingTipoPavimento.forEach((t, idx) => {
        checkY(8);
        const bg = idx%2===0?[245,243,255]:[255,255,255];
        docPdf.setFillColor(bg[0], bg[1], bg[2]); docPdf.rect(M, y, tW, 8, 'F');
        docPdf.setTextColor(15,23,42); docPdf.setFontSize(8.5); docPdf.setFont('helvetica','normal');
        let x = M;
        docPdf.text(docPdf.splitTextToSize(t.tipoPav, colTP[0]-4)[0] || '', x+2, y+5.5); x += colTP[0];
        docPdf.text(safe(t.qtd), x+2, y+5.5); x += colTP[1];
        docPdf.text(t.percentual+'%', x+2, y+5.5); x += colTP[2];
        const bW = barAreaW - 6;
        docPdf.setFillColor(224,231,255); docPdf.roundedRect(x+1, y+2.5, bW, 3.5, 1, 1, 'F');
        const fill = Math.max(2, bW * (t.percentual / 100));
        docPdf.setFillColor(79,70,229); docPdf.roundedRect(x+1, y+2.5, fill, 3.5, 1, 1, 'F');
        if (fill > 12) { docPdf.setTextColor(255,255,255); docPdf.setFontSize(6); docPdf.setFont('helvetica','bold'); docPdf.text(t.percentual+'%', x+3, y+5.2); }
        y += 8;
      });
      y += 6;
    }

    // ── 4. Motivos de Revisão ──
    if (stats.rankingMotivos && stats.rankingMotivos.length > 0) {
      sectionTitle('4. ANÁLISE DE MOTIVOS DE REVISÃO  (' + safe(stats.totalRevisoes) + ' revisões no período)');
      const bMW = tW - 130 - 24 - 24;
      const colMot = [130, 24, 24, bMW];
      tableHeader(colMot, ['Motivo','Qtd','%','Frequência'], 146, 64, 14);
      stats.rankingMotivos.forEach((m, idx) => {
        checkY(8);
        const bg = idx%2===0?[255,253,247]:[255,255,255];
        docPdf.setFillColor(bg[0], bg[1], bg[2]); docPdf.rect(M, y, tW, 8, 'F');
        docPdf.setTextColor(15,23,42); docPdf.setFontSize(8.5); docPdf.setFont('helvetica','normal');
        let x = M;
        docPdf.text(docPdf.splitTextToSize(m.motivo, colMot[0]-4)[0] || '', x+2, y+5.5); x += colMot[0];
        docPdf.setTextColor(146,64,14); docPdf.setFont('helvetica','bold');
        docPdf.text(safe(m.qtd), x+2, y+5.5); x += colMot[1];
        docPdf.text(m.percentual+'%', x+2, y+5.5); x += colMot[2];
        const bW = bMW - 6;
        docPdf.setFillColor(254,230,190); docPdf.roundedRect(x+1, y+2.5, bW, 3.5, 1, 1, 'F');
        const fill = Math.max(2, bW * (m.percentual / 100));
        docPdf.setFillColor(217,119,6); docPdf.roundedRect(x+1, y+2.5, fill, 3.5, 1, 1, 'F');
        if (fill > 12) { docPdf.setTextColor(255,255,255); docPdf.setFontSize(6); docPdf.setFont('helvetica','bold'); docPdf.text(m.percentual+'%', x+3, y+5.2); }
        y += 8;
      });
    }

    // ── Footer ──
    const totalPages = docPdf.getNumberOfPages();
    for (let i=1; i<=totalPages; i++) {
      docPdf.setPage(i);
      docPdf.setFillColor(30,64,175); docPdf.rect(0, PH-10, W, 10, 'F');
      docPdf.setTextColor(255,255,255); docPdf.setFontSize(8); docPdf.setFont('helvetica','normal');
      docPdf.text('Mais Escoramentos — Dashboard gerado automaticamente', M, PH-4);
      docPdf.text('Página ' + i + ' de ' + totalPages, W-M, PH-4, {align:'right'});
    }

    docPdf.save('Dashboard_MaisEscoramentos_' + new Date().toLocaleDateString('pt-BR').replace(/[/]/g,'-') + '.pdf');
  };

  // (9) Dashboard
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-blue-600" /> Visão Geral da Produção
          </h2>
          <button onClick={exportarDashboardPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
            <FileText size={15} /> Exportar PDF
          </button>
        </div>

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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Período de</label>
              <input
                type="date"
                value={dashPeriodoInicio}
                onChange={(e) => setDashPeriodoInicio(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Até</label>
              <input
                type="date"
                value={dashPeriodoFim}
                onChange={(e) => setDashPeriodoFim(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
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
              <p className="text-sm text-slate-500 font-medium">Revisão</p>
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

        {/* BLOCO 2 — Distribuição por Tipo de Estrutura */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Wrench size={18} className="text-blue-600" /> Distribuição por Tipo de Estrutura
            </h3>
            <p className="text-xs text-slate-500 mt-1">Quantos projetos foram produzidos de cada tipo de estrutura no período.</p>
          </div>
          {stats.rankingTipos.length === 0 ? (
            <p className="px-6 py-8 text-center text-slate-500">Nenhum dado registrado no período selecionado.</p>
          ) : (
            <div className="p-6 space-y-3">
              {stats.rankingTipos.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-blue-600 text-white' : idx === 1 ? 'bg-blue-300 text-blue-900' : 'bg-slate-200 text-slate-600'}`}>{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-800 uppercase truncate" title={item.tipo}>{item.tipo}</span>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden hidden sm:block">
                      <div className="bg-blue-500 h-full rounded-full transition-all duration-700" style={{ width: `${item.percentual}%` }} />
                    </div>
                    <span className="text-xs font-bold text-blue-700 w-8 text-right">{item.percentual}%</span>
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold min-w-[2.5rem]">{item.qtd}×</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BLOCO 3 — Distribuição por Tipo de Pavimento (NOVO) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" /> Distribuição por Tipo de Pavimento
            </h3>
            <p className="text-xs text-slate-500 mt-1">Frequência de cada tipo de pavimento (Pav. Tipo, 1º projeto, transição, outros) no período.</p>
          </div>
          {stats.rankingTipoPavimento.length === 0 ? (
            <p className="px-6 py-8 text-center text-slate-500">Nenhum dado registrado no período selecionado.</p>
          ) : (
            <div className="p-6 space-y-3">
              {stats.rankingTipoPavimento.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-indigo-600 text-white' : idx === 1 ? 'bg-indigo-300 text-indigo-900' : 'bg-slate-200 text-slate-600'}`}>{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-800 truncate" title={item.tipoPav}>{item.tipoPav}</span>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden hidden sm:block">
                      <div className="bg-indigo-500 h-full rounded-full transition-all duration-700" style={{ width: `${item.percentual}%` }} />
                    </div>
                    <span className="text-xs font-bold text-indigo-700 w-8 text-right">{item.percentual}%</span>
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold min-w-[2.5rem]">{item.qtd}×</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BLOCO 4 — Motivos de Revisão */}
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

  // (1)-(11) Formulário com TODOS os novos campos
  const renderForm = () => {
    const isRevisao = formData.status === 'Revisão';
    const isOutroMotivo = formData.motivoRevisao === 'OUTRO MOTIVO';

    return (
      <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-300">

        {modoEdicao && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-5 py-3 mb-4">
            <Edit2 size={16} className="shrink-0" />
            <span className="font-semibold text-sm">Modo edição — suas alterações substituirão os dados atuais do projeto.</span>
          </div>
        )}

        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
            {modoEdicao ? <><Edit2 className="text-amber-500" size={24}/> Editar Projeto</> : <><FilePlus className="text-blue-600" /> Cadastrar Novo Projeto</>}
          </h2>
          <p className="text-slate-500 text-sm mb-6">{modoEdicao ? 'Atualize os dados do projeto abaixo e clique em Salvar Alterações.' : 'Preencha os dados abaixo para registrar suas frentes de trabalho.'}</p>

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

          {/* (11) Tipo de pavimento + Altura da laje */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Layers size={14} className="text-slate-400" /> Tipo de pavimento
              </label>
              <select
                name="tipoPavimento"
                value={formData.tipoPavimento}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
              >
                <option value="">Selecione...</option>
                {TIPO_PAVIMENTO_OPCOES.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              {formData.tipoPavimento === 'Outro' && (
                <input
                  type="text"
                  name="outroTipoPavimentoTexto"
                  value={formData.outroTipoPavimentoTexto}
                  onChange={handleInputChange}
                  className="mt-2 w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Descreva o tipo de pavimento..."
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Ruler size={14} className="text-slate-400" /> Altura da laje (cm)
              </label>
              <input
                type="text"
                name="alturaLaje"
                value={formData.alturaLaje}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Ex: 12 ou 12,5 ou Variável (ver planta)"
              />
            </div>
          </div>

          {/* (11) Data/Hora de início e finalização + Duração manual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" /> Data e Hora de início do projeto
              </label>
              <input
                type="datetime-local"
                name="dataHoraInicio"
                value={formData.dataHoraInicio}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" /> Data e Hora de finalização do projeto
              </label>
              <input
                type="datetime-local"
                name="dataHoraFim"
                value={formData.dataHoraFim}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" /> Duração do projeto
              </label>
              <input
                type="text"
                name="duracao"
                value={formData.duracao}
                onChange={handleInputChange}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder={calcularDuracao(formData.dataHoraInicio, formData.dataHoraFim) || 'Ex: 3h 30min, 2 dias...'}
              />
              {calcularDuracao(formData.dataHoraInicio, formData.dataHoraFim) && !formData.duracao && (
                <p className="text-xs text-slate-500 italic mt-1">
                  Sugestão calculada: <strong className="font-mono">{calcularDuracao(formData.dataHoraInicio, formData.dataHoraFim)}</strong>
                </p>
              )}
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
            <label className="text-sm font-medium text-slate-700 flex flex-wrap items-baseline gap-x-2">
              <span>Observações Gerais</span>
              <span className="text-xs text-slate-500 font-normal italic">(ex.: o projeto possui muitas vigas de diferentes seções, muitas interferências etc)</span>
            </label>
            <textarea name="notas" value={formData.notas} onChange={handleInputChange} rows="3" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" placeholder="Descreva particularidades técnicas do projeto..."></textarea>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            {modoEdicao && (
              <button
                type="button"
                onClick={() => { setModoEdicao(false); setProjetoEditandoId(null); setFormData({ ...initialFormData(), projetista: currentUser?.role === 'projetista' ? currentUser.nome : '' }); setActiveTab(currentUser?.role === 'admin' ? 'lista' : 'minhas-tarefas'); }}
                className="flex items-center gap-2 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors text-base"
              >
                <X size={18} /> Cancelar e Voltar
              </button>
            )}
            <button type="submit" className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-800 hover:bg-blue-900 text-white font-medium rounded-lg shadow-md transition-colors text-lg">
              <Save size={22} /> {modoEdicao ? 'Salvar Alterações' : 'Salvar Formulário'}
            </button>
          </div>
        </form>
        </div>
      </div>
    );
  };

  const renderList = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ListTodo className="text-blue-600" /> Histórico Geral
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{projetosFiltrados.length} projeto{projetosFiltrados.length !== 1 ? 's' : ''} encontrado{projetosFiltrados.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input type="text" placeholder="Buscar contrato ou cliente..." value={buscaTermo} onChange={(e) => setBuscaTermo(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-56" />
          </div>
          <select value={filtroProjetista} onChange={(e) => setFiltroProjetista(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos Responsáveis</option>
            {usuarios.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide font-semibold">
            <tr>
              <th className="px-4 py-3">Contrato / Cliente</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3">Tipo / Revisão</th>
              <th className="px-4 py-3">Medidas</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projetosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                  <Filter size={28} className="mx-auto mb-2 text-slate-300" />
                  Nenhum projeto encontrado.
                </td>
              </tr>
            ) : (
              projetosFiltrados.map((projeto, idx) => (
                <tr key={projeto.id} className={`hover:bg-blue-50 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  onClick={() => setProjetoDetalhe(projeto)}>

                  <td className="px-4 py-3 max-w-[180px]">
                    <div className="font-semibold text-slate-800 text-sm">{projeto.numeroContrato}</div>
                    <div className="text-slate-500 text-xs mt-0.5 truncate" title={projeto.cliente}>{projeto.cliente}</div>
                    {projeto.projetoCliente && (
                      <div className="text-blue-500 text-xs mt-0.5 italic truncate">{projeto.projetoCliente}</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center bg-slate-100 px-2 py-0.5 rounded text-slate-700 text-xs font-medium whitespace-nowrap">{projeto.projetista}</span>
                  </td>

                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400 shrink-0" />
                      <span>{projeto.dataInicio ? projeto.dataInicio.split('-').reverse().join('/') : '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <ChevronRight size={12} className="text-slate-300 shrink-0" />
                      <span>{projeto.dataFim ? projeto.dataFim.split('-').reverse().join('/') : '—'}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 max-w-[160px]">
                    <div className="text-slate-700 font-semibold text-xs uppercase truncate" title={projeto.tipo}>{projeto.tipo}</div>
                    {projeto.status === 'Revisão' && projeto.numeroRevisao && (
                      <div className="text-amber-600 text-xs mt-0.5 font-bold">Rev. #{projeto.numeroRevisao}</div>
                    )}
                    {projeto.motivoRevisao && (
                      <div className="text-amber-500 text-xs mt-0.5 italic truncate" title={projeto.motivoRevisao}>{projeto.motivoRevisao}</div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {projeto.area > 0    && <div><span className="font-medium text-slate-600">{projeto.area}</span> m²</div>}
                    {projeto.peDireito > 0 && <div>PD: <span className="font-medium text-slate-600">{projeto.peDireito}</span> m</div>}
                    {projeto.pavimento   && <div className="truncate max-w-[90px]" title={projeto.pavimento}>{projeto.pavimento}</div>}
                    {projeto.alturaLaje && String(projeto.alturaLaje).trim() && <div>Laje: <span className="font-medium text-slate-600">{String(projeto.alturaLaje).match(/cm/i) ? projeto.alturaLaje : `${projeto.alturaLaje} cm`}</span></div>}
                    {projeto.peso > 0    && <div><span className="font-medium text-slate-600">{Number(projeto.peso).toLocaleString('pt-BR')}</span> kg</div>}
                  </td>

                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {renderStatusDropdown(projeto)}
                  </td>

                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEdicaoCompleta(projeto)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setConfirmandoExclusaoId(projeto.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {confirmandoExclusaoId === projeto.id && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmandoExclusaoId(null)}>
                        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle size={22} className="text-red-500 shrink-0" />
                            <p className="text-sm font-semibold text-slate-800">Excluir <strong>{projeto.numeroContrato} — {projeto.tipo}</strong>?</p>
                          </div>
                          <p className="text-xs text-slate-500 mb-5">Esta ação não pode ser desfeita.</p>
                          <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmandoExclusaoId(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg">Cancelar</button>
                            <button onClick={() => excluirProjeto(projeto.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg">Excluir</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
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
                        <button onClick={() => salvarEdicaoUsuario(u.id)} className="text-green-600 hover:text-green-800 p-2 hover:bg-green-100 rounded transition-colors" title="Salvar"><CheckCircle2 size={18} /></button>
                        <button onClick={() => setEditingUserId(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded transition-colors" title="Cancelar"><X size={18} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingUserId(u.id); setEditUserNome(u.nome); setEditUserSenha(u.senha); setEditUserRole(u.role); }} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition-colors" title="Editar Usuário"><Edit2 size={18} /></button>
                        <button onClick={() => removerUsuario(u.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors" title="Remover Usuário"><Trash2 size={18} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b border-slate-100 pb-3">
            <Wrench size={20} className="text-blue-600" /> Tipos de Estrutura (Checkbox)
          </div>

          <form onSubmit={adicionarTipoEstrutura} className="flex gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <input type="text" value={novoTipoEstrutura} onChange={e => setNovoTipoEstrutura(e.target.value)} placeholder="Nova estrutura..." className="flex-1 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
            <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 p-2 rounded-lg transition-colors font-medium flex items-center gap-1 text-sm px-3"><Plus size={16} /> Adicionar</button>
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
                        <button onClick={() => salvarEdicaoTipo(t)} className="text-green-600 hover:text-green-800 p-2 hover:bg-green-100 rounded transition-colors" title="Salvar"><CheckCircle2 size={18} /></button>
                        <button onClick={() => setEditingTipo(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded transition-colors" title="Cancelar"><X size={18} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingTipo(t); setEditTipoInput(t); }} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition-colors" title="Editar Estrutura"><Edit2 size={18} /></button>
                        <button onClick={() => removerTipoEstrutura(t)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors" title="Remover Estrutura"><Trash2 size={18} /></button>
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

  const renderDocsModal = () => {
    if (!showDocs) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 bg-blue-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={22} />
              <h3 className="text-lg font-bold">Mais Projetos — Documentação Técnica</h3>
            </div>
            <button onClick={() => setShowDocs(false)} className="p-2 text-blue-100 hover:text-white hover:bg-blue-800 rounded-lg transition-colors"><X size={22}/></button>
          </div>
          <div className="overflow-y-auto p-6 space-y-4 text-sm text-slate-700">
            <h4 className="text-lg font-bold text-slate-800">Sistema de Controle de Projetos — Mais Escoramentos</h4>
            <p>Aplicação React 18 + Vite + TailwindCSS v4. Persistência em <strong>Firebase Firestore</strong>. Hosting no <strong>Firebase Hosting</strong>.</p>
            <h5 className="font-bold mt-3">Funcionalidades principais</h5>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cadastro e edição de projetos com 25+ campos.</li>
              <li>Status: Concluído, Em Andamento, Revisão.</li>
              <li>Tipos de pavimento: Pav. Tipo, 1º projeto, Pav. transição, Outro.</li>
              <li>Tipos de estrutura configuráveis com peso individual por tipo.</li>
              <li>Datetime de início/fim do projeto + duração manual (com sugestão automática).</li>
              <li>Altura da laje (cm), Pavimento (texto livre), Pé direito (m).</li>
              <li>Histórico geral com filtros (responsável, status, busca).</li>
              <li>Dashboard com filtros de período + análise por motivos de revisão.</li>
              <li>Exportação de projeto e dashboard em PDF (jsPDF).</li>
              <li>Modal de detalhes com todas as informações + botões de edição/exclusão.</li>
              <li>Controle de acessos: admin e projetista, com permissões diferenciadas.</li>
            </ul>
            <h5 className="font-bold mt-3">Schema do Projeto (Firestore)</h5>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto">{`{
  numeroContrato, projetista, cliente, tipo, status,
  dataInicio, dataFim, dataHoraInicio, dataHoraFim, duracao,
  area, peDireito, pavimento, peso, alturaLaje (string),
  tipoPavimento, projetoCliente,
  numeroRevisao, motivoRevisao, notas, criadoEm
}`}</pre>
            <h5 className="font-bold mt-3">Deploy</h5>
            <p>Comando: <code className="bg-slate-100 px-1 rounded">npm run build && firebase deploy --only hosting</code></p>
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
            <div className="bg-white p-1 rounded-lg flex items-center justify-center">
              <img src="/Logo Mais.jpg" alt="Mais Projetos Logo" className="h-9 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Mais Projetos</h1>
          </div>

          {currentUser && (
            <div className="flex items-center gap-3">
              <span className="text-blue-200 text-sm hidden sm:block">Olá, <strong className="text-white">{currentUser.nome}</strong></span>
              <button onClick={() => setShowDocs(true)} className="flex items-center gap-2 text-sm bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors border border-blue-700" title="Abrir documentação técnica do sistema">
                <BookOpen size={16} /><span className="hidden sm:inline">Documentação</span>
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