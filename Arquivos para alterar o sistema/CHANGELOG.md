Changelog - Mais Projetos

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

[2.6.5] - 2024-05-20

Fix (Correções)

Corrigido erro ReferenceError: renderLogin is not defined movendo todas as sub-renderizações para o escopo interno do componente App.

Corrigido erro Objects are not valid as a React child na seção de documentação (Docs), tratando corretamente a exibição de blocos de código e caracteres especiais.

Corrigida a navegação dos menus do portal de documentação que estavam inativos.

Changed (Alterações)

Restauração de Design: Reversão total do visual para o padrão original/limpo (fundo slate-100, header azul sólido, abas retangulares em container cinza).

Nomenclatura: Revertido "Dicionário Master" para "Tipos de Estrutura (Checkbox)" e "Equipe & Roles" para "Controle de Acessos" conforme solicitado.

UI: Remoção de sombras pesadas e fontes gigantes introduzidas em versões experimentais anteriores.

[2.6.0] - 2024-05-18

Added (Novas Funcionalidades)

Implementação de campos técnicos: Área (m²), PD (m), Pavimento (m) e Peso (kg).

Adicionado seletor de "Status Arquivo Cliente" (Atrasado, No Prazo, etc).

Implementada lógica de Justificativa Técnica obrigatória para o status de "Revisão".

Novo portal de documentação técnica (Docs) integrado ao sistema.

[2.5.0] - 2024-05-15

Added

Migração do estado local para persistência em tempo real via Google Firebase Firestore.

Sistema de login baseado em perfis técnicos pré-cadastrados.