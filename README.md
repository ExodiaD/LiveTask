<div align="center">

# ⚡ LiveTask

**Sistema Dinâmico de Gerenciamento de Inventário, Movimentações e Alertas**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://html.com/)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/Overview.en.html)
[![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

<br>

## 📌 Visão Geral

O **LiveTask** é uma aplicação estruturada para controle preciso de dados e emissão automatizada de alertas. A arquitetura divide-se entre uma API RESTful desenvolvida em TypeScript/Node.js (com Prisma ORM) e uma Interface de Usuário construída com HTML/CSS e Vanilla JavaScript, servida de forma estática pelo próprio backend.

---

## 🚀 Funcionalidades Principais

* **🔐 Autenticação Segura:** Proteção de rotas via JWT (JSON Web Tokens) através de middlewares customizados.
* **📊 Dashboard Integrado:** Agregação de métricas em tempo real para tomada de decisões.
* **📦 Controle de Catálogo:** Gerenciamento completo (CRUD) de Produtos e Categorias.
* **🔄 Rastreabilidade:** Registro contínuo de Movimentações (entradas/saídas).
* **⚠️ Motor de Alertas:** Serviço dedicado (`alertService`) que monitora anomalias ou necessidades do sistema e notifica a interface em tempo real via *WebSockets*.

---

## 🛠️ Stack Tecnológico

| Camada         | Tecnologias                                           |
|----------------|-------------------------------------------------------|
| **Backend**    | Node.js, Express.js, TypeScript                       |
| **Banco**      | SQLite (`dev.db`), Prisma ORM                         |
| **Frontend**   | HTML5, CSS3 (`styles.css`), Vanilla JS (`app.js`, etc)|

---

## 📂 Estrutura do Projeto

A organização de pastas segue um padrão modular para facilitar a manutenção e escalabilidade lógica:

```text
📦 LiveTask
 ┣ 📂 prisma           # Schema do banco (schema.prisma) e arquivo SQLite
 ┣ 📂 public           # Assets e arquivos estáticos da interface do usuário
 ┣ 📂 src
 ┃ ┣ 📂 middleware     # Interceptadores (ex: validação de token)
 ┃ ┣ 📂 routes         # Definição dos endpoints REST
 ┃ ┣ 📂 services       # Lógica de negócio isolada (ex: alertService.ts)
 ┃ ┣ 📜 seed.ts        # Script de população inicial do banco de dados
 ┃ ┗ 📜 server.ts      # Entry point: inicialização do servidor e roteamento
 ┣ 📜 package.json     # Gerenciamento de dependências
 ┗ 📜 tsconfig.json    # Regras e configurações do compilador TypeScript
```

---

## ⚙️ Configuração e Execução

### 1. Pré-requisitos
Certifique-se de ter o [Node.js](https://nodejs.org/) instalado em seu ambiente.

### 2. Passo a Passo

Clone o repositório e execute os comandos abaixo no terminal:

```bash
# 1. Instale as dependências do projeto
npm install

# 2. Sincronize o schema do Prisma com o banco SQLite local
npx prisma db push

# 3. (Opcional) Popule o banco com dados de teste iniciais
npx tsx src/seed.ts

# 4. Inicie o servidor
npm run dev
```

> **Acesso:** Após iniciar o servidor, acesse `http://localhost:3001` (ou a porta configurada) no navegador para utilizar o sistema. O front-end será servido automaticamente.

---

## 🌐 Arquitetura da API

A comunicação entre front-end e back-end ocorre através dos seguintes módulos de rotas:

- `POST /api/auth` — Validação de credenciais e emissão de tokens.
- `GET /api/dashboard` — Retorno de dados agregados para a tela inicial.
- `REST /api/products` — Gestão do catálogo de itens.
- `REST /api/categories` — Organização estrutural dos produtos.
- `REST /api/movements` — Fluxo e histórico de alterações de estado/estoque.
- `GET /api/alerts` — Recuperação dos avisos gerados pelo `alertService`.

<br>

<div align="center">
  <sub>Construído com ❤️ para produtividade.</sub>
</div>
