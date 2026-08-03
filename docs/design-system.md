# Basescope — Sistema de Design
### Direção visual, tokens, componentes e o que está proibido construir

**Uso:** guarda como `docs/design-system.md`. No Claude Code: *"Lê o docs/design-system.md. Toda a UI segue estes tokens. Se uma decisão visual não estiver aqui, pergunta-me antes de inventar."*

---

## 1. A TESE

Isto não é um dashboard. **É um documento forense.**

A diferença importa. Um dashboard existe para tranquilizar — mostra que tudo está sob controlo, com gráficos redondos e números grandes a verde. Um relatório forense existe para provar — mostra o que foi encontrado, onde, quando, e com que evidência. O utilizador do Basescope não vem sentir-se bem; vem saber se está exposto e o que colar no SQL Editor.

Tudo o que segue deriva daí. Se um elemento não ajuda a **localizar, provar ou corrigir**, corta-se.

### Referência de linguagem
O vocabulário visual vem das ferramentas reais deste mundo: o banner de arranque do `nmap`, a tabela de saída do `sqlmap`, um relatório de CVE, um `git diff`, a coluna de severidade CVSS. Não vem de dashboards SaaS.

### O erro a evitar
"Kali Linux" faz toda a gente saltar para preto puro com verde-ácido tipo Matrix. Isso é fantasia de filme, não é a Kali — a identidade real da Kali é **azul-ardósia frio**, não verde. E preto puro (#000) com neon é exatamente o aspeto que qualquer IA produz quando lhe pedem "hacker". Nós vamos para o lado do instrumento de medição: frio, azulado, denso, sem brilho. Um osciloscópio, não um ecrã de filme.

---

## 2. TOKENS

### Cor

```css
:root {
  /* Base — nunca preto puro. #0A0E14 tem azul suficiente para não achatar. */
  --void:      #0A0E14;   /* fundo da aplicação */
  --hull:      #10161F;   /* painéis, linhas alternadas */
  --hull-lift: #161E29;   /* hover, estado ativo */
  --rule:      #202B38;   /* fios de 1px — a estrutura toda vive aqui */
  --rule-lit:  #2E3E4F;   /* fio de secção ativa */

  /* Texto */
  --bone:      #DCE3EB;   /* primário */
  --graphite:  #7C8B9C;   /* secundário, labels, metadados */
  --slate:     #4C5A6B;   /* desativado, placeholders */

  /* Acento único — azul de sinal. SÓ para interação e foco. Nunca decorativo. */
  --signal:    #4C9EF5;
  --signal-dim:#1E3category; /* substituir por #1E3A5C */

  /* Severidade — convenção, não criatividade. Não invertas isto. */
  --sev-crit:  #E5484D;
  --sev-high:  #F2761B;
  --sev-med:   #D9A227;
  --sev-low:   #64748B;
  --sev-ok:    #2FA46A;   /* usado UMA vez: estado resolvido */
}
```

> Corrige `--signal-dim` para `#1E3A5C`. (Deixei o erro à vista de propósito: se o agente copiar isto sem reparar, sabes que não está a ler.)

**Regra de uso da cor:** o ecrã é 92% monocromático. A cor só aparece em três sítios — severidade, foco de teclado, e o estado "exposto confirmado". Se vires cor em mais lado nenhum, é decoração e sai.

### Tipografia

Três faces, três funções. Todas gratuitas e auto-hospedadas via `next/font/google`.

| Papel | Face | Onde |
|---|---|---|
| Display | **Martian Mono** | Score, cabeçalhos de secção, banner de scan. Largura e engenharia visível. Usar com contenção — no máximo 4 ocorrências por ecrã. |
| Dados | **IBM Plex Mono** | Tudo o que é identificador, SQL, nome de tabela, timestamp, ID de regra, evidência. |
| Prosa | **IBM Plex Sans** | Explicações em linguagem simples, marketing, textos legais. |

```ts
import { Martian_Mono, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
```

**Escala** — passo 1.25, ancorada em 14px porque isto é uma ferramenta densa, não uma landing page:

```
display-xl  40 / 44   Martian Mono 600, tracking -0.02em   (score)
display-l   22 / 28   Martian Mono 500, tracking -0.01em   (título de secção)
label       11 / 16   IBM Plex Mono 500, tracking 0.12em, UPPERCASE  (eyebrows, cabeçalhos de coluna)
data        13 / 20   IBM Plex Mono 400                    (células, IDs, código)
body        14 / 22   IBM Plex Sans 400                    (prosa)
body-sm     12 / 18   IBM Plex Sans 400                    (metadados, ajuda)
```

Nada acima de 40px em toda a aplicação. Números gigantes são linguagem de dashboard.

### Espaço, forma, movimento

```css
--space: 4px;              /* tudo é múltiplo de 4 */
--radius: 2px;             /* só em controlos interativos */
--radius-panel: 0;         /* painéis NUNCA têm cantos redondos */
--border: 1px solid var(--rule);
--focus: 0 0 0 1px var(--void), 0 0 0 3px var(--signal);
```

Sem sombras. Sem gradientes. Sem glassmorphism. Sem blur. A profundidade faz-se com o fio de 1px e com dois níveis de fundo, nada mais.

**Movimento:** 120ms `ease-out` em hover e estados. Uma única sequência orquestrada em toda a aplicação — o scan a correr (secção 5). Tudo o resto é instantâneo. `prefers-reduced-motion` corta a sequência do scan e mostra o resultado final direto.

---

## 3. O ELEMENTO ASSINATURA — a barra de severidade na goteira

Nada de pílulas coloridas com texto "CRITICAL" dentro. Em vez disso, cada achado tem na goteira esquerda uma barra de 4 blocos monospace:

```
████  CRITICAL
███░  HIGH
██░░  MEDIUM
█░░░  LOW
▓▓▓▓  RESOLVIDO   (mesma cor do texto secundário, riscado)
```

Porque funciona:
- Lê-se pela **forma** antes da cor — funciona em daltonismo, funciona impresso a preto e branco no PDF
- Alinha na grelha monospace, por isso uma lista de 40 achados forma uma coluna que se lê de relance
- É nativo do mundo do terminal sem ser cliché

Esta é a única liberdade estética do produto. Todo o resto é contido. Não acrescentes um segundo elemento memorável.

---

## 4. LAYOUT

### Estrutura da aplicação

```
┌──────────────┬──────────────────────────────────────────────────────┐
│ RLSGUARD     │ buildflow-prod              PLAIN ▸ TECHNICAL   ⟳ 2m │
│ ──────────── ├──────────────────────────────────────────────────────┤
│ PROJETOS     │                                                      │
│ ● buildflow  │   SCORE      ACHADOS EM ABERTO        ÚLTIMO SCAN    │
│   ██░░  42   │   ┌───┐                                              │
│ ○ softveil   │   │42 │      ████ 3   ███░ 5   ██░░ 8   █░░░ 2       │
│   ████  88   │   └───┘      −16 desde 2026-07-27      há 2 minutos  │
│ ○ edugb      │                                                      │
│   ███░  71   │ ──────────────────────────────────────────────────── │
│              │                                                      │
│ + ligar      │ ████ ANON-001    public.profiles          ABERTO     │
│ ──────────── │      1.204 linhas legíveis por anónimo               │
│ Definições   │      email, phone, address                            │
│ Faturação    │                                          [ ver ] [ ✓ ]│
│ Chaves API   │ ──────────────────────────────────────────────────── │
│              │ ████ RLS-003     policy orders_all        ABERTO     │
│              │      WITH CHECK (true) com USING restritivo          │
└──────────────┴──────────────────────────────────────────────────────┘
```

- Rail esquerdo **240px fixo**, com o score de cada projeto em barra + número. Ver os três projetos e os três estados sem clicar é metade do valor do produto.
- Sem cards. As secções separam-se por fios de 1px que vão de **bordo a bordo**, sem margens laterais. Isto é o que faz parecer um instrumento e não um site.
- Linha do achado: goteira de severidade (48px) · ID da regra (88px) · recurso (flex) · estado (96px) · ações. Todas as colunas alinhadas na grelha monospace. **Nunca centres nada.**
- Máximo de conteúdo: 1440px. Acima disso, o rail cresce e a área de relatório mantém-se.

### O interruptor PLAIN / TECHNICAL

No cabeçalho, sempre visível, persistido por utilizador. Resolve a tensão central do produto — o mesmo relatório serve um fundador que não sabe SQL e um dev que quer o `pg_policies` cru.

```
PLAIN:      "Qualquer pessoa na internet consegue ler os emails e
             telefones dos teus 1.204 utilizadores registados."

TECHNICAL:  anon SELECT public.profiles → 200, Content-Range 0-0/1204
            relrowsecurity = false · pii: email, phone, address
```

O `PLAIN` é o predefinido. Um fundador assustado às 2 da manhã não quer decifrar `Content-Range`.

---

## 5. A SEQUÊNCIA DO SCAN

O momento do produto. 15–40 segundos em que o utilizador não pode ficar a olhar para um spinner.

Renderiza saída em stream, estilo ferramenta de linha de comandos, em Plex Mono, com as linhas a aparecer via Supabase Realtime à medida que cada regra termina:

```
Basescope 1.0 · scan iniciado 2026-08-03T14:22:07Z
alvo: hxjsfwkjqskcjedhlgmv.supabase.co · autorizado por mampassar@… · verificação: oauth

[ok]   catálogo lido                    41 tabelas, 78 políticas, 12 funções
[ok]   RLS-001  row level security      3 tabelas sem RLS
[ok]   RLS-002  políticas abertas       limpo
[warn] RLS-003  divergência de escrita   1 política
[ok]   FN-001   search_path              2 funções
[ok]   GRANT-001 privilégios de schema   limpo
[..]   ANON-001 sonda de acesso anónimo  18/41 ▓▓▓▓▓▓▓▓░░░░░░░
```

Regras:
- Ordena as regras **rápidas primeiro** (secção de ordem de execução do spec). O utilizador vê resultados aos 2 segundos, não aos 30.
- `[ok]` em `--graphite`, `[warn]` em `--sev-med`, `[!!]` em `--sev-crit`. Nada mais colorido.
- No fim, a saída **colapsa** para uma linha de 24px — `scan concluído · 18 achados · 31.4s` — clicável para reabrir. Não deites fora o log; é a prova.
- Se `prefers-reduced-motion`, salta o stream e mostra o log completo de uma vez.

Isto é a única animação orquestrada da aplicação. Não acrescentes mais nenhuma.

---

## 6. ESTADOS QUE PRECISAM DE TRATAMENTO PRÓPRIO

### Exposição confirmada
Quando a ANON-001 devolve `count > 0` numa tabela com PII, isto não pode parecer mais um item de lista. Barra de 3px a `--sev-crit` na margem esquerda de todo o painel do relatório, e uma linha fixa no topo:

```
EXPOSIÇÃO CONFIRMADA · 1.204 registos com dados pessoais legíveis sem autenticação
Corrige agora →                                        Copiar SQL de correção
```

Sem ícone de aviso triangular. Sem emoji. Sem fundo vermelho a piscar. A frase é que assusta — e assustar aqui é correto e honesto.

### Tudo limpo
```
                              ████
                              ████

                     Sem achados em aberto.

              Último scan há 6 horas · 41 tabelas verificadas
              Próximo scan automático às 03:00 UTC
```
O quadrado é o mesmo glifo da barra de severidade, em `--sev-ok`. Sem confetes, sem "Parabéns!". A recompensa é o silêncio.

### Estado vazio (zero projetos)
```
Nenhum projeto ligado.

Liga o teu projeto Supabase e recebes o primeiro relatório
em menos de dois minutos.

[ Ligar com Supabase ]     ou introduzir credenciais manualmente
```
Convite a agir, sem ilustração. Ilustrações de estado vazio são a marca da UI genérica.

### Erro
```
[!!]  Ligação recusada

      A chave service_role foi rejeitada pelo projeto hxjs…lgmv.
      Provavelmente foi rodada desde que a ligaste.

      [ Atualizar credenciais ]
```
O erro diz o que aconteceu, o que provavelmente o causou, e dá o botão que o resolve. Nunca "Algo correu mal". Nunca pede desculpa.

---

## 7. ESCRITA

Voz: **um engenheiro competente a dar-te um facto.** Nem vendedor, nem professor, nem assistente simpático.

| Não escrevas | Escreve |
|---|---|
| "Ups! Encontrámos alguns problemas 😬" | "18 achados. 3 críticos." |
| "Parabéns, o teu projeto está seguro!" | "Sem achados em aberto." |
| "Otimiza a tua postura de segurança" | "Ativa RLS em 3 tabelas." |
| "Submeter" | "Executar scan" |
| "Este é um problema potencialmente sério" | "Qualquer pessoa consegue ler esta tabela." |
| "Estamos a processar o seu pedido…" | "A ler catálogo… 41 tabelas" |

Datas e horas: sempre ISO 8601 em UTC no modo `TECHNICAL` (`2026-08-03T14:22:07Z`), relativo no modo `PLAIN` ("há 2 minutos"). Nunca `03/08/2026` — ambíguo entre continentes.

Números: separador de milhares sempre (`1.204`, não `1204`). Durações com uma casa decimal (`31.4s`). Contagens exatas, nunca "vários" ou "alguns".

O botão diz o que faz e o resultado usa a mesma palavra: `Executar scan` → `Scan concluído`. `Ignorar achado` → `Achado ignorado`.

---

## 8. LANDING PAGE

O herói não é uma headline com gradiente. **É o relatório.**

Mostra um relatório real anonimizado, a tamanho normal, a correr a sequência de scan em loop, com a linha de EXPOSIÇÃO CONFIRMADA a aparecer aos 4 segundos. Por baixo, uma linha:

```
Isto é um projeto real. Levou 31 segundos.
```

Só depois é que aparece o campo de entrada. Ninguém precisa que lhe expliquem o produto se o vir a funcionar.

Secção obrigatória, com o mesmo peso visual do preçário:

```
O QUE NÃO FAZEMOS

Não lemos os teus dados.       Usamos pedidos HEAD. A resposta
                               não tem corpo. Contamos linhas,
                               nunca as vemos.

Não varremos sites alheios.    Só analisamos projetos cuja
                               propriedade foi verificada.

Não guardamos linhas.          A evidência são nomes de tabelas,
                               colunas e contagens. Nada mais.
```

Isto é a objeção número um em todas as conversas de venda. Trata-a como funcionalidade, não como rodapé legal.

---

## 9. PROIBIDO CONSTRUIR

Lista fechada. Se o agente propuser algo daqui, rejeita.

- Cards com `border-radius` acima de 2px, sombra, ou fundo em gradiente
- Gráficos de donut, de barras 3D, ou medidores em semicírculo para o score
- Emoji em qualquer parte da interface do produto
- Ícones de aviso triangulares, cadeados, escudos — o vocabulário visual de segurança de stock
- Verde-ácido (#00FF41 e vizinhos), efeitos de chuva Matrix, cursor a piscar decorativo, ruído de CRT
- Skeleton loaders com brilho a varrer
- Toasts que aparecem no canto e desaparecem sozinhos com informação importante
- "Ups", "Oops", desculpas em mensagens de erro
- Ilustrações de estado vazio
- Modais para tudo — usa navegação e painéis laterais; um modal só para confirmar destruição
- Tailwind puro sem tokens. Todas as cores e espaços saem das variáveis CSS acima, mapeadas em `tailwind.config`
- Componentes shadcn com o tema por defeito. Retema `button`, `input`, `table`, `dialog` antes de os usares.

---

## 10. PISO DE QUALIDADE

- Contraste mínimo 4.5:1 em texto, 3:1 em fios e bordas de controlos. Verifica `--graphite` sobre `--void`: passa a 4.9:1. `--slate` só para desativado.
- Foco de teclado visível em tudo, com o anel de duas camadas definido em `--focus`. Nunca `outline: none`.
- Navegação por teclado no relatório: `j`/`k` entre achados, `Enter` expande, `c` copia o SQL, `/` foca a pesquisa. Documenta com `?`. O teu público sabe usar isto.
- Responsivo até 375px: o rail vira gaveta, a tabela de achados vira lista empilhada mantendo a barra de severidade.
- Tudo funciona sem JavaScript até ao ponto de login (landing, docs, legal são estáticos).
- Modo claro: **não construas na v1.** Um relatório forense vive em escuro. Se um cliente empresarial exigir, faz o tema do PDF em claro e mantém a aplicação escura.
