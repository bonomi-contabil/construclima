// Máscaras de preenchimento (R$ e %) e busca de municípios.

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Máscara estilo "caixa registradora": os dígitos entram pela direita, sempre com 2 casas.
 * tipo 'moeda' → "R$ 1.234,56"   tipo 'percent' → "5,00%"
 */
export function aplicarMascara(input, tipo) {
  const maxDigitos = tipo === 'moeda' ? 13 : 4; // até R$ 99.999.999.999,99 / 99,99%
  let anterior = '';
  const formatar = (digitos) => {
    digitos = digitos.replace(/^0+/, '').slice(0, maxDigitos);
    if (!digitos) return '';
    const n = Number(digitos) / 100;
    return tipo === 'moeda' ? moeda.format(n) : `${dec2.format(n)}%`;
  };
  input.addEventListener('input', (e) => {
    let digitos = input.value.replace(/\D/g, '');
    // apagou só um símbolo (%, vírgula, ponto): apaga o último dígito
    if (e.inputType && e.inputType.startsWith('delete') && digitos === anterior.replace(/\D/g, '')) {
      digitos = digitos.slice(0, -1);
    }
    input.value = formatar(digitos);
    anterior = input.value;
    const fim = tipo === 'percent' && input.value ? input.value.length - 1 : input.value.length;
    try { input.setSelectionRange(fim, fim); } catch { /* alguns teclados não aceitam */ }
  });
  input.addEventListener('focus', () => {
    setTimeout(() => {
      const fim = tipo === 'percent' && input.value ? input.value.length - 1 : input.value.length;
      try { input.setSelectionRange(fim, fim); } catch { /* ignore */ }
    }, 0);
  });
}

// ---------- Municípios ----------
let lista = null;      // ["Campinas/SP", ...]
let normalizada = null;
let carregando = null;
export const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function carregarMunicipios() {
  if (!carregando) {
    carregando = fetch('assets/municipios.json')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((l) => { lista = l; normalizada = l.map(semAcento); return l; })
      .catch(() => { carregando = null; return null; });
  }
  return carregando;
}

/** true se o texto é um município da lista; null se a lista não carregou. */
export function municipioValido(texto) {
  if (!lista) return null;
  return normalizada.includes(semAcento(texto));
}

function buscar(texto, max = 10) {
  const q = semAcento(texto);
  if (!lista || q.length < 2) return [];
  const comeca = [], contem = [];
  for (let i = 0; i < lista.length; i++) {
    const n = normalizada[i];
    if (n.startsWith(q)) comeca.push(i);
    else if (n.includes(q)) contem.push(i);
  }
  // nomes mais curtos primeiro (ex.: "campin" → Campinas/SP antes de Campina Grande do Sul/PR)
  const ordem = (x, y) => lista[x].length - lista[y].length || lista[x].localeCompare(lista[y], 'pt-BR');
  return comeca.sort(ordem).concat(contem.sort(ordem)).slice(0, max).map((i) => lista[i]);
}

export function autocompletarMunicipio(input) {
  const caixa = document.createElement('div');
  caixa.className = 'ac';
  input.parentNode.insertBefore(caixa, input);
  caixa.appendChild(input);
  const ul = document.createElement('ul');
  ul.className = 'ac-lista';
  ul.setAttribute('role', 'listbox');
  ul.hidden = true;
  caixa.appendChild(ul);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  let itens = [];
  let ativo = -1;
  const fechar = () => { ul.hidden = true; ativo = -1; input.setAttribute('aria-expanded', 'false'); };
  const escolher = (valor) => { input.value = valor; fechar(); input.dispatchEvent(new Event('change')); };
  const desenhar = () => {
    ul.innerHTML = '';
    itens.forEach((m, i) => {
      const li = document.createElement('li');
      li.textContent = m;
      li.setAttribute('role', 'option');
      if (i === ativo) li.className = 'ativo';
      li.addEventListener('mousedown', (e) => { e.preventDefault(); escolher(m); });
      ul.appendChild(li);
    });
    ul.hidden = itens.length === 0;
    input.setAttribute('aria-expanded', String(!ul.hidden));
  };
  const atualizar = async () => {
    await carregarMunicipios();
    itens = buscar(input.value);
    ativo = itens.length ? 0 : -1;
    desenhar();
  };

  input.addEventListener('focus', carregarMunicipios, { once: true });
  let timerFechar = null;
  input.addEventListener('input', () => { clearTimeout(timerFechar); atualizar(); });
  input.addEventListener('focus', () => clearTimeout(timerFechar));
  input.addEventListener('blur', () => { timerFechar = setTimeout(fechar, 100); });
  input.addEventListener('keydown', (e) => {
    if (ul.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); ativo = (ativo + 1) % itens.length; desenhar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = (ativo - 1 + itens.length) % itens.length; desenhar(); }
    else if (e.key === 'Enter' && ativo >= 0) { e.preventDefault(); escolher(itens[ativo]); }
    else if (e.key === 'Escape') fechar();
  });
}
