# Musicoterapia

App de gestão clínica para atendimento de musicoterapia: cadastro de
pacientes, prontuários, registro de desempenho em atividades estruturadas,
envio para WhatsApp e Clínica Ágil, e exportação anonimizada dos dados.

Feito para ser usado principalmente **pelo celular**, como PWA instalado, e
para funcionar **offline** durante o atendimento.

## Como está organizado

```
app/                 rotas (Next.js App Router)
  (app)/             telas depois do login: hoje, pacientes, atividades,
                      atendimento, exportar, ajustes — todas atrás do PinGate
  login/              tela de entrada
components/          componentes de interface
lib/
  db/                 tipos, banco local (Dexie/IndexedDB), consultas
  sync/                motor de sincronização com o Supabase
  domain/              regras de negócio: desempenho, anonimização,
                        exportação, envio, texto do prontuário
  auth/                sessão (Supabase) e bloqueio por PIN
  supabase/            cliente do Supabase
supabase/migrations/  schema do banco (SQL) — rodar manualmente no Supabase
public/               manifest do PWA, ícones, service worker
```

Arquitetura resumida: cada tela lê e escreve no IndexedDB do aparelho
(`lib/db`), nunca diretamente no servidor. Um motor de sincronização
(`lib/sync/engine.ts`) leva essas mudanças ao Supabase quando há internet e
traz o que mudou lá. Por isso o app abre e registra atendimento mesmo sem
sinal — o que ficar pendente sincroniza sozinho depois.

## Colocando no ar (feito uma vez)

### 1. Banco de dados (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto,
   escolhendo a região **South America (São Paulo)**.
2. No projeto, abra **SQL Editor**, cole o conteúdo inteiro de
   `supabase/migrations/0001_init.sql` e execute.
3. Em **Project Settings → API**, copie a **Project URL** e a chave
   **anon public** — vão para a Vercel no passo 3.
4. Em **Authentication → Providers**, o login por e-mail/senha já vem
   ativado por padrão; não precisa mexer em nada.

### 2. Repositório (GitHub)

```bash
git init
git add -A
git commit -m "Versão inicial do app de musicoterapia"
```

Crie um repositório **privado** em github.com (dado clínico não deve ficar
público) e envie:

```bash
git remote add origin https://github.com/SEU_USUARIO/musicoterapia.git
git branch -M main
git push -u origin main
```

### 3. Publicação (Vercel)

1. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o
   repositório do GitHub.
2. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   (os valores copiados no passo 1.3)
3. Deploy. A cada `git push` na branch principal, a Vercel publica sozinha.

### 4. No celular

1. Abra o endereço da Vercel no navegador do celular.
2. Crie sua conta (tela de login → "Ainda não tenho conta").
3. Adicione à tela inicial: no Android, o navegador oferece "Instalar app";
   no iPhone, use Compartilhar → **Adicionar à Tela de Início** no Safari.
4. Na primeira abertura, o app pede para você criar um PIN de 4 dígitos.

## Rodando no computador (para desenvolver)

```bash
npm install
cp .env.local.example .env.local   # preencha com os dados do Supabase
npm run dev
```

Abre em `http://localhost:3000`.

```bash
npm run build      # build de produção (também roda o typecheck)
npm test           # testes das regras de negócio (cálculo de desempenho e anonimização)
npm run icons      # regenera os ícones do PWA em public/icons
```

## Conduzindo o projeto só pelo celular

Depois que os três passos acima estiverem feitos uma vez, qualquer alteração
no app pode ser pedida direto do celular, sem precisar deste computador:

1. Abra **claude.ai/code** no navegador do celular.
2. Conecte à conta do GitHub e escolha este repositório.
3. Converse normalmente — cada alteração aprovada vira commit no repositório,
   e a Vercel publica sozinha em cerca de um minuto.

## Notas coloridas (aba "Notas")

Cada nota tocada no teclado vira uma bolinha colorida na tela: tocar Dó três
vezes mostra três bolinhas vermelhas; Sol duas vezes, duas azuis. As cores
seguem o arco-íris: Dó vermelho, Ré laranja, Mi amarelo, Fá verde, Sol azul,
Lá roxo, Si rosa (sustenidos com tons intermediários).

Três jeitos de mandar as notas:

- **Teclado MIDI** (mais preciso): ligue o teclado pelo cabo USB (no celular,
  com adaptador OTG) e toque em "Ligar". Funciona no Chrome/Edge do
  computador e do Android. **Não funciona no iPhone** (o Safari não tem MIDI).
- **Microfone**: para teclado sem cabo ou no iPhone. Cada golpe de tecla vira
  uma bolinha, inclusive repetições rápidas da mesma nota (testado até
  ~12 notas por segundo). Toque uma nota de cada vez; se estiver contando notas a mais ou a menos, ajuste a
  "Sensibilidade". Funciona melhor em sala silenciosa e com o aparelho
  perto do teclado.
- **Teclado na tela**: para testar ou usar sem instrumento.

O botão de tela cheia amplia as bolinhas para mostrar ao paciente.
A lógica de cores e detecção de nota fica em `lib/domain/notes.ts`.

## Pontos que dependem de você

- **Clínica Ágil:** ainda não sabemos se o sistema deles tem API. Enquanto
  isso, o botão de envio copia o prontuário formatado e abre o site da
  clínica — você cola na evolução do paciente. Pergunte ao suporte deles se
  existe API/webhook ou importação por CSV; se houver, o envio pode virar
  automático (ver `lib/domain/delivery.ts`, função `sendToClinicaAgil`).
- **WhatsApp de grupo:** o WhatsApp não permite abrir um grupo específico já
  com texto pronto por link. Para paciente com grupo cadastrado, o app abre
  a lista de compartilhamento do celular e você escolhe o grupo (dois
  toques). Para contato individual, é um toque só.
- **Anonimização:** a troca do nome do paciente e responsáveis é automática.
  A varredura de outros nomes no texto livre é só uma sugestão — sempre
  revise a tela de confirmação antes de gerar o arquivo, e leia o arquivo
  gerado ao menos uma vez por completo antes de usá-lo.

## Segurança

- Todo dado fica protegido por Row Level Security no Postgres: cada
  terapeuta só enxerga as próprias linhas.
- O aparelho pede PIN a cada retomada depois de 2 minutos em segundo plano.
- Sair da conta apaga os dados guardados neste aparelho (o que já
  sincronizou continua seguro no servidor).
- Nada de dado de paciente é indexado por buscadores ou aparece em logs.
