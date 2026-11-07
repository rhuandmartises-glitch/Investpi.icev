# INVEST PI — Acesso institucional e competição ASG

Versão em preparação para acesso restrito. A configuração e os testes de integração estão descritos em [backend/README.md](backend/README.md).

O cadastro é limitado no servidor ao domínio provisório `investepiaui.com`, exige confirmação por e-mail e não cria usuário de exemplo. Autenticação e consultas dependem do projeto Supabase do responsável. Não há senha padrão ou acesso de demonstração que contorne o login.

## Dados

A planilha atual tem 72 indicadores, 24 fornecedores e uma matriz de materialidade. Os dados atualizados não são incluídos neste repositório. O painel lê snapshots do banco protegido, com políticas RLS, e registra novas importações sem sobrescrever os anteriores. O payload público `dist/data.json` foi removido nesta versão.

As abas esperadas são Leia-me, Painel, Comparativo_Empresas, Matriz_Materialidade, Indicadores, Parâmetros, Contratos_ASG, Investidores, Canal_Denuncias, Riscos_Integridade e Plano_Ação. As classificações E/S/G vêm da coluna AA de Indicadores. Sem classificação informada, o indicador fica pendente de validação.

## Competição

Ranking pelo score original dos fornecedores, empates com a mesma colocação, sem transformar ausência em zero. Crescimento exige notas por empresa em datas-base diferentes e metodologia comparável. Uma nova importação com a mesma data-base não conta como evolução temporal. A fonte atual não contém série anterior por fornecedor.

## Executar

```sh
python -m http.server 8000 --directory dist
```

Abra http://localhost:8000. Sem o Supabase configurado, aparece a tela de acesso com mensagem de preparação e o painel permanece bloqueado. Não preencha credenciais de banco ou chaves secretas em `auth-config.js`.

## Verificação

```sh
node --check dist/auth.js
node --check dist/app.js
node tests/security-static.cjs
```

Para validar os dados, gere um JSON privado da planilha e execute `node tests/data-and-ranking.cjs /caminho/privado/base.json`. A fixture não deve ser enviada ao GitHub. Os testes estáticos não substituem os testes reais de confirmação, recuperação e RLS.

## Dependências

SheetJS Community Edition 0.20.3 (importação/exportação de Excel) e Supabase JS (autenticação e banco), com licenças preservadas em `dist/vendor`. A publicação do GitHub Pages usa a pasta `dist`.
