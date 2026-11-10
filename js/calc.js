// Fórmulas do Precificador pós-reforma tributária (Lucro Presumido — Serviços).
// Somente cálculo: sem formatação nem DOM. Precisão integral; arredondar só na exibição.

export const CBS = 0.1134; // 11,34%
export const IBS = 0.001;  // 0,10%
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
 * Materiais utilizados (dedução): ficam DENTRO do valor total do serviço e são
 * deduzidos apenas da base do ISS (e da retenção de INSS/ISS). PIS, COFINS, IRPJ,
 * CSLL, CBS e IBS continuam sobre o valor cheio.
 * Ex.: serviço total R$ 1.000,00 e materiais R$ 500,00 → base do ISS R$ 500,00.
 * @param {number} valorServico  valor total atual do serviço (R$), materiais incluídos
 * @param {number} issPercent    alíquota do ISS do município (%), ex.: 5 ou 2,5
 * @param {number} [materiais=0] materiais utilizados — dedução (R$)
 * @param {{irpj?: number, csll?: number}} [aliq] alíquotas de IRPJ/CSLL (padrão: instalações)
 */
export function calcularLPServico(valorServico, issPercent, materiais = 0, aliq = {}) {
  const iss = issPercent / 100;
  const irpjA = aliq.irpj ?? IRPJ;
  const csllA = aliq.csll ?? CSLL;
  const V = valorServico;      // valor total da nota atual
  const M = materiais;         // dedução da base do ISS

  const atual = {
    baseIss: V - M,
    pis: V * PIS,
    cofins: V * COFINS,
    iss: (V - M) * iss,
    irpj: V * irpjA,
    csll: V * csllA,
  };
  atual.totalTributos = atual.pis + atual.cofins + atual.iss + atual.irpj + atual.csll;
  atual.lucro = V - atual.totalTributos;
  atual.precoCliente = V;
  atual.carga = atual.totalTributos / V;

  // Preço base P: depois do ISS novo, sobra o mesmo que sobrava hoje após PIS, COFINS e ISS.
  // P − (P − M) × iss = baseBruta  →  P = (baseBruta − M × iss) ÷ (1 − iss)
  const baseBruta = V - atual.pis - atual.cofins - atual.iss;
  const precoBase = (baseBruta - M * iss) / (1 - iss);
  const baseIss = precoBase - M;
  const issNovo = baseIss * iss;
  const baseCbsIbs = precoBase - issNovo;
  const novo = {
    baseBruta,
    precoBase,
    precoBaseServico: precoBase,
    baseIss,
    iss: issNovo,
    baseCbsIbs,
    cbs: baseCbsIbs * CBS,
    ibs: baseCbsIbs * IBS,
    irpj: precoBase * irpjA,
    csll: precoBase * csllA,
  };
  novo.totalTributos = novo.iss + novo.irpj + novo.csll + novo.cbs + novo.ibs;
  novo.lucro = precoBase - novo.iss - novo.irpj - novo.csll;
  novo.totalNF = precoBase + novo.cbs + novo.ibs;
  novo.precoCliente = novo.totalNF;

  const variacao = ((novo.totalNF - V) / V) * 100;
  return { V, valorServico, materiais: M, issAliquota: iss, irpjAliquota: irpjA, csllAliquota: csllA, atual, novo, variacao };
}

/**
 * Retenções na nota pós-reforma. Base = preço base pós-reforma − materiais (dedução).
 * INSS: 11%. ISS: a alíquota do ISS informada.
 * Valor líquido = Valor bruto da NF (total pós-reforma) − retenções.
 */
export function calcularRetencoes(r, { reterInss = false, reterIss = false } = {}) {
  const base = r.novo.baseIss;
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
  if (temMateriais && !(materiais > 0)) erros.push('Informe o valor dos materiais utilizados (maior que zero).');
  else if (temMateriais && valor > 0 && materiais >= valor) erros.push('O valor dos materiais deve ser menor que o valor total do serviço.');
  return erros;
}
