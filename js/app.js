/**
 * js/app.js - Sistema GRASP de Monitoreo Regional
 * Versión Final: TSM, SSM con Mapa de Calor (TXT), Zoom, Grillado y Eje X Multilínea.
 */

// --- 1. CONFIGURACIÓN DEL MAPA ---
const map = L.map('map').setView([-10.0, -77.0], 5);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
}).addTo(map);

// --- 2. DEFINICIÓN DE ESTACIONES ---
const estaciones = [
    { nombre: 'TUMBES', lat: -3.50, lon: -80.46, colIndex: 8 },    
    { nombre: 'PAITA', lat: -5.08, lon: -81.11, colIndex: 9 },     
    { nombre: 'SAN JOSÉ', lat: -6.76, lon: -79.96, colIndex: 10 }, 
    { nombre: 'CHICAMA', lat: -7.70, lon: -79.43, colIndex: 11 },  
    { nombre: 'HUANCHACO', lat: -8.08, lon: -79.12, colIndex: 12 },
    { nombre: 'CHIMBOTE', lat: -9.08, lon: -78.60, colIndex: 13 }, 
    { nombre: 'HUACHO', lat: -11.12, lon: -77.61, colIndex: 14 },  
    { nombre: 'CALLAO', lat: -12.06458, lon: -77.15577, colIndex: 15 }, 
    { nombre: 'PISCO', lat: -13.71, lon: -76.22, colIndex: 16 },   
    { nombre: 'ILO', lat: -17.65, lon: -71.35, colIndex: 17 }      
];

// --- 3. VARIABLES DE ESTADO ---
const modal = document.getElementById('stationModal');
const btnResetZoom = document.getElementById('btnResetZoom');
const OPACIDAD_FONDO = 0.6; // Opacidad definida para la paleta SSM

let chartInstance = null;
let globalData = { TSM: { fechas: [], valores: [] }, SSM: { fechas: [], valores: [] } };
let estacionActual = '';
let currentTab = 'TSM';
let paletaRGB = [];

