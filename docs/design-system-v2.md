# PROMPT — Refazer o frontend do RLSGuard com a gramática do Supabase

**Uso:** guarda como `docs/design-system-v2.md`, **substitui** o `docs/design-system.md` anterior, e cola no Claude Code:
*"Lê o docs/design-system-v2.md. Substitui o sistema de design anterior por este. Mostra-me o plano de ficheiros a alterar antes de escreveres código."*

---

## 0. PORQUÊ ESTA MUDANÇA

O utilizador do RLSGuard vive no painel do Supabase. Vem de lá, volta para lá para colar o SQL, e regressa para verificar. Se as duas ferramentas tiverem gramáticas diferentes, ele paga um imposto de tradução mental a cada salto.

Por isso adotamos **a gramática de interação do Supabase** — a estrutura de navegação, a densidade, o comportamento dos componentes, os atalhos. É o que reduz o atrito.

**O que NÃO copiamos:** a marca. Nada de verde `#3ECF8E`, nada de logótipo parecido, nada que faça alguém pensar que isto é um produto oficial do Supabase. Isso é confusão de marca, cria risco legal, e destrói a razão pela qual te pagam — sermos uma auditoria **independente**. Familiar na mecânica, distinto na identidade.

---

## 1. O QUE MUDA E O QUE FICA

### Fica (não toques)
- A barra de severidade em blocos: `████` `███░` `██░░` `█░░░` `▓▓▓▓`. Continua a ser o elemento assinatura.
- O interruptor `PLAIN` / `TECHNICAL`.
- A voz da escrita: factual, sem desculpas, sem emoji, sem "Ups".
- O azul de sinal `#4C9EF5` como único acento.
- A escala de severidade e as suas cores.
- Timestamps ISO 8601 em modo técnico.

### Muda
- **Cantos:** deixam de ser 0. Passam a 4px em painéis e 6px em painéis grandes, como o Supabase. Controlos a 4px.
- **Navegação:** deixa de ser um rail único. Passa a rail de ícones + painel de navegação secundária, o padrão do Supabase.
- **Cabeçalho:** ganha breadcrumbs (`Organização / Projeto / Relatório`) e seletor de projeto em dropdown.
- **Modais:** substituídos por **side panels** (sheets que entram da direita), como o Supabase faz em quase tudo.
- **Tabelas:** cabeçalho colado ao topo, barra de filtros por cima, seleção múltipla com checkbox, ações em massa.
- **Command menu (`Cmd+K`):** obrigatório. É a coisa que mais falta a qualquer ferramenta deste tipo.
- **Toasts:** entram no canto inferior direito, como o Supabase.

---

## 2. TOKENS REVISTOS

```css
:root {
  /* Neutros mais quentes e menos azulados que a v1 — aproxima da densidade
     do painel Supabase sem copiar a paleta deles. */
  --bg:         #131619;   /* fundo da aplicação */
  --surface:    #181B1E;   /* painéis, cards */
  --surface-2:  #1E2225;   /* hover, linhas alternadas */
  --overlay:    #202529;   /* side panels, dropdowns, command menu */
  --border:     #2A2F34;
  --border-str: #3A4147;   /* bordas de controlos, foco em repouso */

  --fg:         #EDEDED;
  --fg-muted:   #8B949E;
  --fg-subtle:  #5C6570;

  --accent:     #4C9EF5;   /* NÃO verde. Independência de marca. */
  --accent-bg:  #16324D;

  --crit:       #E5484D;
  --high:       #F2761B;
  --med:        #D9A227;
  --low:        #64748B;
  --ok:         #2FA46A;

  --radius-sm:  4px;   /* botões, inputs, badges */
  --radius-md:  6px;   /* painéis, cards, side panel */
}
```

**Tipografia:** o Supabase usa uma sans neutra para UI e mono para SQL. Fazemos o mesmo, mas com as nossas faces:
- UI e prosa: **IBM Plex Sans**
- Dados, SQL, identificadores, timestamps: **IBM Plex Mono**
- **Martian Mono sai da UI.** Fica reservada ao logótipo e à landing page. Numa interface densa era ruído.

