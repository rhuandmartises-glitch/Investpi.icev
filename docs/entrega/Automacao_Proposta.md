# Proposta de automação de dados

O diagrama fornecido pela equipe apresenta duas alternativas de evolução.

## Notificação por webhook

Uma importação gera INSERT em asg_datasets no banco de origem. Uma trigger AFTER INSERT chamaria notify_new_snapshot para enviar metadados por POST HTTPS usando pg_net. Uma API receptora autenticaria a chamada, responderia e enfileiraria o processamento. O consumidor buscaria o snapshot autorizado e atualizaria o painel.

## Consulta agendada

Um agendador consultaria a API por páginas, validaria os dados e os gravaria em uma camada de ingestão. O painel consumiria o resultado validado e a última execução. O período pode ser mensal ou outro intervalo a homologar.

## Estado e dependências

Estas alternativas são propostas, sem implantação no site atual. O upsert ilustrado no diagrama requer modelagem de ingestão própria porque o modelo atual de snapshots é append-only. É necessário definir contrato da API, autenticação de serviço, idempotência, retentativas, monitoramento e preservação do histórico.

O acesso viewer citado no desenho não implica expor credenciais no navegador. O PDF original acompanha o ZIP da atividade na pasta automacao.
