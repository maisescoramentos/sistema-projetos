Contexto Técnico para Inteligência Artificial

Este documento serve como guia de memória para qualquer IA que venha a editar este projeto. Ele contém as diretrizes imutáveis de design e lógica.

🎨 Diretrizes de Design (CRÍTICO)

O design deste sistema foi rigorosamente restaurado para um padrão "Clean/Original" aprovado pela gestora. NÃO "modernize" ou altere as proporções sem solicitação expressa.

Cores: Fundo bg-slate-100, cabeçalho bg-blue-900 sólido.

Abas: Botões retangulares em container bg-slate-200. O botão ativo deve ser branco com sombra leve.

Componentes: Bordas rounded-xl em cartões brancos simples. Evite sombras exageradas ou gradientes complexos.

Nomenclaturas: Use sempre:

"Controle de Acessos" (não "Equipe & Roles").

"Tipos de Estrutura (Checkbox)" (não "Dicionário Master").

"Efetivar Master Log Operacional" nos botões de salvamento.

🧠 Lógicas de Negócio

Multi-insert (Batch): O formulário de criação mapeia o array formData.tipo e gera um documento individual no Firestore para cada tipo selecionado.

Máscara de Contrato: O campo código segue o padrão XXX/XXXX.

Regra de Revisão: Quando status === 'Revisão', o campo numRevisao deve ser formatado via padStart(2, '0') e o motivo é obrigatório.

Segurança: O sistema usa RBAC (Role Based Access Control). Funções como Dashboard e Configurações são exclusivas para usuários com role: 'admin'.

🛠️ Estrutura de Código

Todas as funções de renderização (renderDashboard, renderForm, renderConfig, etc.) DEVEM permanecer dentro do componente funcional App para evitar erros de escopo/referência (ReferenceError).

O sistema de documentação (Docs) utiliza um estado docSection para alternar conteúdos sem sair da página.

💾 Banco de Dados (Firestore)

Caminho: /artifacts/{appId}/public/data/projetos

Caminho: /artifacts/{appId}/public/data/usuarios

Caminho: /artifacts/{appId}/public/data/tiposEstrutura