Escala base 13px (a UI do Supabase é densa; 14px fica folgado demais nas tabelas).

---

## 3. ESTRUTURA DE NAVEGAÇÃO

```
┌────┬──────────────┬────────────────────────────────────────────────┐
│ ▣  │ buildflow ▾  │  Projetos / buildflow-prod / Relatório     ⌘K  │
│ ── ├──────────────┼────────────────────────────────────────────────┤
│ ◫  │ RELATÓRIO    │  Achados │ Histórico │ Regras │ Definições     │
│ ⚑  │  Achados     ├────────────────────────────────────────────────┤
│ ⏱  │  Correções   │                                                │
│ ⚙  │              │  [ conteúdo ]                                  │
│    │ PROJETO      │                                                │
│    │  Credenciais │                                                │
│    │  Notificações│                                                │
│    │  Agendamento │                                                │
│ ── │              │                                                │
│ ⌾  │ ORGANIZAÇÃO  │                                                │
│    │  Faturação   │                                                │
│    │  Equipa      │                                                │
│    │  Chaves API  │                                                │
└────┴──────────────┴────────────────────────────────────────────────┘
  48px    220px
```

**Rail de ícones (48px):** Visão geral · Relatório · Alertas · Histórico · Definições · Documentação. Tooltip à direita no hover. Item ativo com fundo `--surface-2` e barra de 2px em `--accent` à esquerda.

**Painel secundário (220px):** agrupado por secções com cabeçalho em maiúsculas pequenas. Colapsável, estado guardado em `localStorage`.

**Cabeçalho (48px):** breadcrumbs à esquerda, seletor de projeto em dropdown, `⌘K` à direita, avatar. Colado ao topo.

**Tabs abaixo do cabeçalho:** navegação de segundo nível dentro do projeto. Sublinhado de 2px em `--accent` no ativo.

---

## 4. COMPONENTES A CONSTRUIR

Todos sobre **Radix UI** — é a base do próprio design system do Supabase, por isso o comportamento sai igual de graça.

```bash
npm i @radix-ui/react-dropdown-menu @radix-ui/react-dialog \
      @radix-ui/react-tooltip @radix-ui/react-tabs \
      @radix-ui/react-popover @radix-ui/react-select \
      @radix-ui/react-checkbox @radix-ui/react-scroll-area \
      cmdk sonner @tanstack/react-table
```

| Componente | Comportamento a replicar |
|---|---|
| `Sidebar` | Rail + painel, colapsável, estado persistido |
| `Breadcrumbs` | Cada nível clicável, último em `--fg` |
| `ProjectSwitcher` | Dropdown com pesquisa, score de cada projeto na linha, "+ ligar projeto" no fundo |
| `Tabs` | Sublinhado, navegação por teclado com setas |
| `DataTable` | TanStack Table. Cabeçalho sticky, larguras redimensionáveis, seleção múltipla, ações em massa numa barra que sobe do fundo quando há seleção |
| `FilterBar` | Chips de filtro que se acumulam (`severidade: crítico ×`), pesquisa à esquerda, ordenação à direita |
| `SidePanel` | Sheet de 480px que entra da direita. **Substitui todos os modais**, exceto confirmação de ação destrutiva |
| `CommandMenu` | `cmdk`. Ver secção 5 |
| `Toast` | `sonner`, canto inferior direito, 4s, com ação de desfazer quando aplicável |
| `CodeBlock` | Fundo `--surface`, borda, botão copiar no canto superior direito que aparece no hover, realce de sintaxe SQL |
| `Badge` | Pequeno, 4px de raio, para estados: aberto, resolvido, ignorado |
| `EmptyState` | Título, uma linha de explicação, um botão primário. Sem ilustração |
| `Skeleton` | Blocos em `--surface-2`, **sem brilho a varrer** |
| `InlineBanner` | Para a exposição confirmada. Borda esquerda de 3px, fundo `--surface` |

