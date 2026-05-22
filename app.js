// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://vacdptnjqqwncgfarfwf.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_2GFclghGWnF-dlUTCYK49A_QOuRzAcd";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de estado de la aplicación
let listaPartidasGlobal = [];
let jugadorActivoTab = ""; 
let columnaOrdenada = ""; 
let ordenAscendente = false; 
let filtroTemporal = "all"; 

document.addEventListener("DOMContentLoaded", async () => {
    const statsForm = document.getElementById('stats-form');
    const btnFilterAll = document.getElementById('filter-all');
    const btnFilterWeek = document.getElementById('filter-week');

    if (statsForm) statsForm.addEventListener('submit', guardarEstadisticas);

    if (btnFilterAll && btnFilterWeek) {
        btnFilterAll.addEventListener('click', () => {
            filtroTemporal = "all";
            btnFilterAll.classList.add('active');
            btnFilterWeek.classList.remove('active');
            procesarYRenderizarVistas();
        });

        btnFilterWeek.addEventListener('click', () => {
            filtroTemporal = "week";
            btnFilterWeek.classList.add('active');
            btnFilterAll.classList.remove('active');
            procesarYRenderizarVistas();
        });
    }

    configurarEncabezadosOrdenables();

    // Carga inicial de datos desde la nube
    await cargarDatosDesdeSupabase();
});

async function cargarDatosDesdeSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('partidas')
            .select('*')
            // Se ordena por id de forma descendente para evitar errores si "created_at" no está configurado
            .order('id', { ascending: false }); 

        if (error) throw error;

        listaPartidasGlobal = data || [];
        
        if (listaPartidasGlobal.length > 0 && !jugadorActivoTab) {
            jugadorActivoTab = listaPartidasGlobal[0].jugador;
        }

        procesarYRenderizarVistas();
    } catch (error) {
        console.error("Error al cargar datos:", error.message);
        alert("No se pudieron sincronizar los datos con Supabase");
    }
}

async function guardarEstadisticas(event) {
    event.preventDefault();

    const nombre = document.getElementById('player-name').value;
    const agente = document.getElementById('agent-name').value;
    const k = parseInt(document.getElementById('kills').value) || 0;
    const d = parseInt(document.getElementById('deaths').value) || 0;
    const a = parseInt(document.getElementById('assists').value) || 0;
    const acs = parseInt(document.getElementById('acs').value) || 0;

    if (!nombre || !agente) return;

    try {
        const { error } = await supabaseClient
            .from('partidas')
            .insert([
                { jugador: nombre, agente: agente, kills: k, deaths: d, assists: a, acs: acs }
            ]);

        if (error) throw error;

        jugadorActivoTab = nombre;
        document.getElementById('stats-form').reset();
        await cargarDatosDesdeSupabase();

    } catch (error) {
        console.error("Error al guardar:", error.message);
        alert("Error al enviar la partida a Supabase");
    }
}

function esDeEstaSemana(fechaString) {
    if (!fechaString) return false; // Previene error si created_at es null o no existe
    const fechaPartida = new Date(fechaString);
    const sieteDiasEnMilisegundos = 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - fechaPartida.getTime()) < sieteDiasEnMilisegundos;
}

function procesarYRenderizarVistas() {
    actualizarTablaGeneral();
    renderizarPestañasAgentes();
}

