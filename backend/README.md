# Ativação do painel interno

Esta versão depende de Supabase Auth e PostgreSQL. Não há senha padrão nem conta fictícia liberada. `rhuan.douglas@investepiaui.com` é somente um exemplo e precisa ser uma caixa existente para receber confirmação.

1. Projeto criado: Invest PI (`kwvcsupbtwzwpokukhhh`), região São Paulo. Migração aplicada e base atual carregada em tabela protegida.
2. `001_auth_and_data.sql` já foi executado no projeto; não repetir a criação dos objetos. O domínio está configurado provisoriamente como `investepiaui.com`; confirmar antes da ativação.
3. Em Auth, habilitar confirmação de e-mail e senha mínima de 8 caracteres. Configurar SMTP próprio para confirmação e recuperação em produção, além dos limites de envio.
4. Definir Site URL como o endereço final do site e autorizar somente o callback exato `index.html` desse endereço. Ativar o envio de e-mails de recuperação.
5. Cadastrar e confirmar um usuário institucional. Conceder `role='admin'` a esse UUID diretamente pelo administrador do banco. Nunca aceitar role proveniente de user_metadata.
6. A planilha atual já foi inserida em `asg_datasets` pelo canal administrativo. Os dados atualizados não fazem parte deste repositório público.
7. `dist/auth-config.js` já está preenchido com URL e chave publicável. Não usar service_role, chave secreta ou senha de banco no navegador.
8. Testar cadastro institucional, domínio externo, confirmação, bloqueio sem login, usuário desativado, recuperação, logout e consultas anon/rest. Só então integrar esta versão à publicação.

A autenticação oculta todo o painel e as políticas RLS protegem as consultas. Código HTML/JS público não equivale a acesso aos dados. A versão pública anterior continha dados fictícios; colocá-la atrás de login não apaga arquivos de commits anteriores. Antes de dados reais, restringir o repositório ou manter todas as fontes no banco protegido.

## Comparação e crescimento

Ranking atual usa o score original dos contratos (0–100), com empates na mesma posição. A metodologia original desse score não é documentada na planilha. Valores faltantes não recebem zero. Crescimento só é calculado com snapshots de datas-base diferentes; importações com a mesma data-base não equivalem a evolução temporal. Variação de nota é apresentada em pontos, com comparação secundária em %. Não são atribuídas notas E/S/G individuais inexistentes.

## Validação do banco em 07/11/2026

Testes transacionais de domínio externo, acesso anônimo, e-mail não confirmado, leitura de funcionário confirmado, tentativa de importação por viewer, autoelevação de role, usuário inativo, importação por admin e sessão revogada passaram. Todos os usuários, sessões e registros de teste foram revertidos. Há uma base permanente e nenhum usuário permanente criado. O aviso informativo de RLS sem política em `private.allowed_email_domains` é intencional: a tabela de configuração não tem acesso direto de clientes.

Pendente: Site URL/callbacks do Auth, SMTP, domínio definitivo e um e-mail real para validar confirmação e recuperação. Ainda não integrar o PR.

Supabase JS incorporado: versão 2.119.0, licença MIT em `dist/vendor/SUPABASE-LICENSE`.

## Publicação demonstrativa

`mode: demo` publica somente dados explicitamente fictícios em demo-data.json. O login é uma simulação, com conta pública rhuan.douglas@investepiaui.com e senha 12345678. Não acessa Supabase nem altera usuários ou senhas institucionais. Cadastro, recuperação e importações são locais à sessão. Para produção, remover a base demonstrativa da hospedagem e configurar a política mínima de 8 caracteres no Auth do Supabase, confirmação, SMTP e testes ponta a ponta.

## Auditoria de 07/11/2026

As migrações aditivas 002–006 foram aplicadas ao projeto existente após verificar o snapshot. Elas não alteram as linhas de dados: validam estrutura, datas, tipos, relações das abas, fórmula/status/pontos, tamanho descomprimido e autoria. `created_by` referencia `auth.users`; `created_at` é atribuído no servidor. UPDATE e DELETE de snapshots continuam indisponíveis aos clientes.

`tests/database-audit.sql` foi executado no projeto real com usuários/sessões transacionais, revertidos ao final. Ele verifica também uma razão A/B aparentemente válida cujo numerador contradiz a aba de contratos. Não confundir esses testes SQL reais com homologação do envio de e-mail: o serviço Auth HTTP/SMTP ainda precisa de um fluxo real confirmado.

A ferramenta disponível nesta sessão não oferece configuração de Auth/SMTP. Portanto, o mínimo de oito caracteres foi verificado no front-end/simulador; a política efetiva do serviço Auth precisa ser configurada/verificada no dashboard antes da ativação institucional. Não ativar o modo institucional apenas alterando o nome ou ocultando o aviso demo.

Consultas de histórico do cliente institucional são paginadas para evitar o corte silencioso de 1.000 snapshots. O desempenho foi exercitado com a base atual; não houve teste de carga em escala de produção.
