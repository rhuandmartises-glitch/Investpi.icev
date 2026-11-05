INVEST PI | ASG Intelligence
Protótipo de inteligência ASG em português brasileiro, feito com HTML, CSS e JavaScript, sem etapa de compilação.
Executar localmente
Com Python 3 instalado, na pasta do projeto execute:
python -m http.server 8000 --directory dist
Abra http://localhost:8000. Um servidor HTTP é necessário porque o aplicativo carrega data.json por fetch.
Arquivos
dist/index.html: estrutura e navegação.
dist/style.css: identidade visual e responsividade.
dist/app.js: filtros, indicadores, cálculos, importação, relatórios e persistência local.
dist/data.json: dados iniciais extraídos da planilha fornecida.
dist/vendor/xlsx.js: SheetJS Community Edition 0.20.3, usada na importação e exportação Excel. O aviso de licença original permanece no arquivo.
Dados e metodologia
A fonte é um modelo explicitamente fictício de Aurora Energia e Infraestrutura S.A., com 78 indicadores corporativos e 24 contratos de fornecedores. Não representa estatísticas reais do Piauí.
Os indicadores corporativos não são atribuídos aos fornecedores. Classificações ASG propostas e proxies contratuais são identificadas na interface. Indicadores transversais pendentes de validação são excluídos da pontuação parcial. As comparações entre 2025 e 2026 exigem validação da abrangência dos períodos.
Persistência e acesso
Importações, versões anteriores, pesos e análises ficam no localStorage do navegador. Não existe banco compartilhado, sincronização entre dispositivos ou autenticação de usuários. Os perfis são uma simulação funcional para demonstração.
A importação XLSX aceita o modelo original e recalcula os vínculos conhecidos. Não é um motor genérico de fórmulas Excel. CSV substitui o catálogo seguindo as 24 colunas originais. PDF utiliza a impressão do navegador com a opção Salvar como PDF.
Publicação
Publique o conteúdo de dist em um serviço de hospedagem estática. Este repositório não contém credenciais nem a identidade interna do site hospedado no ChatGPT.
Alterações neste repositório não atualizam automaticamente o site original. Uma nova publicação é necessária.
