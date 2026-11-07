# Auditoria técnica e funcional — INVEST PI | ASG Intelligence

Data: 07/11/2026 (America/Fortaleza). Projeto existente: `rhuandmartises-glitch/Investpi.icev`. Base anterior: commit `944422edfee26687856f1f25b40d1d5599c4ff24`. Backup: branch `backup/pre-auditoria-20261107`.

## Escopo e evidência

Foram examinados o JavaScript/CSS/HTML existentes, as 11 páginas, os arquivos de autenticação real e simulada, a publicação do GitHub Pages, o modelo original XLSX, as abas auxiliares e o projeto PostgreSQL/Supabase existente. Não foi criado outro sistema ou trocada a identidade visual.

Fonte: `Painel_ASG_Compliance_Integridade_Completo.xlsx`, SHA-256 `24aae656e8d71f017d2d1463a51a126f90049f485465e2e00cfbddad4ad868cc`. Os valores normalizados publicados foram comparados com todas as abas do arquivo e não apresentaram divergências. O arquivo original e `dist/demo-data.json` foram preservados, sem substituir registros para ocultar defeitos. A fonte já era explicitamente fictícia.

A base atual possui uma organização principal e 72 indicadores corporativos; 24 contratos/fornecedores com nomes distintos; 12 investidores; 25 casos de denúncias; 12 riscos; 12 temas de materialidade. Não há município, CNPJ/cadastro mestre da empresa, nota individual E/S/G por fornecedor ou série anterior equivalente por fornecedor. `CT-*` é identificador do contrato. Não é feita associação aproximada de nomes.

A demonstração pública continua usando o simulador, sem conectar-se ao Supabase institucional. O banco foi auditado diretamente, em separado. A proteção do banco não transforma o login simulado em uma proteção para dados reais.

## A. Problemas encontrados

