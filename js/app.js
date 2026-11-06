import { calcularLPServico, parseBR, validar, CBS, IBS, PIS, COFINS, IRPJ, CSLL } from './calc.js';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (casas) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const R = (v) => moeda.format(v);
const P = (fracao, casas = 2) => `${num(casas).format(fracao * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.getElementById('ano').textContent = new Date().getFullYear();

// Logotipo: se assets/logo.png não existir, mostra o nome em texto.
const logo = document.getElementById('logo');
const mostrarTexto = () => { logo.hidden = true; document.getElementById('marca-texto').hidden = false; };
logo.addEventListener('error', mostrarTexto);
if (logo.complete && logo.naturalWidth === 0) mostrarTexto();

// ---------- Abas ----------
const ABAS = {
  instalacoes: {
    titulo: 'Serviços de Instalações — Lucro Presumido',
    exemplo: 'Instalação de ar-condicionado em edifício comercial',
    rotuloValor: 'Valor atual do serviço de instalação (R$)',
    materiais: false,
  },
  obras: {
    titulo: 'Serviços em Obras — Lucro Presumido',
    exemplo: 'Climatização de obra — edifício comercial',
    rotuloValor: 'Valor atual do serviço em obra (R$)',
    materiais: true,
  },
};

const paineis = document.getElementById('paineis');
const modelo = document.getElementById('modelo-painel');
const elPainel = {};

for (const [id, cfg] of Object.entries(ABAS)) {
  const frag = modelo.content.cloneNode(true);
  const painel = frag.querySelector('.painel');
  painel.dataset.aba = id;
  painel.hidden = id !== 'instalacoes';
  painel.querySelector('[name=nome]').placeholder = cfg.exemplo;
  painel.querySelector('.rotulo-valor').textContent = cfg.rotuloValor;
  // nomes de rádio únicos por aba
  painel.querySelectorAll('[name=temMateriais]').forEach((r) => (r.name = `temMateriais-${id}`));
  // ligar rótulos aos campos
  painel.querySelectorAll('.campo > label').forEach((lb, i) => {
    const inp = lb.parentElement.querySelector('input');
    if (inp) { inp.id = `${id}-${inp.name}-${i}`; lb.htmlFor = inp.id; }
  });
  if (cfg.materiais) {
    const fs = painel.querySelector('.materiais');
    fs.hidden = false;
    fs.addEventListener('change', () => {
      const sim = fs.querySelector('input[type=radio]:checked').value === 'sim';
      fs.querySelector('.campo-materiais').hidden = !sim;
    });
  }
  const form = painel.querySelector('form');
  form.addEventListener('submit', (e) => { e.preventDefault(); calcular(id); });
  const iss = painel.querySelector('[name=iss]');
  iss.addEventListener('input', () => avisoISS(painel));
  paineis.appendChild(frag);
  elPainel[id] = paineis.lastElementChild;
}

document.querySelectorAll('.aba').forEach((bt) => {
  bt.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b === bt)));
    for (const [id, el] of Object.entries(elPainel)) el.hidden = id !== bt.dataset.aba;
  });
});

function avisoISS(painel) {
  const v = parseBR(painel.querySelector('[name=iss]').value);
  const el = painel.querySelector('.aviso-iss');
  if (v > 0 && v < 100 && (v < 2 || v > 5)) {
    el.textContent = 'Atenção: a lei complementar do ISS prevê alíquota entre 2% e 5%. Confira a alíquota do município.';
    el.hidden = false;
  } else el.hidden = true;
}

// ---------- Cálculo ----------
function calcular(id) {
  const painel = elPainel[id];
  const cfg = ABAS[id];
  const q = (n) => painel.querySelector(`[name=${n}]`);
  const temMateriais = cfg.materiais && painel.querySelector('input[type=radio]:checked').value === 'sim';
  const dados = {
    nome: q('nome').value.trim(),
    municipio: q('municipio').value.trim(),
    iss: parseBR(q('iss').value),
    valor: parseBR(q('valor').value),
    temMateriais,
    materiais: temMateriais ? parseBR(q('materiais').value) : 0,
  };
  const erros = validar(dados);
  const ul = painel.querySelector('.erros');
  const out = painel.querySelector('.resultado');
  if (erros.length) {
    ul.innerHTML = erros.map((e) => `<li>${esc(e)}</li>`).join('');
    ul.hidden = false;
    out.hidden = true;
    out.innerHTML = '';
    return;
  }
  ul.hidden = true;
  const r = calcularLPServico(dados.valor, dados.iss, dados.materiais);
  out.innerHTML = montarResultado(r, dados, cfg);
  out.hidden = false;
  out.querySelector('.imprimir').addEventListener('click', () => window.print());
}

function montarResultado(r, d, cfg) {
  const { atual: a, novo: n } = r;
  const aumento = n.totalNF >= r.V;
  const sinal = r.variacao > 0 ? '+' : '';
  const linhaIss = P(r.issAliquota);
  const ref = [
    `<strong>${esc(cfg.titulo)}</strong>`,
    d.nome ? `Referência: ${esc(d.nome)}` : '',
    `Município da prestação: ${esc(d.municipio)} — ISS ${linhaIss}`,
  ].filter(Boolean).map((t) => `<div>${t}</div>`).join('');

  const valorLinhas = d.temMateriais
    ? `<tr><td>Valor do serviço</td><td>${R(r.valorServico)}</td></tr>
       <tr><td>Adicional de materiais <span class="tag">fora da base</span></td><td>${R(r.materiais)}</td></tr>
       <tr class="sub"><td>Base de cálculo dos tributos (só serviço)</td><td>${R(r.valorServico)}</td></tr>`
    : `<tr><td>Valor do serviço</td><td>${R(r.V)}</td></tr>`;

  return `
  <div class="referencia">${ref}</div>

  <div class="cards">
    <div class="card card-atual">
      <div class="card-rotulo">Valor total da NF — sistema atual</div>
      <div class="card-valor">${R(r.V)}</div>
      <div class="card-det">Carga atual: ${P(a.carga)}</div>
    </div>
    <div class="card card-base">
      <div class="card-rotulo">Preço base — pós-reforma</div>
      <div class="card-valor">${R(n.precoBase)}</div>
      <div class="card-det">Sem CBS e IBS (por fora).</div>
    </div>
    <div class="card card-nf">
      <div class="card-rotulo">Valor total da NF — pós-reforma</div>
      <div class="card-valor">${R(n.totalNF)}</div>
      <div class="card-det">${R(n.precoBase)} + CBS ${R(n.cbs)} + IBS ${R(n.ibs)}</div>
    </div>
  </div>

  <div class="variacao ${aumento ? 'maior' : 'menor'}">
    <span class="variacao-pct">${sinal}${num(2).format(r.variacao)}%</span>
    <span>${R(r.V)} → ${R(n.totalNF)}</span>
    <span class="variacao-rot">${aumento ? 'NF maior' : 'NF menor'}</span>
  </div>

  <div class="colunas">
    <div class="coluna">
      <h3>Sistema atual</h3>
      <table>
        ${valorLinhas}
        <tr><td>PIS (${P(PIS)})</td><td>${R(a.pis)}</td></tr>
        <tr><td>COFINS (${P(COFINS)})</td><td>${R(a.cofins)}</td></tr>
        <tr><td>ISS (${linhaIss})</td><td>${R(a.iss)}</td></tr>
        <tr><td>IRPJ (${P(IRPJ)})</td><td>${R(a.irpj)}</td></tr>
        <tr><td>CSLL (${P(CSLL)})</td><td>${R(a.csll)}</td></tr>
        <tr class="destaque"><td>Total de tributos</td><td>${R(a.totalTributos)}</td></tr>
        <tr class="destaque"><td>Lucro</td><td>${R(a.lucro)}</td></tr>
        <tr class="destaque"><td>Preço ao cliente</td><td>${R(a.precoCliente)}</td></tr>
      </table>
    </div>
    <div class="coluna">
      <h3>Pós-reforma (2027)</h3>
      <table>
        ${d.temMateriais
          ? `<tr><td>Preço base do serviço</td><td>${R(n.precoBaseServico)}</td></tr>
             <tr><td>Adicional de materiais <span class="tag">fora da base</span></td><td>${R(r.materiais)}</td></tr>
             <tr class="sub"><td>Preço base total (sem CBS/IBS)</td><td>${R(n.precoBase)}</td></tr>`
          : `<tr><td>Preço base do serviço</td><td>${R(n.precoBase)}</td></tr>`}
        <tr><td>CBS (${P(CBS)}) <span class="tag">por fora*</span></td><td>${R(n.cbs)}</td></tr>
        <tr><td>IBS (${P(IBS)}) <span class="tag">por fora*</span></td><td>${R(n.ibs)}</td></tr>
        <tr><td>ISS (${linhaIss}) <span class="tag">ainda vigente 2027</span></td><td>${R(n.iss)}</td></tr>
        <tr><td>IRPJ (${P(IRPJ)})</td><td>${R(n.irpj)}</td></tr>
        <tr><td>CSLL (${P(CSLL)})</td><td>${R(n.csll)}</td></tr>
        <tr class="destaque"><td>Total de tributos</td><td>${R(n.totalTributos)}</td></tr>
        <tr class="destaque"><td>Lucro</td><td>${R(n.lucro)}</td></tr>
        <tr class="destaque"><td>Preço ao cliente</td><td>${R(n.precoCliente)}</td></tr>
      </table>
    </div>
  </div>

  <div class="avisos">
    <p>* CBS e IBS destacados na nota: cobrados por fora do preço base.</p>
    <p>O ISS permanece até a implementação plena do IBS.</p>
    <p>“Lucro” é o saldo após os tributos considerados, antes de custos e despesas (equipamentos, materiais, mão de obra, deslocamento e despesas operacionais). A ferramenta não garante a preservação da margem real.</p>
    ${d.temMateriais ? '<p>O adicional de materiais entra no valor da nota, mas foi abatido da base de cálculo de todos os tributos (PIS, COFINS, ISS, IRPJ, CSLL, CBS e IBS). O “Lucro” considera só o serviço; os materiais são repassados pelo valor informado. Confirmar com o contador a comprovação exigida para a dedução.</p>' : ''}
    <p>Estimativa com base nas premissas de transição de 2027 adotadas nesta ferramenta. Alíquotas e regras aplicáveis devem ser confirmadas conforme a legislação vigente. Custos e despesas operacionais não estão incluídos. Consulte o responsável contábil da Construclima.</p>
    <p>Para serviços de engenharia e instalação de ar-condicionado, confirmar enquadramento tributário e retenções conforme a atividade e o contrato. Esta simulação não contempla particularidades de contratos mistos ou fornecimento de equipamentos junto à instalação.</p>
  </div>

  <button type="button" class="botao imprimir nao-imprimir">Imprimir / PDF</button>`;
}

// ---------- Navegação ----------
const TELAS = { '': 'inicio', precificador: 'precificador', orcamento: 'orcamento' };
const TITULOS = {
  inicio: ['Precificador e Orçamento', 'Engenharia e instalação de ar-condicionado'],
  precificador: ['Precificador pós-reforma tributária', 'Construclima'],
  orcamento: ['Orçamento', 'Construclima'],
};
function rota() {
  const chave = location.hash.replace(/^#\/?/, '');
  const tela = TELAS[chave] || 'inicio';
  document.querySelectorAll('.tela').forEach((s) => (s.hidden = s.id !== `tela-${tela}`));
  const [t, s] = TITULOS[tela];
  document.getElementById('titulo-pagina').textContent = t;
  document.getElementById('subtitulo').textContent = s;
  document.title = `${t} — Construclima`;
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', rota);
rota();
