import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularLPServico, parseBR, validar } from '../js/calc.js';

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

test('adicional de materiais entra no valor da nota', () => {
  const a = calcularLPServico(800, 5, 200);
  const b = calcularLPServico(1000, 5);
  perto(a.V, 1000);
  perto(a.novo.totalNF, b.novo.totalNF);
  assert.equal(a.materiais, 200);
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
  assert.equal(validar({ valor: 10, iss: 5, municipio: 'X', temMateriais: true, materiais: 50 }).length, 0);
});
