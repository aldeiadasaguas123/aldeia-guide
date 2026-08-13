# Como ativar as Avaliações (estrelas + comentários)

O site já está pronto pra mostrar e enviar avaliações — falta só ligar ele
numa planilha Google Sheets, que vai guardar tudo. Isso leva uns 10 minutos
e você só faz uma vez.

## Passo 1 — Criar a planilha

1. Vá em https://sheets.google.com e crie uma planilha nova.
2. Dê o nome que quiser, ex: "Avaliações Aldeia das Águas".

## Passo 2 — Colar o código do backend

1. Na planilha, vá em **Extensões → Apps Script**.
2. Apague o conteúdo que aparece por padrão (`function myFunction() {...}`).
3. Abra o arquivo `apps-script-avaliacoes.gs.txt` que te entreguei, copie
   TODO o conteúdo, e cole no editor do Apps Script.
4. Clique no ícone de disquete (💾 Salvar projeto).

## Passo 3 — Criar a aba e o cabeçalho automaticamente

1. No topo do editor do Apps Script, tem um menu suspenso de funções
   (ao lado do botão ▶ Executar). Selecione `criarCabecalho`.
2. Clique em ▶ **Executar**.
3. Na primeira vez, o Google vai pedir permissão — clique em
   "Revisar permissões", escolha sua conta, clique em "Avançado" e depois
   em "Acessar [nome do projeto] (não seguro)". Isso é normal: é o Google
   avisando que É VOCÊ MESMO quem está autorizando o próprio script a
   mexer na própria planilha.
4. Volte na planilha (aba do navegador) — agora deve existir uma aba
   chamada **avaliacoes** com o cabeçalho já pronto.

## Passo 4 — Publicar como Web App (pegar a URL)

1. No Apps Script, clique em **Implantar → Nova implantação**.
2. Em "Selecionar tipo", clique na engrenagem ⚙️ e escolha **App da Web**.
3. Configure assim:
   - Executar como: **Eu (seu e-mail)**
   - Quem pode acessar: **Qualquer pessoa**
4. Clique em **Implantar**.
5. Copie a **URL do app da Web** que aparece (algo como
   `https://script.google.com/macros/s/AKfycb.../exec`).

## Passo 5 — Colar a URL no site

1. Abra o arquivo `script.js`.
2. Procure a linha (perto do final do arquivo):
   ```js
   const AVALIACOES_URL = 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT';
   ```
3. Troque pelo link que você copiou no Passo 4, entre aspas. Exemplo:
   ```js
   const AVALIACOES_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
4. Salve o arquivo e recarregue o site.

Pronto — clique em qualquer atração, dê uma nota nas estrelas, escreva um
comentário e mande. Abra o mesmo link em outro celular/computador pra
confirmar que a avaliação aparece pra todo mundo (é assim que você sabe
que está gravando na planilha, e não só no seu navegador).

## Pontos importantes

- **Sempre que você editar o código do Apps Script depois**, precisa ir em
  Implantar → Gerenciar implantações → ✏️ editar → Nova versão → Implantar.
  Só salvar o código NÃO atualiza a versão publicada.
- **Sem cadastro/login**: cada navegador ganha um ID anônimo sozinho, só
  pra permitir editar a própria nota depois. A pessoa só clica nas
  estrelas e escreve, nada além disso.
- **Limite gratuito do Google**: contas pessoais gratuitas aguentam bem
  20.000 requisições/dia — de sobra pra um parque, mesmo em dia cheio.
  Se um dia isso virar gargalo, aí sim vale migrar pra Firebase (mais
  chato de configurar, mas sem esse teto).
- Os comentários aparecem na hora pra quem abre a atração depois do
  envio — não existe "demora" real de sincronização como no Windsor.ai
  (aquilo é outro tipo de conector, agregando dados de campanha).
- Toda avaliação some/aparece na planilha em tempo real — você pode abrir
  a planilha e ver os comentários chegando ao vivo, e também moderar
  (apagar linhas) manualmente se algum comentário for inadequado.
