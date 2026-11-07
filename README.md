# INVEST PI — Demonstração ASG

Esta publicação está em **modo demonstração**, com dados fictícios e login simulado. Não é uma barreira de segurança para informações reais.

- Conta pública: `rhuan.douglas@investepiaui.com`
- Senha de exemplo: `12345678`
- Senhas de cadastro/redefinição: mínimo de 8 caracteres.
- Cadastro e recuperação: simulações locais, sem enviar mensagens.
- O Supabase institucional não é acessado nesta modalidade.

A variante de autenticação institucional continua no código para ativação futura. Não basta trocar um rótulo: configurar o serviço, remover o payload demonstrativo publicado e concluir os testes descritos em `backend/README.md`.

## Dados

A planilha atual tem 72 indicadores, 24 fornecedores e uma matriz de materialidade. A demonstração inclui a base declarada fictícia da planilha em `dist/demo-data.json`, com identificação explícita. Nenhum dado do banco institucional é utilizado. Importações demonstrativas ficam apenas nesta sessão do navegador. Na modalidade institucional, os snapshots ficam em PostgreSQL com políticas RLS.

As abas esperadas são Leia-me, Painel, Comparativo_Empresas, Matriz_Materialidade, Indicadores, Parâmetros, Contratos_ASG, Investidores, Canal_Denuncias, Riscos_Integridade e Plano_Ação. As classificações E/S/G vêm da coluna AA de Indicadores. Sem classificação informada, o indicador fica pendente de validação.

## Competição

Ranking pelo score original dos fornecedores, empates com a mesma colocação, sem transformar ausência em zero. Crescimento exige notas por empresa em datas-base diferentes e metodologia comparável. Uma nova importação com a mesma data-base não conta como evolução temporal. A fonte atual não contém série anterior por fornecedor.

## Executar

```sh
python -m http.server 8000 --directory dist
```

Abra http://localhost:8000. O modo demo funciona sem Supabase. No modo institucional, sem a configuração, o painel permanece bloqueado. Não preencha credenciais de banco ou chaves secretas em `auth-config.js`.

## Verificação

```sh
node --check dist/auth.js
node --check dist/app.js
node tests/security-static.cjs
```

Para validar os dados, gere um JSON privado da planilha e execute `node tests/data-and-ranking.cjs /caminho/privado/base.json`. A fixture não deve ser enviada ao GitHub. Os testes estáticos não substituem os testes reais de confirmação, recuperação e RLS.

## Dependências

SheetJS Community Edition 0.20.3 (importação/exportação de Excel) e Supabase JS (autenticação e banco), com licenças preservadas em `dist/vendor`. A publicação do GitHub Pages usa a pasta `dist`.
