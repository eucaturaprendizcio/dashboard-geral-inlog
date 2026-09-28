// ⚠️ URL do seu Web App do Apps Script (veja code.gs)
const API_URL = 'https://script.google.com/macros/s/AKfycbwMilHkXKaV8Z5hz6tHlrjZHn9Ql0KCQo1nX3Rrg7nY89mTAosDAEmor-eBJNMDQOycUw/exec';

let CARD_BLOCKS = [];
let FROTAS = [];
let VEICULOS = [];
let filtered = [];
let activeCardIndex = null;

const state = { frota: '', empresa: '', servico: '', situacao: '', rastreador: '', ultimaConexao: '', search: '' };

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

// Filtro aplicado ao clicar em "Visualizar" em cada card, por posição
// (mesma ordem dos blocos que vêm do code.gs, B2:C18).
const CARD_FILTERS = [
    null,                              // Frota Geral -> mostra tudo
    { situacao: 'Ativo' },             // Frota Ativa
    { rastreador: 'Sem equipamento' }, // Frota Sem Equipamento
    { rastreador: 'Instalado' },       // Conectados / Frota c/ equipamento
];

// ---------- BOOT ----------
window.addEventListener('load', async () => {
    const start = Date.now();
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        CARD_BLOCKS = data.cards || [];
        FROTAS = data.frotas || [];
        VEICULOS = (data.veiculos || []).map(normalizeVeiculo);
    } catch (err) {
        document.getElementById('loading-sub').textContent =
            'Não foi possível conectar à planilha. Verifique a URL da API em script.js.';
        console.error(err);
        return;
    }

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

// ---------- CARDS ----------
function renderCards() {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = CARD_BLOCKS.map((block, i) => {
        const color = COLORS[i % COLORS.length];
        const img = IMAGES[i % IMAGES.length];
        const active = activeCardIndex === i ? ' is-active' : '';
        return `
    <div class="card${active}" style="--card-color:${color}; --card-img:${img}" data-card-index="${i}">
      <div class="card-main">
        <span class="value">${block.principal.valor}</span>
        <span class="label">${block.principal.label}</span>
      </div>
      <div class="card-subs">
        ${block.subs.map(s => `<div><span>${s.label}</span><span>${s.valor}</span></div>`).join('')}
      </div>
      <div class="card-overlay">
        <button class="card-view-btn" data-view-index="${i}">Visualizar</button>
      </div>
    </div>`;
    }).join('');

    grid.querySelectorAll('.card-view-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            applyCardFilter(Number(btn.dataset.viewIndex));
        });
    });
}

function applyCardFilter(index) {
    activeCardIndex = index;
    const filterDef = CARD_FILTERS[index] || {};

    Object.keys(state).forEach(k => state[k] = '');
    document.querySelectorAll('.filters select').forEach(s => s.value = '');
    document.getElementById('search-input').value = '';

    Object.entries(filterDef).forEach(([key, value]) => {
        state[key] = value;
        const select = document.querySelector(`.filters select[data-filter="${key}"]`);
        if (select) select.value = value;
    });

    updateActiveFilterChip(CARD_BLOCKS[index].principal.label);
    renderCards();
    applyFilters();

    document.querySelector('.table-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearCardFilter() {
    activeCardIndex = null;
    Object.keys(state).forEach(k => state[k] = '');
    document.querySelectorAll('.filters select').forEach(s => s.value = '');
    document.getElementById('search-input').value = '';
    updateActiveFilterChip(null);
    renderCards();
    applyFilters();
}

function updateActiveFilterChip(label) {
    const chip = document.getElementById('active-filter-chip');
    if (!chip) return;
    if (label) {
        chip.classList.add('show');
        chip.querySelector('span').textContent = `Filtro ativo: ${label}`;
    } else {
        chip.classList.remove('show');
    }
}

// ---------- FILTROS ----------
function uniqueValues(key) {
    return [...new Set(VEICULOS.map(v => v[key]).filter(Boolean))].sort();
}

function renderFilters() {
    const container = document.getElementById('filters');

    // Frota: "Frota 44" -> value "44" (filtra prefixos que começam com 44)
    const frotaSelect = `
    <select data-filter="frota">
      <option value="">Frota: Todas</option>
      ${FROTAS.map(f => {
          const num = String(f).replace(/\D/g, '');
          return `<option value="${num}">${f}</option>`;
      }).join('')}
    </select>`;

    container.innerHTML = frotaSelect + FILTER_DEFS.map(f => `
    <select data-filter="${f.key}">
      <option value="">${f.label}: Todos</option>
      ${uniqueValues(f.key).map(v => `<option value="${v}">${v}</option>`).join('')}
    </select>
  `).join('') + `<button id="clear-filters">Limpar filtros</button>`;

    container.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', e => {
            state[e.target.dataset.filter] = e.target.value;
            activeCardIndex = null;
            updateActiveFilterChip(null);
            renderCards();
            applyFilters();
        });
    });
    document.getElementById('clear-filters').addEventListener('click', clearCardFilter);
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
        if (state.frota && !String(v.prefixo).startsWith(state.frota)) return false;
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

    const chip = document.createElement('div');
    chip.id = 'active-filter-chip';
    chip.className = 'active-filter-chip';
    chip.innerHTML = `<span></span><button id="clear-card-filter">✕</button>`;
    document.querySelector('.table-header').insertAdjacentElement('afterend', chip);
    chip.querySelector('#clear-card-filter').addEventListener('click', clearCardFilter);

    renderCards();
    renderFilters();
    applyFilters();

    document.getElementById('search-input').addEventListener('input', e => {
        state.search = e.target.value;
        activeCardIndex = null;
        updateActiveFilterChip(null);
        renderCards();
        applyFilters();
    });
}