// --- 4. GESTIÓN DE PALETA DE COLORES (TXT) ---
async function cargarPaleta() {
    try {
        const response = await fetch("Paleta_colores/paleta_salinidad.txt");
        const texto = await response.text();
        
        paletaRGB = texto.split(/\r?\n/).filter(l => l.trim() !== '').map(l => {
            const rgb = l.trim().split(/\s+/).map(n => Math.floor(parseFloat(n) * 255));
            return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${OPACIDAD_FONDO})`;
        });
        console.log("Paleta cargada exitosamente.");
    } catch(e) {
        console.error("Error al cargar la paleta, usando esquema de respaldo:", e);
        paletaRGB = [`rgba(0,0,255,${OPACIDAD_FONDO})`, `rgba(255,0,0,${OPACIDAD_FONDO})`];
    }
}
cargarPaleta();

// --- 5. INTERFAZ Y MODAL ---
estaciones.forEach(est => {
    const marker = L.marker([est.lat, est.lon]).addTo(map);
    marker.bindTooltip(est.nombre);
    marker.on('click', () => abrirModal(est));
});

function abrirModal(estacion) {
    modal.style.display = "block";
    estacionActual = estacion.nombre;
    btnResetZoom.style.display = "none";
    
    document.getElementById('info-nombre').innerText = estacion.nombre;
    document.getElementById('info-lat').innerText = estacion.lat;
    document.getElementById('info-lon').innerText = estacion.lon;
    
    cargarDatosYGraficar(estacion);
}

function cerrarModal() { 
    modal.style.display = "none"; 
}

// --- 6. MOTOR GRÁFICO (CHART.JS) ---
const pluginFondo = {
    id: 'fondoPersonalizado',
    beforeDraw: (chart) => {
        const { ctx, chartArea } = chart;
        if (!chartArea || currentTab !== 'SSM' || paletaRGB.length < 2) return;
        
        ctx.save();
        const grad = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        paletaRGB.forEach((c, i) => grad.addColorStop(i / (paletaRGB.length - 1), c));
        
        ctx.fillStyle = grad;
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
        ctx.restore();
    }
};

function renderChart() {
    const ctx = document.getElementById('tsmChart').getContext('2d');
    
    // DESTRUCCIÓN DE INSTANCIA PREVIA PARA EVITAR SOLAPAMIENTO
    if (chartInstance) chartInstance.destroy();
    
    const isSSM = currentTab === 'SSM';
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: globalData[currentTab].fechas,
            datasets: [{
                label: `${currentTab} - ${estacionActual}`,
                data: globalData[currentTab].valores,
                borderColor: '#000000',
                borderWidth: 1.5,
                fill: false,
                tension: 0.1,
                pointRadius: 1.5,
                pointBackgroundColor: '#000000'
            }]
        },
        plugins: [pluginFondo],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                zoom: {
                    zoom: { 
                        drag: { enabled: true, backgroundColor: 'rgba(200,200,200,0.3)' }, 
                        mode: 'x', 
                        onZoomComplete: () => btnResetZoom.style.display = "block" 
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Meses' },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: false, // Forzamos a no borrar etiquetas automáticamente
                        callback: function(val) {
                            const f = this.getLabelForValue(val);
                            if (!f) return null;
                            const [y, m, d] = f.split('-');
                            
                            // Mostrar la etiqueta de texto solo si es el día 01
                            if (d === '01') {
                                const mesNom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1];
                                // ¡AQUÍ ESTÁ EL CAMBIO! 
                                // Si es enero (01), devuelve un ARREGLO para forzar el salto de línea.
                                // Si es cualquier otro mes, devuelve solo el string del mes.
                                return (m === '01') ? [mesNom, y] : mesNom;
                            }
                            return null;
                        }
                    },
                    grid: {
                        display: true,
                        drawOnChartArea: true,
                        color: function(context) {
                            if (context.chart.data.labels[context.index]) {
                                const f = context.chart.data.labels[context.index];
                                const dia = f.split('-')[2];
                                // Solo dibujar la línea vertical gris si es el día 01 del mes
                                if (dia === '01') {
                                    return 'rgba(0, 0, 0, 0.1)'; 
                                }
                            }
                            // Ocultar líneas para el resto de los días
                            return 'transparent';
                        }
                    }
                },
                y: { 
                    title: { display: true, text: isSSM ? 'Salinidad (UPS)' : 'Temperatura (°C)' },
                    min: isSSM ? 25 : undefined, 
                    max: isSSM ? 36 : undefined 
                }
            }
        }
    });
}

// --- 7. CARGA DE DATOS (EXCEL) ---
async function cargarDatosYGraficar(est) {
    try {
        const res = await fetch("data/TSM_is.xlsx");
        const ab = await res.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        
        const h1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        const h2 = wb.SheetNames.length > 1 ? XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { header: 1 }) : [];
        
        globalData.TSM = procesarHoja(h1, est.colIndex);
        globalData.SSM = procesarHoja(h2, est.colIndex);
        
        renderChart();
    } catch (e) {
        console.error("Error al procesar el archivo Excel:", e);
    }
}

function procesarHoja(d, c) {
    const f = [], v = [];
    for(let i=1; i<d.length; i++) {
        if(d[i][c] !== undefined && d[i][1] >= 2025) {
            // Aseguramos formato estricto YYYY-MM-DD para el split del eje X
            const anio = d[i][1];
            const mes = String(d[i][2]).padStart(2, '0');
            const dia = String(d[i][7]).padStart(2, '0');
            
            f.push(`${anio}-${mes}-${dia}`);
            v.push(parseFloat(d[i][c]));
        }
    }
    return { fechas: f, valores: v };
}

// --- 8. INTERACCIÓN DE PESTAÑAS Y ZOOM ---
function cambiarPestana(t) {
    currentTab = t;
    document.getElementById('tab-TSM').classList.toggle('active', t === 'TSM');
    document.getElementById('tab-SSM').classList.toggle('active', t === 'SSM');
    renderChart();
}

btnResetZoom.addEventListener('click', () => {
    chartInstance.resetZoom();
    btnResetZoom.style.display = "none";
});