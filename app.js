// CONFIGURACIÓN DE SUPABASE (Reemplaza con tus datos reales)
const SUPABASE_URL = "https://vacdptnjqqwncgfarfwf.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_2GFclghGWnF-dlUTCYK49A_QOuRzAcd";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de estado de la aplicación
let listaPartidasGlobal = []; // Almacenará todas las partidas bajadas de Supabase
let jugadorActivoTab = ""; 
let columnaOrdenada = ""; 
let ordenAscendente = false; 
let filtroTemporal = "all"; // "all" o "week"

document.addEventListener("DOMContentLoaded", async () => {
    const statsForm = document.getElementById('stats-form');
    const btnDelete = document.getElementById('btn-delete');
    const btnFilterAll = document.getElementById('filter-all');
    const btnFilterWeek = document.getElementById('filter-week');

    if (statsForm) statsForm.addEventListener('submit', guardarEstadisticas);
    if (btnDelete) btnDelete.addEventListener('click', borrarTodo);

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

// Obtiene todo el historial de la base de datos de Supabase
async function cargarDatosDesdeSupabase() {
    try {
        const { data, error } = await supabase
            .from('partidas')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;

        listaPartidasGlobal = data || [];
        
        // Establecer el primer jugador con datos como pestaña activa por defecto
        if (listaPartidasGlobal.length > 0 && !jugadorActivoTab) {
            jugadorActivoTab = listaPartidasGlobal[0].jugador;
        }

        procesarYRenderizarVistas();
    } catch (error) {
        console.error("Error al cargar datos:", error.message);
        alert("No se pudieron sincronizar los datos con Supabase");
    }
}

// Inserta una nueva fila en la tabla de Supabase
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
        const { error } = await supabase
            .from('partidas')
            .insert([
                { jugador: nombre, agente: agente, kills: k, deaths: d, assists: a, acs: acs }
            ]);

        if (error) throw error;

        jugadorActivoTab = nombre;

        // Limpiar el formulario
        document.getElementById('stats-form').reset();

        // Recargar datos actualizados de la nube
        await cargarDatosDesdeSupabase();

    } catch (error) {
        console.error("Error al guardar:", error.message);
        alert("Error al enviar la partida a Supabase");
    }
}

// Función auxiliar para verificar si una fecha está dentro de los últimos 7 días
function esDeEstaSemana(fechaString) {
    const fechaPartida = new Date(fechaString);
    const sieteDiasEnMilisegundos = 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - fechaPartida.getTime()) < sieteDiasEnMilisegundos;
}

// Procesa el array plano global y actualiza la Tabla e Interfaz
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

    // Agrupamos dinámicamente según el filtro activo (Acumulado o Semanal)
    let resumenJugadores = {};

    listaPartidasGlobal.forEach(partida => {
        if (filtroTemporal === "week" && !esDeEstaSemana(partida.fecha)) {
            return; // Ignorar si el filtro es semanal y la partida es vieja
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

    // Ordenamiento de columnas
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

    // Renderizado físico en la tabla
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

    // Obtener lista única de jugadores que tienen al menos una partida registrada
    const jugadoresUnicos = [...new Set(listaPartidasGlobal.map(p => p.jugador))];

    if (jugadoresUnicos.length === 0) {
        container.innerHTML = `<p style="color: #9ca3af; text-align: center; padding: 20px;">Registra partidas para desbloquear las tarjetas de personajes.</p>`;
        return;
    }

    if (!jugadorActivoTab || !jugadoresUnicos.includes(jugadorActivoTab)) {
        jugadorActivoTab = jugadoresUnicos[0];
    }

    // Renderizar botones de navegación de pestañas
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

    // Agrupar estadísticas por agente para el jugador seleccionado
    let agentesAgrupados = {};

    listaPartidasGlobal.forEach(p => {
        if (p.jugador !== jugadorActivoTab) return;
        if (filtroTemporal === "week" && !esDeEstaSemana(p.fecha)) return;

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

// Borra todas las filas de la tabla en Supabase
async function borrarTodo() {
    if (confirm("¿Seguro que quieres eliminar TODO el historial de la base de datos en Supabase?")) {
        try {
            const { error } = await supabase
                .from('partidas')
                .delete()
                .neq('id', 0); // Truco para borrar todas las filas de forma segura

            if (error) throw error;

            listaPartidasGlobal = [];
            jugadorActivoTab = "";
            columnaOrdenada = "";
            procesarYRenderizarVistas();

        } catch (error) {
            console.error("Error al vaciar BD:", error.message);
            alert("No se pudo limpiar la base de datos.");
        }
    }
}