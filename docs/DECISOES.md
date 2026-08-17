# Decisões de Arquitetura — Aldeia Guide

Registro vivo de decisões estruturais do projeto. Cada entrada existe para
que uma sessão futura (com ou sem IA) não precise redescobrir por que uma
escolha foi feita.

---

## Clustering do mapa — unidade de fusão por célula (Missões 03.1–03.10)

**Contexto:** o mapa tem ~64 atrações; em certas regiões, muitas ficam
próximas o suficiente para poluir visualmente o mapa no mobile. O
clustering agrupa essas atrações num marcador com a contagem, mantendo os
dados/pinos originais intocados (camada de apresentação, não de dados).

**Algoritmo:** grid-based (particionamento em células), não Union-Find por
distância. Um algoritmo anterior baseado em distância direta entre pares
(Union-Find) foi testado e **descartado** (Missões 03.3A/03.3B) por
apresentar efeito dominó/transitividade: uma única ponte entre dois pontos
podia unir a maior parte do mapa num único cluster gigante (chegou a
unir 60+ das 64 atrações). O grid-based elimina esse risco por
construção, porque a fusão nunca depende de uma cadeia de proximidade.

**Parâmetros atuais:**
- `TAMANHO_CELULA_CLUSTER_PX = 24` — tamanho da célula de grade.
- `LIMITE_REFINAMENTO_BORDA_CLUSTER_PX = 14` — limite do refinamento
  local de borda (ver abaixo).

### Refinamento local de borda (Missão 03.9)

O grid puro tem um artefato conhecido: duas atrações muito próximas
(ex.: 12px de distância real) podem cair em células vizinhas diferentes e
nunca se agrupar, só porque uma está de um lado da fronteira da célula e
a outra do outro lado. O refinamento corrige parte desse artefato:

1. **A unidade de fusão é a célula**, não o par de pontos individual que
   motivou a fusão. Quando duas células são fundidas, **todo o conteúdo
   das duas** vira um único grupo — não só o par que estava próximo.
2. Uma célula pode se fundir com **no máximo uma** célula vizinha
   (adjacência Chebyshev = 1) por passada de cálculo.
3. **Não há união-busca nem transitividade.** Não existe uma segunda
   rodada de fusões sobre grupos já fundidos — por construção, nenhum
   grupo final combina mais que **duas** células originais. Isso foi
   confirmado matematicamente na Missão 03.9 (nenhum grupo final combinou
   mais que 2 células, em nenhum cenário testado).
4. **Consequência aceita — "efeito passageiro":** como a fusão é por
   célula, atrações que dividem célula com o ponto que motivou a fusão
   entram no grupo mesmo que *elas próprias* estejam a mais de 14px da
   outra célula. Ex.: "🍔 Bar Central" (célula com "💳 Central de Crédito
   8") acaba no mesmo grupo de "🍔 Bar/Restaurante 3", mesmo estando a
   21,9px dele — porque Central de Crédito 8 está a só 8,8px de
   Bar/Restaurante 3, e a fusão arrasta a célula inteira.

### Por que a fusão por célula foi mantida (Missão 03.10)

Duas alternativas foram simuladas para eliminar o efeito passageiro:

- **Fusão por par de pontos** (só os dois pontos que motivaram a fusão se
  juntam, o resto de cada célula fica para trás): corrige os casos de
  passageiro, mas **piora o resultado principal do clustering** — no
  cenário crítico (mobile 390px, zoom 1.0, Todos), passa de 26 para 40
  elementos visuais na tela (pior até que sem nenhum refinamento, que
  tinha 36).
- **Híbrida** (célula decide *quando* fundir, cada ponto decide *se*
  entra, por um limite de inclusão): mesmo problema — no melhor caso
  testado, empata com "sem refinamento nenhum", sem ganho real.

Ambas as alternativas foram descartadas porque o "efeito passageiro" **é
o mecanismo que produz a maior parte do ganho** de descongestionamento
visual — não é um efeito colateral isolado de um bug. A fusão por célula
foi mantida porque apresentou, com folga, o melhor resultado de
descongestionamento no cenário crítico (26 elementos e 40 pares próximos
≤40px, contra 40+ elementos e 90+ pares nas alternativas).

**Decisão:** o efeito passageiro é tratado como **comportamento
intencional e aceito**, decorrente da escolha de fundir por célula — não
como bug nem como reincidência do efeito dominó (permanece
matematicamente limitado a 2 células por grupo, o que é fundamentalmente
diferente de uma cadeia sem limite).

### Casos de borda conhecidos (referência)

| Par | Distância real | Comportamento |
|---|---|---|
| Bar/Restaurante 8 ↔ Sorveteria | 12,4px | Agrupados — corrigido pelo refinamento (eram separados no grid puro) |
| **Bar Central ↔ Bar/Restaurante 3** | 21,9px | **Agrupados — efeito passageiro conhecido e aceito** (Bar Central entra por dividir célula com Central de Crédito 8, que está a 8,8px de Bar/Restaurante 3) |
| Bar/Restaurante 3 ↔ Bar/Restaurante 11 | 22,2px | Permanecem separados (não estão em células adjacentes que se fundiram) |

Se uma futura sessão encontrar um grupo que pareça "estranho" (uma
atração aparentemente distante das demais dentro do mesmo cluster), a
primeira suspeita deve ser o efeito passageiro descrito aqui — não
assumir que é um bug novo sem antes checar esta entrada.
