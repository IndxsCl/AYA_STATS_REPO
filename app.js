// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://vacdptnjqqwncgfarfwf.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_2GFclghGWnF-dlUTCYK49A_QOuRzAcd";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de estado de la aplicación
let tiposSeleccionados = ["Premier", "Scrim", "Extra Torneo"];
let listaPartidasGlobal = [];
let jugadorActivoTab = ""; 
let columnaOrdenada = ""; 
let ordenAscendente = false; 
let filtroTemporal = "all"; 

document.addEventListener("DOMContentLoaded", async () => {
    const statsForm = document.getElementById('stats-form');
    const btnFilterAll = document.getElementById('filter-all');
    const btnFilterWeek = document.getElementById('filter-week');
    const botonesTipo = document.querySelectorAll('#type-filters .btn-filter');
    
    botonesTipo.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tipo = e.target.getAttribute('data-type');
        
        // Si el tipo ya estaba seleccionado, lo quitamos y apagamos el botón
        if (tiposSeleccionados.includes(tipo)) {
            tiposSeleccionados = tiposSeleccionados.filter(t => t !== tipo);
            e.target.classList.remove('active');
        } else {
            // Si no estaba, lo agregamos y prendemos el botón
            tiposSeleccionados.push(tipo);
            e.target.classList.add('active');
        }
        
        // Actualizamos las tablas con los nuevos filtros
        procesarYRenderizarVistas();
        });
    });

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
            .from('stats') // aqui busca la tabla 'stats'
            .select('*')
            .order('id', { ascending: false }); // Usamos id para evitar el error si no creaste created_at

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

    // 1. DEFINES TU CONTRASEÑA AQUÍ (Cámbiala por la que tú prefieras)
    const CONTRASEÑA_CORRECTA = "adwaya"; 
    // 2. Capturamos lo que escribió el usuario en el nuevo campo
    const passwordIntroducida = document.getElementById('form-password').value;

    // 3. VALIDACIÓN: Si no coincide, frenamos todo y avisamos
    if (passwordIntroducida !== CONTRASEÑA_CORRECTA) {
        alert(" Contraseña incorrecta. No tienes permiso para añadir estadísticas.");
        return; // Esto detiene la función y no envía nada a Supabase
    }

    // --- Si la clave es correcta, el código sigue corriendo de forma normal ---
    const nombre = document.getElementById('player-name').value;
    const agente = document.getElementById('agent-name').value;
    const tipoPartida = document.getElementById('match-type').value;
    const k = parseInt(document.getElementById('kills').value) || 0;
    const d = parseInt(document.getElementById('deaths').value) || 0;
    const a = parseInt(document.getElementById('assists').value) || 0;
    const acs = parseInt(document.getElementById('acs').value) || 0;

    if (!nombre || !agente) return;

    try {
        const { error } = await supabaseClient
            .from('stats')
            .insert([
                { 
                    jugador: nombre, 
                    agente: agente, 
                    kills: k, 
                    deaths: d, 
                    assists: a, 
                    acs: acs,
                    tipo_partida: tipoPartida
                }
            ]);

        if (error) throw error;

        // Si se guarda con éxito, reiniciamos el formulario (incluyendo el campo de contraseña)
        jugadorActivoTab = nombre;
        document.getElementById('stats-form').reset();
        await cargarDatosDesdeSupabase();
        alert("Partida registrada con éxito.");

    } catch (error) {
        console.error("Error al guardar:", error.message);
        alert("Error al enviar la partida a Supabase");
    }
}

// También modifica esta función para evitar que falle si no encuentra la fecha:
function esDeEstaSemana(fechaString) {
    if (!fechaString) return false; // Evita errores si created_at no viene en la respuesta
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
        const tipoDeEstaPartida = partida.tipo_partida || 'Scrim';
        if (!tiposSeleccionados.includes(tipoDeEstaPartida)) return;

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

        const tipoDeEstaPartida = p.tipo_partida || 'Premier';
        if (!tiposSeleccionados.includes(tipoDeEstaPartida)) return;

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