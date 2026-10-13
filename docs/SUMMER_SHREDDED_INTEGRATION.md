# Summer Shredded — produtor, alimentação e acesso

Implementação exclusiva da branch `summer-shredded`. Não há implantação ou integração externa ativada por este commit.

## Painel do produtor

Contas com a função administrativa existente acessam Configurações → Admin (`#/admin`). O painel mantém os programas Masculino/Feminino, permite adicionar/remover/reordenar treinos e exercícios, editar as 12 prescrições semanais, técnicas, observações e correspondências do catálogo. Exercícios globais novos são criados sem mídia. Abdômen/cardio têm prescrições semanais editáveis; a edição de suas referências/modalidades ainda requer a API de conteúdo.

Salvar rascunho não altera o conteúdo recebido pelos alunos. Publicar valida referências, prescrições e protocolo alimentar e cria uma nova revisão. Salvar/publicar exigem a revisão do rascunho carregado: alterações concorrentes retornam 409 e exigem recarregar. Um treino novo precisa receber exercícios antes de ser salvo. A página mantém edições locais até salvar ou sair; salve antes de trocar de página. O histórico de execução permanece intacto.

## Fontes de alimentação

`frontend/src/lib/summer-foods.json` versiona 93 alimentos únicos da aba TABELA NUTRICIONAL de `Planilha--Automatizada (1).xlsx`, com SHA-256 e linha/faixa de origem. Os valores são por UMA medida original (1 g, 1 ml, 1 unidade/fatia/colher etc.), nunca automaticamente por 100 g. Seis ocorrências genéricas/duplicadas ficam no relatório de importação; para nomes repetidos vale a primeira linha, como no PROCV da fonte. Cinco entradas sem composição definida produzem totais parciais, sem presumir macros completos iguais a zero.

Reprodução: execute `scripts/summer-shredded/import-nutrition-source.py <arquivo.xlsx>` com Python e openpyxl. O script lê a fonte e grava apenas o catálogo do repositório; arquivos sincronizados em `sources/` não são alterados.

As equações/fatores do guia (páginas 10–11) são preservados sem arredondamento intermediário; o exemplo feminino de 21 anos, 167 cm, 79 kg e atividade moderada resulta em GET 1913,15878, diferindo do exemplo aproximado do PDF. Calorias dos alimentos usam 4 kcal/g de proteína/carboidrato e 9 kcal/g de gordura. Substituições preservam a base escolhida, com quantidade arredondada a duas casas.

O protocolo da página 17 exige novo peso na semana 7. Semanas 10 e 11 não especificam os dias 5–7; semana 12 não especifica o dia 7. Esses sete dias permanecem `null` até definição/publicação pelo produtor. O painel do aluno mostra meta pendente nesses dias. O dia do protocolo é relativo à data de matrícula. A alimentação salva perfil, plano de refeições e marcações diárias na conta; esta etapa não oferece histórico nutricional imutável nem doses de suplementos.

## Configuração de acesso

Preencha no ambiente do servidor, sem colocar credenciais no Git:

- `KIWIFY_WEBHOOK_SECRET`: segredo próprio do receptor, com pelo menos 32 caracteres aleatórios.
- `KIWIFY_PRODUCT_MAP`: JSON com IDs reais de produtos. O Summer Shredded será um único pacote com valor `choice`: escolha no primeiro acesso e troca posterior entre Masculino/Feminino no painel do aluno. A troca mantém data de início, semana, histórico, alimentação e eventual treino em andamento. O ID ainda será definido pelo produtor; não existe produto real configurado. Os valores `masculino` e `feminino` também são aceitos pela infraestrutura para atribuição fixa, mas não são o modelo comercial escolhido.
- `RESEND_API_KEY` e `SUMMER_EMAIL_FROM`: envio transacional com remetente verificado.
- `NODE_ENV=production`; mantenha `SUMMER_ACCESS_MODE` vazio. `development` habilita acesso local apenas fora de produção.

Cadastre na Kiwify a URL HTTPS `https://<host>/api/webhooks/kiwify?key=<segredo-do-receptor>`. Essa chave é uma credencial deste servidor; NÃO é o token de assinatura gerado pela Kiwify e não implementa um algoritmo de assinatura nativo do provedor. Restrinja e redija logs de URLs no proxy/monitoramento para não registrar a chave.

Sem configuração válida, o aluno fica bloqueado. O produtor continua acessando o painel por sua função administrativa. Login por passkey continua sendo o login do aplicativo; Google OAuth e senha não foram adicionados nesta etapa.

O webhook aceita os campos documentados `order_id`, `order_status`, `webhook_event_type`, `Product.product_id`, `Customer.email`, `refunded_at` e, quando presentes, `subscription_id`/`Subscription.customer_access`. Somente produto mapeado e `order_approved` com status `paid` concedem direitos. Eventos de pagamento pendente/outros produtos são ignorados. Reembolso/chargeback/revogação retiram o acesso. Repetições são idempotentes; aprovação antiga não reabre pedido já revogado. Expiração da assinatura é respeitada. Uma revogação explícita `has_access=false` bloqueia todos os pedidos da mesma assinatura de forma conservadora; reativação da mesma assinatura ainda exige procedimento futuro, enquanto nova compra sem essa assinatura pode conceder acesso.

O aluno comprova o e-mail da compra com código de 8 dígitos, válido por 10 minutos e cinco tentativas. Há intervalo de 60 segundos e limite de solicitações por hora. Uma compra verificada só vincula esse e-mail a uma conta. O arquivo de acesso persiste hashes de e-mail/código, não o e-mail original nem o código em texto. O Resend recebe o e-mail apenas para entregar o código. A interface revalida o acesso a cada 15 segundos e ao receber foco; conteúdo/matrícula também exigem autorização no servidor. Revogação fecha diálogos e temporizadores sem apagar registros existentes. O armazenamento pessoal continua autenticado e não é removido pelo bloqueio comercial.

## Ativação pendente

Obter IDs reais dos produtos, segredo do receptor, domínio HTTPS e remetente/credencial de e-mail; cadastrar o webhook e verificar payloads reais de compra, reembolso e assinatura nos logs da Kiwify. Compradores anteriores precisam ter seus eventos reenviados ou de uma importação futura; não há sincronização retroativa automática. O envio real de códigos, OAuth Google, testes com a conta Kiwify e implantação não foram executados. O armazenamento em arquivos pressupõe uma única instância de API.

Referências oficiais consultadas: [Kiwify: webhooks](https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/), [payloads da Kiwify](https://kiwify.notion.site/Webhooks-pt-br-c77eb84be10c42e6bb97cd391bca9dce), [Resend: envio de e-mails](https://resend.com/docs/api-reference/emails/send-email).

## Validação local executada

38 testes Summer Shredded do backend; 123 testes selecionados de alimentação, adaptação/execução/finalização de treino e configurações; compilação de produção do frontend. Navegador com usuários/compras fictícios: matrícula Feminino, cálculo de GET, adicionar alimento/consumo e persistência após recarregar, salvar rascunho/publicar e conferir conteúdo no aluno; bloqueio por reembolso. Layout móvel conferido em 390 × 844. Nenhum e-mail real foi enviado. Docker não está disponível neste ambiente e sua compilação não foi executada; o Dockerfile web inclui agora o módulo compartilhado de protocolo alimentar.
