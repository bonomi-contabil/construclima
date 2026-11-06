// Fórmulas do Precificador pós-reforma tributária (Lucro Presumido — Serviços).
// Somente cálculo: sem formatação nem DOM. Precisão integral; arredondar só na exibição.

export const CBS = 0.1134; // 11,34%
export const IBS = 0.0001; // 0,01%
export const PIS = 0.0065; // 0,65%
export const COFINS = 0.03; // 3,00%
export const IRPJ = 0.048; // 4,80% (Serviços de Instalações)
export const CSLL = 0.0288; // 2,88% (Serviços de Instalações)
// Serviços em Obras: IRPJ 1,20% e CSLL 1,08%
export const IRPJ_OBRAS = 0.012;
export const CSLL_OBRAS = 0.0108;
export const INSS_RET = 0.11; // retenção de INSS: 11%

// Converte texto em formato brasileiro ("1.000,00", "5", "2,5") para número.
// Retorna NaN se não for um número válido.
export function parseBR(texto) {
  if (typeof texto === 'number') return texto;
  if (texto == null) return NaN;
  let s = String(texto).trim().replace(/^R\$\s*/i, '').replace(/%$/, '').trim();
  if (s === '') return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // "1.000" = mil
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/**
 * Lucro Presumido — Serviço, com ISS informado pelo usuário.
 * O adicional de materiais entra no valor da nota, mas é ABATIDO da base de
 * cálculo de todos os tributos (PIS, COFINS, ISS, IRPJ, CSLL, CBS e IBS):
 * os tributos incidem só sobre o valor do serviço.
 * @param {number} valorServico  valor atual do serviço (R$), sem materiais
 * @param {number} issPercent    alíquota do ISS do município (%), ex.: 5 ou 2,5
 * @param {number} [materiais=0] adicional de materiais (R$)
 * @param {{irpj?: number, csll?: number}} [aliq] alíquotas de IRPJ/CSLL (padrão: instalações)
 */
export function calcularLPServico(valorServico, issPercent, materiais = 0, aliq = {}) {
  const iss = issPercent / 100;
  const irpjA = aliq.irpj ?? IRPJ;
  const csllA = aliq.csll ?? CSLL;
  const S = valorServico;      // base de cálculo (materiais abatidos)
  const V = S + materiais;     // valor total da nota atual

  const atual = {
    base: S,
    pis: S * PIS,
    cofins: S * COFINS,
    iss: S * iss,
    irpj: S * irpjA,
    csll: S * csllA,
  };
  atual.totalTributos = atual.pis + atual.cofins + atual.iss + atual.irpj + atual.csll;
  atual.lucro = S - atual.totalTributos;
  atual.precoCliente = V;
  atual.carga = atual.totalTributos / V;

  const baseBruta = S - atual.pis - atual.cofins - atual.iss;
  const precoBaseServico = baseBruta / (1 - iss);
  const issNovo = precoBaseServico * iss;
  const baseCbsIbs = precoBaseServico - issNovo;
  const novo = {
    baseBruta,
    precoBaseServico,
    precoBase: precoBaseServico + materiais, // valor sem CBS/IBS (serviço + materiais)
    iss: issNovo,
    baseCbsIbs,
    cbs: baseCbsIbs * CBS,
    ibs: baseCbsIbs * IBS,
    irpj: precoBaseServico * irpjA,
    csll: precoBaseServico * csllA,
  };
  novo.totalTributos = novo.iss + novo.irpj + novo.csll + novo.cbs + novo.ibs;
  novo.lucro = precoBaseServico - novo.iss - novo.irpj - novo.csll;
  novo.totalNF = novo.precoBase + novo.cbs + novo.ibs;
  novo.precoCliente = novo.totalNF;

  const variacao = ((novo.totalNF - V) / V) * 100;
  return { V, valorServico, materiais, issAliquota: iss, irpjAliquota: irpjA, csllAliquota: csllA, atual, novo, variacao };
}

/**
 * Retenções na nota pós-reforma. Base de cálculo = preço base do serviço pós-reforma
 * (sem materiais: nenhum tributo nem retenção incide sobre os materiais).
 * INSS: 11%. ISS: a alíquota do ISS informada.
 * Valor líquido = Valor bruto da NF (total pós-reforma) − retenções.
 */
export function calcularRetencoes(r, { reterInss = false, reterIss = false } = {}) {
  const base = r.novo.precoBaseServico;
  const inss = reterInss ? base * INSS_RET : 0;
  const iss = reterIss ? base * r.issAliquota : 0;
  const bruto = r.novo.totalNF;
  return { base, inss, iss, total: inss + iss, bruto, liquido: bruto - inss - iss };
}

/** Valida entradas; devolve lista de mensagens de erro (vazia = ok). */
export function validar({ valor, iss, municipio, temMateriais, materiais }) {
  const erros = [];
  if (!municipio || !String(municipio).trim()) erros.push('Informe o município da prestação do serviço.');
  if (!(iss > 0 && iss < 100)) erros.push('Informe a alíquota do ISS: maior que 0% e menor que 100%.');
  if (!(valor > 0)) erros.push('Informe um valor atual maior que zero.');
  if (temMateriais && !(materiais > 0)) erros.push('Informe o valor do adicional de materiais (maior que zero).');
  return erros;
}
