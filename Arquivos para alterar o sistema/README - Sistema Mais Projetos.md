Mais Projetos - Engineering Control System

O Mais Projetos é um sistema de gestão operacional desenvolvido em React para centralizar e monitorar o fluxo de projetos de engenharia. O foco principal é a mensuração de produtividade técnica (m² e kg) e o controle rigoroso de revisões e prazos.

🚀 Funcionalidades Principais

Lançamento em Lote: Permite registrar múltiplas frentes de trabalho (escoramento, forma, travamento, etc.) vinculadas a um único contrato de uma só vez.

Métricas de Engenharia: Campos específicos para Área (m²), Pé Direito (PD), Pavimento e Peso (kg).

Gestão de Revisões: Sistema inteligente que exige justificativa técnica e gera numeração incremental automática para projetos em revisão.

Dashboard Gerencial: Visão consolidada para a gestão (Fernanda), com filtros de período e indicadores de performance por projetista.

Fila de Trabalho Individual: Cada projetista (Samuell, Vinicius, Victor, Valéria) visualiza apenas suas tarefas pendentes.

Portal de Docs: Manual técnico integrado para desenvolvedores e administradores.

🛠️ Stack Tecnológica

Frontend: React.js

Estilização: Tailwind CSS

Ícones: Lucide React

Backend/Database: Firebase Firestore (NoSQL)

Autenticação: Firebase Auth (Anônima/Custom)

📁 Estrutura do Projeto

O projeto segue a arquitetura de Arquivo Único (Single-file Mandate) para facilitar o deploy e a portabilidade dentro do ambiente de prototipagem:

App.jsx: Contém toda a lógica de estado, rotas internas, componentes de UI e integração Firebase.

🔧 Configuração e Deploy

Instale as dependências: npm install lucide-react firebase

Configure o arquivo firebaseConfig com as chaves do seu projeto.

Deploy recomendado: Vercel ou Firebase Hosting.

© 2024 Mais Projetos Engenharia Operacional.