**Regra:** nada de `shadcn add` com o tema por defeito. Cada componente é retematizado com os tokens acima antes de entrar no repositório.

---

## 5. COMMAND MENU (`⌘K` / `Ctrl+K`)

É a peça que mais melhora a experiência e a que mais gente esquece. Grupos:

```
Ações
  Executar scan agora
  Verificar correções
  Copiar todo o SQL de correção
  Exportar relatório em PDF

Ir para
  Achados · Histórico · Credenciais · Notificações · Faturação

Projetos
  buildflow-prod        ██░░ 42
  softveil              ████ 88
  edugb-staging         ███░ 71

Achados            (pesquisa por regra, tabela ou recurso)
  ANON-001  public.profiles
  RLS-003   policy orders_all

Regras             (abre a página de documentação)
  RLS-003  WITH CHECK mais permissivo que USING
```

Pesquisa difusa. `Enter` executa, `⌘Enter` abre em separador novo. Fecha com `Esc`.

---

## 6. ATALHOS

Mantém os do relatório e acrescenta os que o Supabase treinou nas pessoas:

| Tecla | Ação |
|---|---|
| `⌘K` | Command menu |
| `j` / `k` | Mover entre achados |
| `Enter` | Abrir o achado no side panel |
| `c` | Copiar o SQL do achado |
| `i` | Marcar como intencional |
| `⌘Enter` | Executar scan |
| `/` | Focar a pesquisa |
| `?` | Overlay de atalhos |
| `Esc` | Fechar painel, menu ou overlay |

O overlay de `?` é obrigatório. Sem ele, ninguém descobre os outros.

---

## 7. O ACHADO PASSA A ABRIR EM SIDE PANEL

Mudança de fluxo mais importante desta versão. Em vez de expandir dentro da linha, clicar num achado abre um painel de 480px à direita:

```
┌──────────────────────────────────────────┐
│ ████ ANON-001                        ✕   │
│ public.profiles                          │
├──────────────────────────────────────────┤
│ Evidência │ Correção │ Histórico         │
├──────────────────────────────────────────┤
│                                          │
│  Qualquer pessoa na internet consegue    │
│  ler os emails e telefones dos teus      │
│  1.204 utilizadores registados.          │
│                                          │
│  ┌────────────────────────────────┐ ⧉    │
│  │ alter table public.profiles    │      │
│  │   enable row level security;   │      │
│  └────────────────────────────────┘      │
│                                          │
│  01  Cola no SQL Editor e executa        │
│  02  Confirma que a app continua a ler   │
│  03  Carrega em Verificar correção       │
│                                          │
├──────────────────────────────────────────┤
│ [ Copiar SQL ]  [ Verificar ]  [ ⋯ ]     │
└──────────────────────────────────────────┘
```

Vantagem sobre o acordeão: a lista mantém-se visível e o utilizador percorre achados com `j`/`k` **com o painel aberto**, que se atualiza. É como o Supabase faz na edição de linhas de tabela, e é muito mais rápido.

Rodapé do painel colado ao fundo, sempre visível, com as ações primárias.

---

## 8. MAPA DE ECRÃS

| Rota | Estrutura |
|---|---|
| `/app` | Grelha de cartões de projeto: nome, score, barra de severidade, último scan, botão scan |
| `/app/p/[ref]` | Redireciona para `/achados` |
| `/app/p/[ref]/achados` | Banner de exposição · resumo · filtros · DataTable · side panel |
| `/app/p/[ref]/historico` | Timeline de scans, diff entre dois scans, gráfico do score |
| `/app/p/[ref]/regras` | As 40 regras com estado por projeto: a passar, a falhar, ignorada |
| `/app/p/[ref]/definicoes` | Tabs: Credenciais · Notificações · Agendamento · Apagar projeto |
| `/app/org/faturacao` | Plano, uso, faturas |
| `/app/org/equipa` | Membros, convites, papéis |
| `/app/org/api` | Chaves, com revelação única na criação |