| ID | Problema e local | Causa | Impacto |
|---|---|---|---|
| A01 | Recortes divergentes entre dashboard, geografia, diagnóstico, materialidade e extratos | Regras de seleção repetidas; algumas páginas ignoravam dimensão, período ou entidade | Informações fora do recorte e zeros enganosos |
| A02 | Trocar empresa apagava setor, UF e dimensão | Handler reiniciava filtros dependentes | Perda silenciosa de critérios ativos |
| A03 | Opções de setor e UF incompatíveis com a empresa selecionada | Opções geradas a partir da base inteira | Combinações sem correspondência sem explicação suficiente |
| A04 | Indicador específico não tinha filtro global | Busca restrita ao catálogo e seletor histórico isolado | Dificuldade de manter o mesmo indicador entre páginas |
| A05 | Busca era apagada ao navegar para o extrato | Navegação limpava `search` | Exportação de registros que não estavam na busca |
| A06 | Perfil do fornecedor criava notas E/S/G | Regra própria Sim=100/Não=20 sem identificação metodológica na planilha | Diagnóstico individual sem respaldo na fonte |
| A07 | Ranking e cálculo de crescimento permaneciam no projeto | Requisito anterior, substituído pela instrução atual | Uso competitivo das pontuações |
| A08 | Pontos por status eram constantes no código | 100/60/20 fixos, sem ler Parâmetros | Divergência após alterar a metodologia da planilha |
| A09 | Comparativo antigo usava metas/pesos atuais e linha de tendência | Ausência de metadados de equivalência temporal e de metas históricas | Evolução/pontuação histórica potencialmente enganosa |
| A10 | Excel exportava os dois períodos mesmo com um selecionado | Planilha de exportação montada independentemente do extrato | Vazamento de valores fora da seleção |
| A11 | “Gerar PDF” somente chamava impressão | Não havia geração de arquivo PDF | Interface não entregava download de PDF |
| A12 | CSV dependia da inferência automática de tipos e perdia AA no modelo de 24 colunas | Parser genérico e substituição do catálogo | Números ambíguos e classificação perdida |
| A13 | Importação validava parcialmente tipos, datas, referências e abas auxiliares | Validação concentrada em IDs do catálogo/contratos | Possibilidade de base inconsistente |
| A14 | Cache duplicado podia falhar depois de gravar no servidor | Dados salvos novamente em `asg-state` e versões locais | Mensagem de erro apesar de gravação; estado da tela divergente |
| A15 | Confirmação concorrente e arquivo escolhido durante leitura | Ausência de bloqueio/token de seleção | Prévia antiga ou dupla confirmação |
| A16 | Versões confundiam data de importação e data-base | Timestamp inicial demonstrativo usava a data de observação | Histórico de atualização incorreto |
| A17 | Histórico não oferecia recuperação nem seleção de retrato para o painel | Consulta limitada a valores antigos do catálogo | Histórico incompleto funcionalmente |
| A18 | Parâmetros dependiam de posições fixas de linhas | Índices numéricos das linhas do XLSX | Reordenação de parâmetros mudava resultados |
| A19 | Cálculo trimestral dependia do fuso do navegador | `getMonth/getFullYear` sobre data ISO UTC | Reunião atribuída ao trimestre errado na virada do mês |
| A20 | Ausências em algumas somas/score ponderado podiam entrar como zero | Coerção numérica/falta de cobertura | Indicadores subestimados por dados ausentes |
| A21 | Banco verificava apenas payload como objeto JSON | Ausência de validação de domínio e ligações internas | Cliente privilegiado podia gravar payload incoerente |
| A22 | Autoria não tinha FK e data de importação podia ser enviada pelo cliente | Metadados insuficientemente protegidos | Histórico/auditoria falsificável pelo importador |
| A23 | Cliente institucional consultava todo o histórico sem paginação | Limite padrão da API | Corte silencioso quando o histórico crescesse |
| A24 | Falha de autenticação/logout podia manter dados em componentes/memória do painel | Bloqueio apenas visual e carregamento iniciado uma vez | Estado privado residual ou painel antigo após novo login |
| A25 | Cabeçalhos vindos da planilha não eram escapados e agrupamento usava objeto comum | Interpolação de HTML e chaves como propriedades de objeto | Risco de injeção de marcação/contagens incorretas |
| A26 | Sem limite de expansão ZIP ou do tamanho lógico da planilha | Limite do arquivo comprimido era insuficiente | Arquivo pequeno podia exigir processamento excessivo |
| A27 | Pesos locais podiam atravessar versões e valores em branco viravam zero | Cache sem identificação da versão; `Number('')` | Pontuação de outro retrato alterada indevidamente |
| A28 | Composição setorial mostrava somente sete categorias sem explicitar corte | `slice(0,7)` | Total visual diferente da base filtrada |

## B. Correções executadas

| IDs | Implementação | Componentes |
|---|---|---|
| A01–A05 | Regras compartilhadas em `asg-core.js`; filtros por identificador, opções dependentes, seleção global do indicador e busca mantida ao navegar. Busca/indicador corporativo não atribuem dados a fornecedores. Cidade é explicitamente indisponível; recortes sem relação real mostram motivo | Todas as páginas, controles e extratos |
| A06–A09 | Removidas as notas inventadas e o ranking. Diagnóstico mantém somente scores/classificações da fonte. Pontos por status vêm de Parâmetros. Comparativo sem equivalência é mostrado com aviso, sem curva/crescimento ou score histórico com metas atuais | Perfis, inteligência, diagnóstico e histórico |
| A10–A11 | `extractData()` é a projeção compartilhada por tela, Excel e PDF. Excel exporta apenas o período selecionado. PDF tem arquivo próprio, paginação e filtros; impressão foi preservada separadamente | Relatórios/exportações; pdf-lib local e com versão fixa |
| A12–A15 | Parser CSV com regras explícitas; AA preservada por ID no modelo de 24 colunas. Prévia validada, recálculo conhecido, bloqueio de confirmação, token de leitura e gravação antes de trocar a base. Removido o cache redundante | Importação, armazenamento e versões |
| A16–A17 | Separadas datas de importação e observação; data inicial desconhecida fica não informada. Reimportações da mesma data são versões. Recuperação anexa snapshot. Filtro de período permite escolher retratos anteriores disponíveis | Histórico, gestão e filtros |
| A18–A20 | Parâmetros por chave; datas UTC; fórmulas A/B e ligações auxiliares conferidas; ausência/denominador zero não viram pontuação zero. Score ponderado do fornecedor exclui observações sem score do denominador | Recálculo, classificação e pontuação |
| A21–A22 | Migrações 002–006 aplicadas no banco existente: tipos, IDs, referências, A/B, status, pontos, abas auxiliares, parâmetros, orçamento JSON, FK de autoria e timestamp no servidor. Snapshots continuam sem UPDATE/DELETE para clientes | PostgreSQL/RLS |
| A23–A24 | Paginação; proteção contra entradas simultâneas e sessão invalidada durante carregamento; revisão de perfil após refresh; bloqueio limpa DOM, contexto e referências do painel; novo login evita reutilizar dados do anterior | Auth institucional; fluxo simulado também testado |
| A25–A28 | Escape de cabeçalhos; Map para agrupamentos; limites de arquivo/ZIP/células/abas; pesos locais vinculados ao retrato e sem valores em branco; todas as categorias setoriais passam a aparecer | Tabelas, gráficos, importação e controles |

