import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularLPServico, calcularRetencoes, IRPJ_OBRAS, CSLL_OBRAS, parseBR, validar } from '../js/calc.js';

const perto = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('exemplo de referência do prompt: V = 1.000,00 e ISS 5%', () => {
  const r = calcularLPServico(1000, 5);
  perto(r.novo.baseBruta, 913.50);
  perto(r.novo.precoBase, 961.58);
  perto(r.novo.baseCbsIbs, 913.50); // CBS/IBS sobre 913,50, sem arredondar o preço base
  perto(r.novo.cbs, 103.59);
  perto(r.novo.ibs, 0.91);
  perto(r.novo.totalNF, 1066.08);
  perto(r.atual.totalTributos, 163.30);
  perto(r.atual.lucro, 836.70);
  perto(r.variacao, 6.608, 0.001);
});

test('ISS informado (2%) muda a conta', () => {
  const r = calcularLPServico(1000, 2);
  perto(r.atual.iss, 20);
  perto(r.novo.baseBruta, 943.50);
  perto(r.novo.precoBase, 943.50 / 0.98);
  perto(r.novo.iss, (943.50 / 0.98) * 0.02);
  perto(r.novo.baseCbsIbs, 943.50);
  perto(r.novo.totalNF, 943.50 / 0.98 + 943.50 * 0.1144);
});

test('materiais (dedução) saem só da base do ISS e das retenções', () => {
  const a = calcularLPServico(1000, 5, 250);
  const b = calcularLPServico(1000, 5);
  perto(a.V, 1000);
  perto(a.atual.baseIss, 750);
  perto(a.atual.iss, 37.5);                      // exemplo do cliente
  for (const k of ['pis', 'cofins', 'irpj', 'csll']) perto(a.atual[k], b.atual[k]);
  for (const k of ['precoBase', 'irpj', 'csll']) perto(a.novo[k], b.novo[k]);
  perto(a.novo.precoBase, 961.58);
  perto(a.novo.baseCbsIbs, 926.00);   // 961,58 − 35,58
  perto(a.novo.cbs, 105.01);
  perto(a.novo.ibs, 0.93);
  perto(a.novo.totalNF, 961.5789 + 926.0 * 0.1144);
  perto(a.novo.baseIss, 961.5789 - 250);
  perto(a.novo.iss, (961.5789 - 250) * 0.05);
  const ret = calcularRetencoes(a, { reterInss: true, reterIss: true });
  perto(ret.base, 711.58);
  perto(ret.inss, 78.27);
  perto(ret.iss, 35.58);
});

test('retenções de INSS (11%) e ISS sobre o preço base pós-reforma', () => {
  const r = calcularLPServico(1000, 5);
  const sem = calcularRetencoes(r);
  perto(sem.bruto, 1066.08);
  perto(sem.liquido, 1066.08);
  const inss = calcularRetencoes(r, { reterInss: true });
  perto(inss.inss, 961.5789 * 0.11);
  perto(inss.liquido, 1066.0833 - 105.7737);
  const ambos = calcularRetencoes(r, { reterInss: true, reterIss: true });
  perto(ambos.iss, 961.5789 * 0.05);
  perto(ambos.liquido, 1066.0833 - 105.7737 - 48.0789);
  // com materiais, a base das retenções é preço base − materiais
  const m = calcularLPServico(1000, 5, 500);
  const rm = calcularRetencoes(m, { reterInss: true, reterIss: true });
  perto(rm.base, m.novo.precoBase - 500);
  perto(rm.inss, rm.base * 0.11);
  perto(rm.iss, rm.base * 0.05);
  perto(rm.liquido, m.novo.totalNF - rm.base * 0.16);
});

test('Serviços em Obras: IRPJ 1,20% e CSLL 1,08%; pós-reforma sem PIS/COFINS', () => {
  const r = calcularLPServico(1000, 5, 0, { irpj: IRPJ_OBRAS, csll: CSLL_OBRAS });
  perto(r.atual.irpj, 12); perto(r.atual.csll, 10.8);
  perto(r.atual.pis, 6.5); perto(r.atual.cofins, 30); perto(r.atual.iss, 50);
  perto(r.atual.totalTributos, 109.3);
  perto(r.novo.precoBase, 961.58);
  perto(r.novo.irpj, 961.5789 * 0.012); perto(r.novo.csll, 961.5789 * 0.0108);
  perto(r.novo.totalTributos, r.novo.iss + r.novo.irpj + r.novo.csll + r.novo.cbs + r.novo.ibs);
  perto(r.novo.totalNF, 1066.08);
  assert.equal(r.novo.pis, undefined);
});

test('lucro novo não desconta CBS/IBS (por fora)', () => {
  const r = calcularLPServico(1000, 5);
  perto(r.novo.lucro, r.novo.precoBase - r.novo.iss - r.novo.irpj - r.novo.csll);
  perto(r.novo.totalTributos, r.novo.iss + r.novo.irpj + r.novo.csll + r.novo.cbs + r.novo.ibs);
});

test('parseBR aceita formato brasileiro', () => {
  assert.equal(parseBR('1.000,00'), 1000);
  assert.equal(parseBR('1.234.567,89'), 1234567.89);
  assert.equal(parseBR('2,5'), 2.5);
  assert.equal(parseBR('1000'), 1000);
  assert.equal(parseBR('1.000'), 1000);
  assert.equal(parseBR('R$ 50,10'), 50.1);
  assert.equal(parseBR('R$\u00a01.234,56'), 1234.56);
  assert.equal(parseBR('5,00%'), 5);
  assert.ok(Number.isNaN(parseBR('')));
  assert.ok(Number.isNaN(parseBR('abc')));
  assert.ok(Number.isNaN(parseBR('1,2,3')));
});

test('validação recusa vazio, zero, negativo e ISS fora do intervalo', () => {
  assert.equal(validar({ valor: 1000, iss: 5, municipio: 'Campinas' }).length, 0);
  assert.equal(validar({ valor: 0, iss: 5, municipio: 'X' }).length, 1);
  assert.equal(validar({ valor: -1, iss: 5, municipio: 'X' }).length, 1);
  assert.equal(validar({ valor: NaN, iss: 5, municipio: 'X' }).length, 1);
  assert.equal(validar({ valor: 10, iss: 0, municipio: 'X' }).length, 1);
  assert.equal(validar({ valor: 10, iss: 100, municipio: 'X' }).length, 1);
  assert.equal(validar({ valor: 10, iss: 5, municipio: '  ' }).length, 1);
  assert.equal(validar({ valor: 10, iss: 5, municipio: 'X', temMateriais: true, materiais: NaN }).length, 1);
  assert.equal(validar({ valor: 10, iss: 5, municipio: 'X', temMateriais: true, materiais: 5 }).length, 0);
  assert.equal(validar({ valor: 10, iss: 5, municipio: 'X', temMateriais: true, materiais: 10 }).length, 1);
});
