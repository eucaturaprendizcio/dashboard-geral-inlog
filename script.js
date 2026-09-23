// ⚠️ Cole aqui a URL do seu Web App do Apps Script (veja code.gs)
const API_URL = 'https://script.google.com/macros/s/AKfycbwMilHkXKaV8Z5hz6tHlrjZHn9Ql0KCQo1nX3Rrg7nY89mTAosDAEmor-eBJNMDQOycUw/exec';

let CARD_BLOCKS = [];
let VEICULOS = [];
let filtered = [];

const state = { empresa: '', servico: '', situacao: '', rastreador: '', manutencao: '', reserva: '', search: '' };
const FILTER_DEFS = [
    { key: 'empresa', label: 'Empresa' },
    { key: 'servico', label: 'Serviço' },
    { key: 'situacao', label: 'Situação' },
    { key: 'rastreador', label: 'Rastreador' },
    { key: 'ultimaConexao', label: 'Última Conexão' },
];

const COLORS = ['var(--accent)', 'var(--warn)', 'var(--danger)', 'var(--blue)'];

const IMAGES = [
    "url('img/onibus1.png')",
    "url('img/onibus2.png')",
    "url('img/onibus3.png')",
    "url('img/onibus4.png')",
];

// ---------- BOOT ----------
window.addEventListener('load', async () => {
    const start = Date.now();
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        CARD_BLOCKS = data.cards || [];
        VEICULOS = (data.veiculos || []).map(normalizeVeiculo);
    } catch (err) {
        document.getElementById('loading-sub').textContent =
            'Não foi possível conectar à planilha. Verifique a URL da API em script.js.';
        console.error(err);
        return;
    }

    // garante um tempo mínimo de exibição pra tela de carregamento não "piscar"
    const elapsed = Date.now() - start;
    setTimeout(finishLoading, Math.max(0, 900 - elapsed));
});

function normalizeVeiculo(v) {
    return {
        prefixo: v['Prefixo'] ?? null,
        empresa: v['Empresa'] ?? null,
        servico: v['Serviço'] ?? null,
        situacao: v['Situação'] ?? null,
        rastreador: v['Rastreador'] ?? null,
        ultimaConexao: v['Última Conexão'] ?? null,
    };
}

function finishLoading() {
    const ls = document.getElementById('loading-screen');
    ls.classList.add('fade-out');
    setTimeout(() => {
        ls.style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
        init();
    }, 500);
}

// ---------- CARDS (lidos direto das posições da planilha) ----------
function renderCards() {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = CARD_BLOCKS.map((block, i) => {
        const color = COLORS[i % COLORS.length];
        const img = IMAGES[i % IMAGES.length];
        return `
    <div class="card" style="--card-color:${color}; --card-img:${img}">
      <div class="card-main">
        <span class="value">${block.principal.valor}</span>
        <span class="label">${block.principal.label}</span>
      </div>
      <div class="card-subs">
        ${block.subs.map(s => `<div><span>${s.label}</span><span>${s.valor}</span></div>`).join('')}
      </div>
    </div>`;
    }).join('');
}

// ---------- FILTROS ----------
function uniqueValues(key) {
    return [...new Set(VEICULOS.map(v => v[key]).filter(Boolean))].sort();
}

function renderFilters() {
    const container = document.getElementById('filters');
    container.innerHTML = FILTER_DEFS.map(f => `
    <select data-filter="${f.key}">
      <option value="">${f.label}: Todos</option>
      ${uniqueValues(f.key).map(v => `<option value="${v}">${v}</option>`).join('')}
    </select>
  `).join('') + `<button id="clear-filters">Limpar filtros</button>`;

    container.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', e => {
            state[e.target.dataset.filter] = e.target.value;
            applyFilters();
        });
    });
    document.getElementById('clear-filters').addEventListener('click', () => {
        Object.keys(state).forEach(k => state[k] = '');
        document.getElementById('search-input').value = '';
        container.querySelectorAll('select').forEach(s => s.value = '');
        applyFilters();
    });
}

// ---------- TABELA ----------
function badge(value, type) {
    const map = {
        situacao: { 'Ativo': 'badge-ok', 'Retido': 'badge-warn', 'Sucata': 'badge-bad' },
        rastreador: { 'Instalado': 'badge-ok', 'Sem equipamento': 'badge-muted' },
    };
    const cls = (map[type] || {})[value] || 'badge-muted';
    return value ? `<span class="badge ${cls}">${value}</span>` : '-';
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = filtered.map(v => `
    <tr>
      <td>${v.prefixo ?? '-'}</td>
      <td>${v.empresa ?? '-'}</td>
      <td>${v.servico ?? '-'}</td>
      <td>${badge(v.situacao, 'situacao')}</td>
      <td>${badge(v.rastreador, 'rastreador')}</td>
      <td>${v.ultimaConexao ?? '-'}</td>
    </tr>
  `).join('');
    document.getElementById('table-count').textContent =
        `${filtered.length} de ${VEICULOS.length} veículos`;
}

function applyFilters() {
    const s = state.search.trim().toLowerCase();
    filtered = VEICULOS.filter(v => {
        if (state.empresa && v.empresa !== state.empresa) return false;
        if (state.servico && v.servico !== state.servico) return false;
        if (state.situacao && v.situacao !== state.situacao) return false;
        if (state.rastreador && v.rastreador !== state.rastreador) return false;
        if (state.ultimaConexao && v.ultimaConexao !== state.ultimaConexao) return false;
        if (s && !String(v.prefixo).toLowerCase().includes(s) && !String(v.empresa).toLowerCase().includes(s)) return false;
        return true;
    });
    renderTable();
}

// ---------- INIT ----------
function init() {
    document.getElementById('last-update').textContent =
        'Base: ' + VEICULOS.length + ' veículos cadastrados';
    renderCards();
    renderFilters();
    applyFilters();

    document.getElementById('search-input').addEventListener('input', e => {
        state.search = e.target.value;
        applyFilters();
    });
}