As alterações de layout limitaram-se a quebra de cabeçalho no celular, largura dos controles e impressão. A arquitetura HTML/JS, identidade visual, biblioteca XLSX, integração Supabase e hospedagem foram preservadas.

Os vínculos implementados foram comparados com as fórmulas H/J do XLSX. `Plano_Ação` não foi artificialmente associado a indicadores sem uma chave/fórmula de origem. A categorização ASG segue AA; não foi reclassificada apenas pela aparência do nome do indicador.

## C. Testes executados e resultados

| Funcionalidade | Cenário | Esperado | Obtido | Situação |
|---|---|---|---|---|
| Fórmulas | Recalcular os 72 indicadores da planilha original | Mesmos resultados, tolerância relativa 1e-9 | Zero divergências | Aprovado |
| Conferência independente SQL | Base protegida atual | 72 indicadores; 24 contratos; soma R$ 350.765 mil; índice 60,487804878 | Mesmos valores no SQL e no painel (arredondamento visual 60,5) | Aprovado |
| Filtros de fornecedores | 16.200 combinações empresa/setor/UF/período/dimensão | Mesmos IDs de consulta independente | Nenhuma divergência | Aprovado |
| Filtros de indicadores | Empresa, indicador, dimensão e período | Somente registros compatíveis; sem atribuição ao fornecedor | Casos válidos e vazios corretos | Aprovado |
| Cidade | Aplicação interna de cidade sem informação na fonte | Sem observações; não fabricar localização | Controle indisponível com explicação | Aprovado no tratamento de ausência |
| Fonte e classificação | Coluna AA e linhas de origem | 3 E, 3 S, 66 G; rastreabilidade correta | Correspondência exata com a origem | Aprovado tecnicamente |
| Pontuação | Limites exatos, polaridades, pesos zero/ausentes, parâmetros alterados | Regra da fonte; ausência não calculável | Valores esperados | Aprovado |
| Navegação | As 11 páginas em recortes coletivos, individuais e vazios | Renderizar estado coerente | Sem exceções nas funções exercitadas | Aprovado |
| Interseções | Três variáveis contratuais e múltiplos indicadores corporativos | Mesma população/unidades; Pearson só com amostra e variância | 24 pares na visão completa; ausência explicada nos demais casos | Aprovado |
| Correlação | Relação positiva/negativa, variância zero, pares ausentes e menos de três pares | R=1/-1 nos controles; demais não calculáveis | Resultados esperados; aviso de não causalidade | Aprovado |
| Gráficos | Dispersão e materialidade com filtros | Mesmos registros da tabela, unidades e detalhes corretos | 24 pontos de fornecedores; 12 temas; recortes incompatíveis sem gráfico | Aprovado |
| Comparativo | Dois valores sem abrangência equivalente confirmada | Sem curva temporal, taxa de crescimento ou score com metas atuais | Bloqueio metodológico explícito | Aprovado no tratamento da limitação |
| XLSX | Importar o arquivo original na interface | Prévia com 72 indicadores/24 contratos e zero diferenças | Resultado observado e confirmado | Aprovado |
| CSV | Cabeçalho, decimal, fórmulas, 24/27 colunas | Conversão explícita; fórmulas/estrutura inválidas bloqueadas | Cenários automatizados passaram | Aprovado |
| Integridade | IDs duplicados/malformados, datas impossíveis, texto numérico, score infinito, órfãos, limites e classes divergentes | Bloquear sem tocar na base anterior | Rejeição com motivo | Aprovado |
| Importação atômica | Cancelar, confirmar, simular falha de persistência/quota e restringir perfil | Nenhuma troca parcial; viewer não importa | Base e histórico preservados | Aprovado |
| Segurança de arquivo | ZIP falso/expansão excessiva, arquivo grande e extensão errada | Rejeitar antes de substituir a base | Bloqueio validado | Aprovado |
| Histórico | Mesmo período, ordem cronológica, seleção de snapshot e recuperação | Não simular crescimento; selecionar dados efetivos; recuperação append-only | Cenários esperados | Aprovado com fixtures de teste |
| Datas | Data ISO na virada do trimestre com fuso Fortaleza | Trimestre UTC correto | Resultado esperado | Aprovado |
| Excel exportado | Visão coletiva, fornecedor, dimensão e comparativo | Mesmos IDs/valores da projeção da tela; sem outro período | Arquivos reabertos e verificados | Aprovado |
| Download Excel no navegador | IND-29 selecionado | Uma linha de indicador, sem fornecedor não vinculado | Download com IND-29 e valor 0,708333… | Aprovado |
| PDF | Coletivo, fornecedor, indicador e comparativo | Mesmos registros do recorte, PDF válido | 7/1/1/6 páginas; 72/0/1/72 indicadores; 24/1/0/0 fornecedores | Aprovado |
| Download PDF no navegador | IND-29 selecionado | IND-29, 70,8%, sem IND-07 | Texto do arquivo baixado conferido; renderização inspecionada | Aprovado |
| Pesos na interface | Alterar peso de IND-29 para zero e restaurar para dois | Recálculo e restauração corretos | Observado no navegador | Aprovado |
| Login/cadastro simulado | Domínio, senha mínima, erro, conta válida, cadastro e recuperação | Fluxo local, sem e-mail real; armazenamento sem senha em texto | Testes de integração passaram | Aprovado como simulação |
| Auth institucional no front-end | Serviço simulado com perfil ativo/inativo, viewer e logout | Bloqueio/limpeza/permite consulta apenas quando autorizado | Testes passaram | Aprovado apenas no serviço simulado |
| Auth/RLS no banco real | Anon, admin, viewer, inativo, não confirmado e sessão revogada | Somente acesso compatível com a política | SQL real passou com ROLLBACK | Aprovado no banco |
| Integridade no banco | Payload inválido, data-base divergente, duplicado, A/B com vínculo auxiliar falso, tentativa de alterar/excluir/promover perfil | Bloqueio pelo servidor | Todas as tentativas rejeitadas | Aprovado no banco |
| Preservação | Conferir estado após testes transacionais | Um snapshot original; nenhum usuário/sessão de teste permanente | 1 snapshot, 0 usuários, 0 sessões | Aprovado |
| Desempenho | Matriz de filtros da base atual; consultas paginadas; PDF sob demanda | Sem requisição de banco no demo; limites explícitos | Suítes locais completas em poucos segundos | Aprovado na base atual; sem ensaio de carga |
| Responsividade | CSS responsivo e navegação no navegador disponível | Sem corte de controles; cabeçalho pode quebrar | Correção aplicada; desktop conferido | Celular real pendente |