O ecrã `regras` é novo e vale a pena: mostrar **o que passou** é tão importante como mostrar o que falhou. É o que justifica a assinatura quando não há achados.

---

## 9. DENSIDADE

Isto é o que faz a UI do Supabase parecer profissional e é onde a maioria das cópias falha.

- Altura de linha de tabela: **36px**. Não 48, não 56.
- Padding de célula: `8px 12px`.
- Altura de botão: 30px (`sm`), 34px (`md`).
- Altura de input: 34px.
- Espaço entre secções: 24px. Dentro de secção: 12px.
- Texto base 13px, secundário 12px, labels 11px.
- Bordas sempre 1px, nunca 2px exceto no indicador de ativo.
- **Sem sombras** em elementos estáticos. Só o side panel, o dropdown e o command menu têm sombra, porque flutuam mesmo.

---

## 10. ESTADOS DE CARREGAMENTO

O Supabase mostra estrutura enquanto carrega, não spinners.

- Tabela a carregar: 8 linhas de skeleton com as mesmas alturas e larguras de coluna. Sem animação de brilho.
- Scan a correr: o log em stream continua igual à v1. É a única exceção, e é de propósito.
- Ação em curso num botão: o texto muda (`Executar scan` → `A executar…`) e o botão desativa. Sem spinner dentro do botão.
- Nunca um spinner a ocupar o ecrã inteiro.

---

## 11. GUARDA-CHUVA LEGAL

Escreve no rodapé de todas as páginas da aplicação e da landing:

> RLSGuard é um produto independente. Não é afiliado, patrocinado nem aprovado pela Supabase Inc. "Supabase" é marca registada da Supabase Inc.

E cumpre isto a sério:
- Sem verde da marca Supabase em lado nenhum
- Sem o logótipo deles fora do botão de OAuth, e aí no formato que a documentação deles autoriza
- Sem "Supabase" no nome do produto, no domínio, ou no nome da app OAuth
- A tipografia e a paleta são nossas

Familiaridade de mecânica é legítima e boa engenharia. Imitação de marca não é.

---

## 12. ORDEM DE EXECUÇÃO

1. Tokens novos em `globals.css` e no `tailwind.config`. Nada mais.
2. `Sidebar` + `Breadcrumbs` + `ProjectSwitcher` + `Tabs` — o esqueleto de navegação, com rotas vazias.
3. `DataTable` + `FilterBar` na rota de achados, com dados falsos.
4. `SidePanel` e migração do detalhe do achado para lá. Remove o acordeão.
5. `CommandMenu` e os atalhos, incluindo o overlay de `?`.
6. `Toast`, `Skeleton`, `EmptyState`, `Badge`, `CodeBlock`.
7. Ecrã `regras`.
8. Passagem final de densidade: mede as alturas contra a secção 9 e corrige.

Depois de cada passo, corre `npm run build` e mostra-me o resultado.

---

## 13. CRITÉRIOS DE ACEITAÇÃO

- [ ] Alguém que use o painel do Supabase todos os dias consegue navegar sem instruções
- [ ] `⌘K` abre em qualquer ecrã e encontra qualquer achado por nome de tabela
- [ ] Com o side panel aberto, `j`/`k` percorre achados e o painel acompanha
- [ ] Nenhum modal no produto, exceto confirmação de eliminação
- [ ] Nenhuma linha de tabela acima de 36px
- [ ] Nenhum spinner de ecrã inteiro
- [ ] Zero verde da marca Supabase no CSS; o aviso de independência está no rodapé
- [ ] A barra de severidade em blocos continua a ser o elemento visual mais reconhecível
- [ ] Tudo navegável só com teclado, com foco sempre visível
- [ ] Responsivo até 375px: rail vira gaveta, side panel vira ecrã completo
