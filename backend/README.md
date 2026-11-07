# Ativação do painel interno

Esta versão depende de Supabase Auth e PostgreSQL. Não há senha padrão nem conta fictícia liberada. `rhuan.douglas@investepiaui.com` é somente um exemplo e precisa ser uma caixa existente para receber confirmação.

1. Criar ou selecionar um projeto Supabase pertencente ao responsável.
2. Executar `001_auth_and_data.sql`. O domínio está configurado provisoriamente como `investepiaui.com`; confirmar antes da ativação.
3. Em Auth, habilitar confirmação de e-mail e senha mínima de 12 caracteres. Configurar SMTP próprio para confirmação e recuperação em produção, além dos limites de envio.
4. Definir Site URL como o endereço final do site e autorizar somente o callback exato `index.html` desse endereço. Ativar o envio de e-mails de recuperação.
5. Cadastrar e confirmar um usuário institucional. Conceder `role='admin'` a esse UUID diretamente pelo administrador do banco. Nunca aceitar role proveniente de user_metadata.
6. Inserir a planilha normalizada em `asg_datasets` pelo canal administrativo. Os dados atualizados não fazem parte deste repositório público.
7. Preencher `dist/auth-config.js` somente com URL e chave publicável. Não usar service_role, chave secreta ou senha de banco no navegador.
8. Testar cadastro institucional, domínio externo, confirmação, bloqueio sem login, usuário desativado, recuperação, logout e consultas anon/rest. Só então integrar esta versão à publicação.

A autenticação oculta todo o painel e as políticas RLS protegem as consultas. Código HTML/JS público não equivale a acesso aos dados. A versão pública anterior continha dados fictícios; colocá-la atrás de login não apaga arquivos de commits anteriores. Antes de dados reais, restringir o repositório ou manter todas as fontes no banco protegido.

## Comparação e crescimento

Ranking atual usa o score original dos contratos (0–100), com empates na mesma posição. A metodologia original desse score não é documentada na planilha. Valores faltantes não recebem zero. Crescimento só é calculado com snapshots de datas-base diferentes; importações com a mesma data-base não equivalem a evolução temporal. Variação de nota é apresentada em pontos, com comparação secundária em %. Não são atribuídas notas E/S/G individuais inexistentes.
