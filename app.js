// Estructura de la base de datos protegida para no perder datos previos cargados
let baseDatos = JSON.parse(localStorage.getItem('valorant_squad_db')) || {};
let jugadorActivoTab = ""; // Almacena qué pestaña de jugador estamos viendo

// Variables para controlar el ordenamiento de la tabla general
let columnaOrdenada = ""; 
let ordenAscendente = false; // Por defecto ordenará de mayor a menor (descendente)

// Control de filtros temporales
let filtroTemporal = "all"; // "all" = Acumulado total, "week" = Solo los últimos 7 días

document.addEventListener("DOMContentLoaded", () => {
    const statsForm = document.getElementById('stats-form');
    const btnDelete = document.getElementById('btn-delete');
    const btnFilterAll = document.getElementById('filter-all');
    const btnFilterWeek = document.getElementById('filter-week');

    if (statsForm) statsForm.addEventListener('submit', guardarEstadisticas);
    if (btnDelete) btnDelete.addEventListener('click', borrarTodo);

    // Eventos para interactuar con los botones de tiempo
    if (btnFilterAll && btnFilterWeek) {
        btnFilterAll.addEventListener('click', () => {
            filtroTemporal = "all";
            btnFilterAll.classList.add('active');
            btnFilterWeek.classList.remove('active');
            actualizarTablaGeneral();
            renderizarPestañasAgentes();
        });

        btnFilterWeek.addEventListener('click', () => {
            filtroTemporal = "week";
            btnFilterWeek.classList.add('active');
            btnFilterAll.classList.remove('active');
            actualizarTablaGeneral();
            renderizarPestañasAgentes();
        });
    }

    // Configurar los encabezados de la tabla para que reaccionen al clic
    configurarEncabezadosOrdenables();

    // Inicializar vistas de la aplicación
    actualizarTablaGeneral();
    renderizarPestañasAgentes();
});

function guardarEstadisticas(event) {
    event.preventDefault();

    const nombre = document.getElementById('player-name').value;
    const agente = document.getElementById('agent-name').value;
    const k = parseInt(document.getElementById('kills').value) || 0;
    const d = parseInt(document.getElementById('deaths').value) || 0;
    const a = parseInt(document.getElementById('assists').value) || 0;
    const acs = parseInt(document.getElementById('acs').value) || 0;

    if (!nombre || !agente) return;

    // Respetamos la estructura original para heredar todos tus datos guardados
    if (!baseDatos[nombre]) {
        baseDatos[nombre] = {
            totales: { partidas: 0, kills: 0, deaths: 0, assists: 0, acs: 0 },
            agentes: {}
        };
    }

    if (!baseDatos[nombre].agentes[agente]) {
        baseDatos[nombre].agentes[agente] = { partidas: 0, kills: 0, deaths: 0, assists: 0, acs: 0 };
    }

    // Inicializar de forma segura la matriz histórica sin mutar lo anterior
    if (!baseDatos[nombre].historialSemanal) {
        baseDatos[nombre].historialSemanal = [];
    }

    // 1. Guardado acumulado (Los datos antiguos siguen vivos aquí y se siguen sumando)
    baseDatos[nombre].totales.partidas += 1;
    baseDatos[nombre].totales.kills += k;
    baseDatos[nombre].totales.deaths += d;
    baseDatos[nombre].totales.assists += a;
    baseDatos[nombre].totales.acs += acs;

    baseDatos[nombre].agentes[agente].partidas += 1;
    baseDatos[nombre].agentes[agente].kills += k;
    baseDatos[nombre].agentes[agente].deaths += d;
    baseDatos[nombre].agentes[agente].assists += a;
    baseDatos[nombre].agentes[agente].acs += acs;

    // 2. Nuevo guardado cronológico (Permite aislar "Esta Semana")
    baseDatos[nombre].historialSemanal.push({
        agente: agente,
        kills: k,
        deaths: d,
        assists: a,
        acs: acs,
        fecha: Date.now() // Guardamos la estampa de tiempo exacta
    });

    localStorage.setItem('valorant_squad_db', JSON.stringify(baseDatos));
    
    if (!jugadorActivoTab) jugadorActivoTab = nombre;

    // Limpiar el formulario
    document.getElementById('player-name').selectedIndex = 0;
    document.getElementById('agent-name').selectedIndex = 0;
    document.getElementById('kills').value = '';
    document.getElementById('deaths').value = '';
    document.getElementById('assists').value = '';
    document.getElementById('acs').value = '';

    actualizarTablaGeneral();
    renderizarPestañasAgentes();
}