function actualizarTablaGeneral() {
    const tbody = document.getElementById('stats-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (listaPartidasGlobal.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af;">No hay datos registrados en la base de datos.</td></tr>`;
        return;
    }

    let resumenJugadores = {};

    listaPartidasGlobal.forEach(partida => {
        if (filtroTemporal === "week" && !esDeEstaSemana(partida.created_at)) {
            return; 
        }

        const j = partida.jugador;
        if (!resumenJugadores[j]) {
            resumenJugadores[j] = { partidas: 0, kills: 0, deaths: 0, assists: 0, acs: 0 };
        }

        resumenJugadores[j].partidas += 1;
        resumenJugadores[j].kills += partida.kills;
        resumenJugadores[j].deaths += partida.deaths;
        resumenJugadores[j].assists += partida.assists;
        resumenJugadores[j].acs += partida.acs;
    });

    let listaJugadores = [];
    for (let jugador in resumenJugadores) {
        const data = resumenJugadores[jugador];
        const p = data.partidas;
        const muertesEfectivas = Math.max(1, data.deaths);

        listaJugadores.push({
            nombre: jugador,
            partidas: p,
            kills: data.kills,
            deaths: data.deaths,
            assists: data.assists,
            kd: data.kills / muertesEfectivas,
            kdaRatio: (data.kills + data.assists) / muertesEfectivas,
            acs: data.acs / p
        });
    }

    if (listaJugadores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af;">No hay partidas registradas esta semana.</td></tr>`;
        actualizarIndicadoresEncabezado();
        return;
    }

    if (columnaOrdenada) {
        listaJugadores.sort((a, b) => {
            let valA, valB;
            switch (columnaOrdenada) {
                case 'JUGADOR': valA = a.nombre.toLowerCase(); valB = b.nombre.toLowerCase(); break;
                case 'PARTIDAS': valA = a.partidas; valB = b.partidas; break;
                case 'PROMEDIO K/D/A': valA = a.kills / a.partidas; valB = b.kills / b.partidas; break;
                case 'K/D': valA = a.kd; valB = b.kd; break;
                case 'KDA RATIO': valA = a.kdaRatio; valB = b.kdaRatio; break;
                case 'ACS PROM.': valA = a.acs; valB = b.acs; break;
                default: return 0;
            }
            if (valA < valB) return ordenAscendente ? -1 : 1;
            if (valA > valB) return ordenAscendente ? 1 : -1;
            return 0;
        });
    }

    listaJugadores.forEach(jugador => {
        const avgK = (jugador.kills / jugador.partidas).toFixed(1);
        const avgD = (jugador.deaths / jugador.partidas).toFixed(1);
        const avgA = (jugador.assists / jugador.partidas).toFixed(1);
        const avgACS = Math.round(jugador.acs);

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td><strong>${jugador.nombre}</strong></td>
            <td>${jugador.partidas}</td>
            <td>${avgK} / ${avgD} / ${avgA}</td>
            <td style="color: #38bdf8; font-weight: bold;">${jugador.kd.toFixed(2)}</td>
            <td style="color: #22c55e; font-weight: bold;">${jugador.kdaRatio.toFixed(2)}</td>
            <td>${avgACS}</td>
        `;
        tbody.appendChild(fila);
    });

    actualizarIndicadoresEncabezado();
}

function renderizarPestañasAgentes() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    container.innerHTML = '';

    const jugadoresUnicos = [...new Set(listaPartidasGlobal.map(p => p.jugador))];

    if (jugadoresUnicos.length === 0) {
        container.innerHTML = `<p style="color: #9ca3af; text-align: center; padding: 20px;">Registra partidas para desbloquear las tarjetas de personajes.</p>`;
        return;
    }

    if (!jugadorActivoTab || !jugadoresUnicos.includes(jugadorActivoTab)) {
        jugadorActivoTab = jugadoresUnicos[0];
    }

    const nav = document.createElement('div');
    nav.className = 'player-tabs-nav';

    jugadoresUnicos.forEach(jugador => {
        const btn = document.createElement('button');
        btn.className = `tab-button ${jugador === jugadorActivoTab ? 'active' : ''}`;
        btn.innerText = jugador;
        btn.addEventListener('click', () => {
            jugadorActivoTab = jugador;
            renderizarPestañasAgentes();
        });
        nav.appendChild(btn);
    });
    container.appendChild(nav);

    const grid = document.createElement('div');
    grid.className = 'agent-grid-display';

    let agentesAgrupados = {};

    listaPartidasGlobal.forEach(p => {
        if (p.jugador !== jugadorActivoTab) return;
        if (filtroTemporal === "week" && !esDeEstaSemana(p.created_at)) return;

        if (!agentesAgrupados[p.agente]) {
            agentesAgrupados[p.agente] = { partidas: 0, kills: 0, deaths: 0, assists: 0, acs: 0 };
        }

        agentesAgrupados[p.agente].partidas += 1;
        agentesAgrupados[p.agente].kills += p.kills;
        agentesAgrupados[p.agente].deaths += p.deaths;
        agentesAgrupados[p.agente].assists += p.assists;
        agentesAgrupados[p.agente].acs += p.acs;
    });

    if (Object.keys(agentesAgrupados).length === 0) {
        grid.innerHTML = `<p style="color: #9ca3af; padding: 10px;">Este jugador no registra partidas en el periodo seleccionado.</p>`;
    } else {
        for (let agente in agentesAgrupados) {
            const data = agentesAgrupados[agente];
            const p = data.partidas;

            const avgK = (data.kills / p).toFixed(1);
            const avgD = (data.deaths / p).toFixed(1);
            const avgA = (data.assists / p).toFixed(1);
            const avgACS = Math.round(data.acs / p);
            
            const muertesEfectivas = Math.max(1, data.deaths);
            const kdPure = (data.kills / muertesEfectivas).toFixed(2);
            const kdaRatio = ((data.kills + data.assists) / muertesEfectivas).toFixed(2);

            const card = document.createElement('div');
            card.className = 'agent-card';
            card.innerHTML = `
                <h3>${agente} <span style="font-size:0.8rem; color:var(--text-muted);">P: ${p}</span></h3>
                <div class="agent-stat"><span>Promedio K/D/A</span><strong>${avgK} / ${avgD} / ${avgA}</strong></div>
                <div class="agent-stat"><span>K/D Puro</span><strong style="color: #38bdf8;">${kdPure}</strong></div>
                <div class="agent-stat"><span>KDA Ratio</span><strong style="color: #22c55e;">${kdaRatio}</strong></div>
                <div class="agent-stat"><span>ACS Promedio</span><strong>${avgACS}</strong></div>
            `;
            grid.appendChild(card);
        }
    }
    
    container.appendChild(grid);
}

function configurarEncabezadosOrdenables() {
    document.querySelectorAll('th').forEach(th => {
        th.style.cursor = 'pointer';
        th.title = 'Haz clic para ordenar';
        th.addEventListener('click', () => {
            const columna = th.innerText.replace(' ▲', '').replace(' ▼', '').trim();
            if (columnaOrdenada === columna) {
                ordenAscendente = !ordenAscendente;
            } else {
                columnaOrdenada = columna;
                ordenAscendente = false; 
            }
            actualizarTablaGeneral();
        });
    });
}

function actualizarIndicadoresEncabezado() {
    document.querySelectorAll('th').forEach(th => {
        let textoBase = th.innerText.replace(' ▲', '').replace(' ▼', '');
        if (textoBase === columnaOrdenada) {
            th.innerText = textoBase + (ordenAscendente ? ' ▲' : ' ▼');
            th.style.color = '#ff4655'; 
        } else {
            th.innerText = textoBase;
            th.style.color = '#9ca3af'; 
        }
    });
}