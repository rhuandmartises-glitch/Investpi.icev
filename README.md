# INVEST PI — ASG Intelligence

Painel existente, revisado por auditoria funcional em 07/11/2026. A versão publicada continua sendo uma **demonstração com dados fictícios e login simulado**, independente do ChatGPT. Não usar para guardar informações reais.

- Site: https://rhuandmartises-glitch.github.io/Investpi.icev/
- Conta pública de demonstração: `rhuan.douglas@investepiaui.com`
- Senha de exemplo: `12345678` (mínimo de oito caracteres no simulador).
- Cadastro e recuperação são simulados; nenhum e-mail é enviado.
- O Supabase institucional não é acessado no modo demonstrativo.

## Auditoria

O relatório detalhado está em [audit/AUDITORIA_TECNICA.md](audit/AUDITORIA_TECNICA.md), com problemas, causas, correções, testes e pendências. As versões anteriores foram preservadas em `backup/pre-auditoria-20261107`. Os dados demonstrativos de origem não foram substituídos.

## Dados e relacionamentos

A fonte atual contém uma organização principal, 72 indicadores corporativos, 24 registros de fornecedores/contratos, 12 investidores, 25 denúncias, 12 riscos e 12 temas de materialidade. Indicadores não são observações individuais de fornecedores. A coluna AA informa a classificação E/S/G; os eixos originais são preservados.

O ID `CT-*` identifica o contrato. A base atual tem um registro por fornecedor e nomes distintos; não há cadastro mestre de empresas/CNPJ nem municípios. O painel não agrupa contratos de empresas por semelhança de nomes e não inventa cidades.

O score geral dos fornecedores é o original da fonte. As pontuações corporativas usam pontos por status, pesos, limites e polaridade da planilha; ausências não viram zero. Não há competição nem ranking. O comparativo armazenado não tem abrangência equivalente comprovada: por isso não gera curva de tendência, crescimento ou pontuação histórica usando metas atuais.

Os cruzamentos de fornecedores usam observações do mesmo contrato/data-base. Há dispersão e matriz descritiva de valor anual, score geral e não conformidades. Indicadores corporativos podem ser selecionados em conjunto com dimensões e unidades preservadas; a base não contém observações temporais suficientes para correlacioná-los.

## Importação e histórico

XLSX no modelo original ou CSV do catálogo com 24/27 colunas. No CSV de 24 colunas, a classificação é preservada pelo ID existente; novos IDs sem classificação permanecem pendentes. Números decimais com vírgula são aceitos em CSV separado por ponto e vírgula. As fórmulas e ligações suportadas são recalculadas antes da confirmação.

Há validação de tipos, IDs, datas, escalas, polaridade, metas, comparativo de contratos, materialidade e ligações com abas auxiliares. Limites: arquivo de 10 MiB, expansão ZIP de 25 MiB/10 MiB por entrada, 32 abas, 500 mil células. Arquivos incompatíveis são bloqueados sem alterar a base.

A confirmação conserva snapshots. A recuperação cria uma nova versão. Importar de novo a mesma data-base não cria crescimento; o histórico distingue importação de período. O filtro de período pode consultar retratos anteriores quando existirem. No modo demo, tudo permanece apenas na sessão do navegador e está sujeito à sua quota/encerramento. No modo institucional, snapshots são append-only no PostgreSQL, com RLS e validações também no servidor.

## Extratos

Tela, Excel e PDF usam a mesma seleção de dados. Excel tem abas Contexto, Indicadores e Fornecedores. PDF tem download próprio, com fonte, filtros, período, pesos e paginação; Imprimir continua disponível. O PDF usa fontes latinas padrão; caracteres fora da codificação suportada são substituídos por `?`.

## Executar e testar

```sh
python -m http.server 8000 --directory dist
```

Abra http://localhost:8000. Para os testes, use Node 20 ou superior, sem instalar pacotes:

```sh
node tests/audit.cjs
node tests/import-integration.cjs
node tests/auth-integration.cjs
node tests/pdf-export.cjs
node tests/security-static.cjs
```

`tests/database-audit.sql` verifica permissões e integridade no Supabase em uma transação com `ROLLBACK`. O teste não cria usuários ou snapshots permanentes. Testes com datas futuras/alterações usam fixtures exclusivamente de teste, nunca a publicação.

O GitHub Actions executa as cinco suítes antes de publicar `dist/`. Testes SQL do servidor são executados separadamente, sem colocar credenciais no repositório.

## Dependências

Distribuições locais, sem dependências de execução em CDN: SheetJS CE 0.20.3, Supabase JS 2.119.0 e pdf-lib 1.17.1 (carregado somente ao gerar PDF). Licenças e hashes estão em `dist/vendor`. Não coloque chaves secretas no front-end.

A autenticação institucional continua preparada, porém não homologada. Antes de ativá-la, cumprir [backend/README.md](backend/README.md): domínio e caixas reais, SMTP, confirmação/redefinição real, política de senha no serviço e retirada do payload demonstrativo público.