// Función auxiliar: verifica si una partida se jugó dentro de los últimos 7 días
function esDeEstaSemana(timestampFecha) {
    const sieteDiasEnMiliesgundos = 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - timestampFecha) < sieteDiasEnMiliesgundos;
}

function configurarEncabezadosOrdenables() {
    const encabezados = document.querySelectorAll('th');
    
    encabezados.forEach(th => {
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

function actualizarTablaGeneral() {
    const tbody = document.getElementById('stats-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (Object.keys(baseDatos).length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af;">No hay datos registrados en la squad.</td></tr>`;
        return;
    }

    let listaJugadores = [];

    for (let jugador in baseDatos) {
        let datosProcesados = {};

        if (filtroTemporal === "all") {
            // Carga directa de datos acumulados históricos completos
            datosProcesados = { ...baseDatos[jugador].totales };
        } else {
            // Filtra y suma dinámicamente el historial de partidas de los últimos 7 días
            const historial = baseDatos[jugador].historialSemanal || [];
            const partidasFiltradas = historial.filter(p => esDeEstaSemana(p.fecha));

            if (partidasFiltradas.length === 0) continue; // Si no hay actividad semanal, no se renderiza

            datosProcesados = partidasFiltradas.reduce((acc, p) => {
                acc.partidas += 1;
                acc.kills += p.kills;
                acc.deaths += p.deaths;
                acc.assists += p.assists;
                acc.acs += p.acs;
                return acc;
            }, { partidas: 0, kills: 0, deaths: 0, assists: 0, acs: 0 });
        }

        if (datosProcesados.partidas === 0) continue;

        const p = datosProcesados.partidas;
        const muertesEfectivas = Math.max(1, datosProcesados.deaths);

        listaJugadores.push({
            nombre: jugador,
            partidas: p,
            kills: datosProcesados.kills,
            deaths: datosProcesados.deaths,
            assists: datosProcesados.assists,
            kd: datosProcesados.kills / muertesEfectivas,
            kdaRatio: (datosProcesados.kills + datosProcesados.assists) / muertesEfectivas,
            acs: datosProcesados.acs / p
        });
    }

    if (listaJugadores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af;">No hay partidas registradas esta semana.</td></tr>`;
        actualizarIndicadoresEncabezado();
        return;
    }

    // Algoritmo de ordenamiento
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

    // Inyección de filas calculadas
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

function renderizarPestañasAgentes() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    container.innerHTML = '';

    const listaJugadores = Object.keys(baseDatos);

    if (listaJugadores.length === 0) {
        container.innerHTML = `<p style="color: #9ca3af; text-align: center; padding: 20px;">Registra partidas para desbloquear las tarjetas de personajes.</p>`;
        return;
    }

    if (!jugadorActivoTab || !baseDatos[jugadorActivoTab]) {
        jugadorActivoTab = listaJugadores[0];
    }

    const nav = document.createElement('div');
    nav.className = 'player-tabs-nav';

    listaJugadores.forEach(jugador => {
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

    let agentesDelJugador = {};

    if (filtroTemporal === "all") {
        // Obtenemos los agentes acumulados directos de tu BD clásica
        agentesDelJugador = baseDatos[jugadorActivoTab].agentes;
    } else {
        // Calculamos de forma aislada solo los personajes usados en los últimos 7 días
        const historial = baseDatos[jugadorActivoTab].historialSemanal || [];
        const partidasFiltradas = historial.filter(p => esDeEstaSemana(p.fecha));

        partidasFiltradas.forEach(p => {
            if (!agentesDelJugador[p.agente]) {
                agentesDelJugador[p.agente] = { partidas: 0, kills: 0, deaths: 0, assists: 0, acs: 0 };
            }
            agentesDelJugador[p.agente].partidas += 1;
            agentesDelJugador[p.agente].kills += p.kills;
            agentesDelJugador[p.agente].deaths += p.deaths;
            agentesDelJugador[p.agente].assists += p.assists;
            agentesDelJugador[p.agente].acs += p.acs;
        });
    }

    if (Object.keys(agentesDelJugador).length === 0) {
        grid.innerHTML = `<p style="color: #9ca3af; padding: 10px;">Este jugador no registra partidas con personajes en este periodo.</p>`;
    } else {
        for (let agente in agentesDelJugador) {
            const data = agentesDelJugador[agente];
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

function borrarTodo() {
    if (confirm("¿Seguro que quieres borrar todo el historial (totales y agentes) de la squad?")) {
        localStorage.removeItem('valorant_squad_db');
        baseDatos = {};
        jugadorActivoTab = "";
        columnaOrdenada = "";
        actualizarTablaGeneral();
        renderizarPestañasAgentes();
    }
}