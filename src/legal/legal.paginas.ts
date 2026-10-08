// Textos legais servidos em /privacidade e /termos.
// São uma base de trabalho: precisam de revisão jurídica antes da publicação nas lojas.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface DadosEmpresa {
  nome: string;
  cnpj: string;
  email: string;
}

/** Identificação do controlador, vinda do ambiente (LEGAL_*). */
export function dadosEmpresa(env: NodeJS.ProcessEnv = process.env): DadosEmpresa {
  return {
    nome: env.LEGAL_RAZAO_SOCIAL?.trim() || 'AgroTotal',
    cnpj: env.LEGAL_CNPJ?.trim() || '',
    email: env.LEGAL_EMAIL_CONTATO?.trim() || '',
  };
}

const ATUALIZADO = '8 de outubro de 2026';

function moldura(titulo: string, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} — AgroTotal</title>
<style>
body{font:16px/1.6 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;color:#222;max-width:760px;margin:0 auto;padding:24px 18px 60px}
h1{color:#115414;font-size:26px}h2{color:#115414;font-size:19px;margin-top:28px}
small{color:#777}li{margin:4px 0}
</style></head><body>
<h1>${esc(titulo)}</h1><small>Última atualização: ${ATUALIZADO}</small>
${corpo}
</body></html>`;
}

function contato(e: DadosEmpresa): string {
  const quem = e.cnpj ? `${esc(e.nome)} (CNPJ ${esc(e.cnpj)})` : esc(e.nome);
  const mail = e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : 'pelo contato informado no aplicativo';
  return `<p>${quem}. Contato para assuntos de privacidade e dos seus dados: ${mail}.</p>`;
}

export function paginaPrivacidade(e: DadosEmpresa = dadosEmpresa()): string {
  return moldura('Política de Privacidade', `
<p>Esta política explica quais dados o aplicativo AgroTotal coleta, para que usa e quais são os seus direitos,
conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).</p>

<h2>1. Quem é o responsável</h2>
${contato(e)}

<h2>2. Dados que coletamos</h2>
<ul>
<li><b>Conta:</b> nome, e-mail e senha (guardada apenas em forma criptografada irreversível). Se você entrar com Google ou Apple, recebemos o identificador da conta e o e-mail que esses serviços autorizarem.</li>
<li><b>Dados da propriedade e da operação:</b> fazendas (nome, município, CAR, INCRA, área), invernadas e lavouras (inclusive desenhos de perímetro), animais e pesagens, vacinas e manejos, lançamentos financeiros e compras de insumo. Você os informa, e eles são seus.</li>
<li><b>Equipe:</b> e-mail e papel das pessoas que você convida para a propriedade.</li>
<li><b>Dados fiscais (opcional):</b> se você usar o LCDPR, guardamos CPF, endereço, dados do imóvel rural, contas bancárias e CPF/CNPJ das pessoas com quem você negocia, apenas para gerar o seu livro caixa. Eles não são compartilhados com terceiros e são apagados com a conta.</li>
<li><b>Localização:</b> usada apenas quando você pede para buscar o CAR pela sua posição, ver o clima do local ou enquadrar o mapa. A permissão é opcional e pode ser revogada nos Ajustes do aparelho.</li>
<li><b>Registros de uso e técnicos:</b> data de acesso, endereço IP e tipo de aparelho, para segurança e diagnóstico; e relatórios de erro (sem seus dados de produção) para corrigirmos falhas.</li>
</ul>
<p>Não coletamos contatos, fotos, microfone ou câmera.</p>

<h2>3. Para que usamos</h2>
<ul>
<li>Prestar o serviço: autenticar você, guardar e exibir os dados da sua propriedade, gerar relatórios e alertas.</li>
<li>Segurança, prevenção a fraudes e correção de falhas.</li>
<li>Comunicações do serviço, como recuperação de senha e convites de equipe.</li>
<li>Cumprir obrigações legais.</li>
</ul>
<p>Não vendemos seus dados nem os usamos para publicidade de terceiros.</p>

<h2>4. Com quem compartilhamos</h2>
<ul>
<li><b>Provedores de infraestrutura:</b> hospedagem do servidor e do banco de dados, e envio de e-mails.</li>
<li><b>Serviços públicos consultados pelo app:</b> SICAR (busca do CAR), IBGE (municípios) e Open-Meteo (previsão do tempo). Para o CAR e o clima, a consulta envia a coordenada ou o número do CAR, sem identificar você.</li>
<li><b>Google e Apple:</b> apenas quando você escolhe entrar com eles.</li>
<li><b>Monitoramento de erros:</b> relatórios técnicos, sem dados pessoais de uso.</li>
<li><b>WhatsApp (opcional):</b> se você vincular seu número para lançar registros por mensagem, o conteúdo das mensagens e áudios que você enviar passa pela plataforma WhatsApp (Meta) e, para entender frases livres e transcrever áudios, por provedores de inteligência artificial contratados por nós. Usamos o conteúdo apenas para interpretar o pedido e registrar o que você confirmar; você pode desvincular o número a qualquer momento no aplicativo.</li>
<li><b>Imagens de satélite:</b> para o monitoramento de pasto e lavoura, o contorno das suas áreas é enviado ao serviço público de imagens Copernicus/Sentinel para calcular o índice de vegetação. Não enviamos seu nome nem outros dados pessoais.</li>
<li><b>Parceiros (opcional):</b> se você aceitar o convite de uma associação, empresa de nutrição ou de insumos, ela passa a ver apenas os dados que você marcar na hora de aceitar (por exemplo, número de animais, ganho de peso médio, área, município ou contato). Nunca compartilhamos dados financeiros, CPF, contas bancárias ou lançamentos com parceiros. Você pode revogar o compartilhamento a qualquer momento em Mais → Parceiros, e o parceiro deixa de ver seus dados na hora.</li>
<li><b>Sua equipe:</b> as pessoas que você convida veem os dados da propriedade de acordo com o papel (administrador, gestor ou colaborador). Colaboradores não veem o financeiro.</li>
<li><b>Autoridades:</b> quando houver obrigação legal.</li>
</ul>

<h2>5. Por quanto tempo guardamos</h2>
<p>Mantemos os dados enquanto sua conta estiver ativa. Ao excluir a conta, apagamos seus dados pessoais e as propriedades em que você era o único membro. Em propriedades com equipe, os dados continuam com os demais integrantes, e o integrante mais antigo assume como administrador. Cópias de segurança podem reter dados por um período curto adicional até serem renovadas.</p>

<h2>6. Seus direitos (LGPD, art. 18)</h2>
<p>Você pode confirmar a existência de tratamento, acessar, corrigir, portar e pedir a eliminação dos seus dados, além de revogar consentimentos e obter informação sobre compartilhamentos.
<b>Excluir a conta:</b> no aplicativo, em Mais → Configurações → <i>Excluir minha conta</i>. Para os demais pedidos, use o contato acima.</p>

<h2>7. Segurança</h2>
<p>Usamos conexão criptografada (HTTPS), senhas com hash, controle de acesso por propriedade e papel, e limites contra tentativas abusivas de login. Nenhum sistema é totalmente imune; em caso de incidente relevante, comunicaremos você e a ANPD conforme a lei.</p>

<h2>8. Crianças</h2>
<p>O aplicativo é voltado a produtores rurais adultos e não é direcionado a menores de 18 anos.</p>

<h2>9. Mudanças nesta política</h2>
<p>Podemos atualizar este texto. Mudanças relevantes serão avisadas no aplicativo.</p>
`);
}

export function paginaTermos(e: DadosEmpresa = dadosEmpresa()): string {
  return moldura('Termos de Uso', `
<p>Ao criar uma conta ou usar o AgroTotal, você concorda com estes termos.</p>

<h2>1. O serviço</h2>
<p>O AgroTotal é uma ferramenta de gestão para propriedades rurais: cadastro de fazendas, rebanho, lavouras, financeiro, calculadoras e consultas de apoio.</p>
${contato(e)}

<h2>2. Conta e responsabilidade</h2>
<ul>
<li>Você deve informar dados verdadeiros e manter a senha em sigilo.</li>
<li>Você é responsável pelas ações feitas na sua conta e pelas permissões que dá à sua equipe.</li>
<li>É proibido usar o serviço para fins ilegais, tentar acessar dados de outras pessoas ou prejudicar o funcionamento do sistema.</li>
</ul>

<h2>3. Planos</h2>
<p>O AgroTotal tem planos com limites de uso e recursos diferentes. O plano gratuito tem limites de propriedades, áreas e animais. Novos usuários podem receber um período de teste de recursos avançados. Ao fim do teste ou do plano contratado, a conta volta ao plano básico: seus dados continuam acessíveis para consulta, mas a criação de novos registros acima dos limites fica bloqueada até a contratação de um plano. Condições e valores dos planos pagos são informados no aplicativo antes da contratação.</p>

<h2>4. Seus dados</h2>
<p>Os dados que você insere continuam sendo seus. Você nos autoriza a armazená-los e processá-los apenas para prestar o serviço, conforme a Política de Privacidade. Você pode excluir sua conta a qualquer momento no aplicativo.</p>

<h2>5. Conteúdo de apoio e limites de responsabilidade</h2>
<p>Calculadoras, guia de pragas, previsão do tempo, dados do CAR e demais conteúdos são <b>referências de apoio</b>. Não substituem a avaliação de engenheiro agrônomo, zootecnista ou médico-veterinário, nem a leitura de bulas e receituários. Decisões sobre aplicação de defensivos, dosagem, saúde animal e finanças são de responsabilidade do usuário. Os dados de fontes públicas (SICAR, IBGE, Open-Meteo) podem conter atrasos ou erros fora do nosso controle.</p>
<p>O serviço é oferecido no estado em que se encontra, e podem ocorrer indisponibilidades. Na extensão permitida em lei, não respondemos por perdas indiretas, lucros cessantes ou decisões tomadas com base nas informações do aplicativo.</p>

<h2>6. Equipamentos</h2>
<p>A integração com bastão e balança Bluetooth depende do equipamento e do seu funcionamento correto. Confira os valores lidos antes de confirmar os registros.</p>

<h2>7. Suspensão e encerramento</h2>
<p>Podemos suspender contas que violem estes termos ou ponham a segurança em risco. Você pode encerrar a sua a qualquer momento.</p>

<h2>8. Mudanças</h2>
<p>Podemos alterar estes termos; mudanças relevantes serão avisadas no aplicativo. Continuar usando o serviço após o aviso significa concordar com a nova versão.</p>

<h2>9. Lei aplicável</h2>
<p>Aplica-se a lei brasileira. Fica eleito o foro do domicílio do usuário consumidor, nos termos do Código de Defesa do Consumidor.</p>
`);
}