Resultado automatizado: **40 grupos em `tests/audit.cjs`, sem falhas**, incluindo a matriz de 16.200 combinações e uma matriz adicional de indicador/dimensão/período. Também passaram as suítes de importação, autenticação, PDF e verificações estáticas. O registro individual está em `audit/test-results.json`.

Os testes de datas adicionais, quota e falhas usam fixtures/mocks de teste. Não foram adicionados períodos ou valores fictícios novos à publicação para produzir gráficos. A parte institucional de e-mail/HTTP não é declarada aprovada por ter passado em mock.

## D. Pendências e informações necessárias

1. **Municípios e cadastro mestre:** a fonte não tem cidade, coordenadas ou ID único da empresa/CNPJ. Para cruzar empresa+cidade ou agregar vários contratos da mesma empresa é necessário fornecer essas chaves. O controle de cidade está explicitamente indisponível.
2. **Evolução e correlação temporal:** é necessário fornecer observações adicionais, datas de início/fim e mesma abrangência/metodologia. Metas e pesos históricos precisam acompanhar os respectivos períodos. O comparativo anterior não comprova equivalência com o acumulado jan–set atual.
3. **Dimensões individuais por fornecedor:** não existem notas E/S/G individuais. É necessário fornecer medidas e metodologia para calculá-las. As cláusulas contratuais disponíveis não foram transformadas em notas próprias.
4. **Validação especializada da classificação:** a correspondência com AA está validada. A adequação substantiva de todos os indicadores às categorias fornecidas deve ser confirmada pelo responsável metodológico; a distribuição declarada é fortemente concentrada em G.
5. **Score original de fornecedores:** foram verificados limites, vínculos e classificação Excelente/Adequado/Crítico da fórmula original (85/70). A formação do score original de cada fornecedor não é detalhada na fonte e não pode ser reconstituída a partir das cláusulas.
6. **Ativação institucional:** exige domínio e caixas de e-mail reais, SMTP, URLs autorizadas, confirmação e recuperação reais e configuração/verificação da senha mínima no serviço Auth. As ferramentas desta sessão não oferecem essa configuração. Nenhum e-mail de exemplo foi tratado como caixa real. O banco passou nos testes reais, mas o ciclo completo Auth HTTP/e-mail não está homologado.
7. **Dados reais:** retirar a distribuição do payload demonstrativo e adequar identificação/avisos antes de usar a variante institucional. O modo demo permanece público e usa apenas dados fictícios, com contas simuladas.
8. **Persistência demo:** importações, contas e ajustes locais são temporários no navegador; não são arquivo institucional durável. Quota/encerramento de sessão são limites dessa modalidade, explicitados na interface. O servidor institucional preserva os snapshots.
9. **Dispositivos/carga:** não houve teste em celular físico nem ensaio de concorrência e volume de produção. O navegador disponível validou a integração, e as regras de quebra no celular foram revisadas; não se atribui aprovação a um aparelho que não foi testado.
10. **Excel arbitrário:** o painel não executa qualquer fórmula Excel. Ele suporta o modelo documentado e seus vínculos identificados. Estruturas/colunas incompatíveis são bloqueadas, em vez de recalculadas por adivinhação.

Verificações do Supabase: sem avisos de saúde. Permaneceram apenas informações sobre RLS sem política na tabela privada de domínios e um índice ainda não usado. A tabela privada tem acesso direto revogado e bloqueio intencional; não foi criada uma política permissiva apenas para eliminar o aviso. O índice de autoria foi preservado por apoiar o relacionamento/histórico. Referências oficiais: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [aviso de tabela sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## E. Resultado geral

**Confiável para a demonstração com a base atual, nos cenários efetivamente executados. Não homologado para operação institucional com dados reais.**

Validados: valores e fórmulas atuais; ligações com abas auxiliares; filtros combinados; separação entre organização e contratos; tabelas/gráficos aplicáveis; projeção comum dos extratos; arquivos Excel/PDF; importação e preservação de versões; seleção de retratos; testes reais de RLS/integridade no banco. As correções executadas têm testes de regressão; as cinco suítes passam a fazer parte da publicação automática.

Limites de confiança: não é possível validar crescimento que a fonte não contém, município que não foi informado ou caixa de e-mail que ainda não existe. Esses casos estão documentados e tratados sem dados artificiais. Não há falha conhecida deixada sem correção nas rotas e cenários acima; os limites e pendências não são apresentados como funcionalidades homologadas.
