const map = L.map('map').setView([-10.0, -77.0], 5);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
}).addTo(map);

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

const modal = document.getElementById('stationModal');
const btnResetZoom = document.getElementById('btnResetZoom');
let chartInstance = null;
let excelDataCache = null; 

estaciones.forEach(est => {
    const marker = L.marker([est.lat, est.lon]).addTo(map);
    marker.bindTooltip(`Estación ${est.nombre}`);

    marker.on('click', function() {
        abrirModal(est);
    });
});

function abrirModal(estacion) {
    modal.style.display = "block";
    btnResetZoom.style.display = "none"; 
    
    document.getElementById('info-nombre').innerText = estacion.nombre;
    document.getElementById('info-lat').innerText = estacion.lat;
    document.getElementById('info-lon').innerText = estacion.lon;

    cargarDatosYGraficar(estacion);
}

function cerrarModal() {
    modal.style.display = "none";
}

btnResetZoom.addEventListener('click', () => {
    if (chartInstance) {
        chartInstance.resetZoom();
        btnResetZoom.style.display = "none";
    }
});

async function cargarDatosYGraficar(estacion) {
    try {
        if (!excelDataCache) {
            const response = await fetch("data/TSM_is.xlsx"); 
            const arrayBuffer = await response.arrayBuffer();
            
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const primeraHojaNombre = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[primeraHojaNombre];
            
            excelDataCache = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        }
        
        const fechas = [];
        const tsm = [];
        const col = estacion.colIndex;

        for (let i = 1; i < excelDataCache.length; i++) {
            const fila = excelDataCache[i];

            if (fila.length > col && fila[col] !== undefined && fila[col] !== null && fila[col] !== "") {
                const anio = fila[1];
                const mes = String(fila[2]).padStart(2, '0');
                const dia = String(fila[7]).padStart(2, '0');
                const valorTSM = parseFloat(fila[col]);

                if (!isNaN(valorTSM) && anio && fila[2] && fila[7]) {
                    if (parseInt(anio) >= 2025) {
                        const fechaFormateada = `${anio}-${mes}-${dia}`;
                        fechas.push(fechaFormateada);
                        tsm.push(valorTSM);
                    }
                }
            }
        }

        renderChart(fechas, tsm, estacion.nombre);

    } catch (error) {
        console.error("Error al procesar los datos:", error);
        alert("No se pudo cargar data/TSM_is.xlsx.");
    }
}

// Plugin personalizado para asegurar fondo blanco en las exportaciones
const pluginFondoBlanco = {
    id: 'fondoBlanco',
    beforeDraw: (chart) => {
        const ctx = chart.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
};

function renderChart(fechas, tsmValores, nombreEstacion) {
    const ctx = document.getElementById('tsmChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [{
                label: `TSM (°C) - ${nombreEstacion}`,
                data: tsmValores,
                borderColor: '#5ea2d8',
                backgroundColor: 'rgba(94, 162, 216, 0.4)',
                borderWidth: 2,
                fill: false, 
                tension: 0.1,
                pointRadius: 2
            }]
        },
        plugins: [pluginFondoBlanco], // Activamos el plugin de fondo blanco
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: `Estación ${nombreEstacion} - TSM (Desde 2025)`, font: { size: 16 } },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) { return tooltipItems[0].label; }
                    }
                },
                zoom: {
                    zoom: {
                        drag: {
                            enabled: true,
                            backgroundColor: 'rgba(94, 162, 216, 0.3)'
                        },
                        mode: 'x', 
                        onZoomComplete: function({chart}) {
                            btnResetZoom.style.display = "block";
                        }
                    }
                }
            },
            scales: {
                y: { title: { display: true, text: 'Temperatura (°C)' } },
                x: { 
                    title: { display: true, text: 'Meses' },
                    ticks: {
                        maxRotation: 0, 
                        autoSkip: false, 
                        callback: function(value, index, ticks) {
                            const fecha = this.getLabelForValue(value);
                            if (!fecha) return null;
                            const [anio, mes, dia] = fecha.split('-');
                            const mesNum = parseInt(mes) - 1; 
                            const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                            if (index === 0) return [nombresMeses[mesNum], anio];

                            const fechaAnterior = this.getLabelForValue(ticks[index - 1].value);
                            if (!fechaAnterior) return null;
                            
                            const mesAnterior = fechaAnterior.split('-')[1];
                            if (mes !== mesAnterior) {
                                if (mes === '01') return [nombresMeses[mesNum], anio];
                                return nombresMeses[mesNum];
                            }
                            return null; 
                        }
                    }
                }
            }
        }
    });
}

// --- LÓGICA DE EXPORTACIÓN ---

function getNombreArchivoBase() {
    const estacion = document.getElementById('info-nombre').innerText;
    return `Grafico_TSM_${estacion}`;
}

// Función auxiliar para forzar la descarga de imágenes
function descargarImagen(url, nombreArchivo) {
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 1. Descargar PNG
document.getElementById('exportPNG').addEventListener('click', (e) => {
    e.preventDefault();
    if (chartInstance) {
        const url = chartInstance.toBase64Image('image/png', 1);
        descargarImagen(url, `${getNombreArchivoBase()}.png`);
    }
});

// 2. Descargar JPEG
document.getElementById('exportJPEG').addEventListener('click', (e) => {
    e.preventDefault();
    if (chartInstance) {
        const url = chartInstance.toBase64Image('image/jpeg', 1);
        descargarImagen(url, `${getNombreArchivoBase()}.jpg`);
    }
});

// 3. Descargar PDF
document.getElementById('exportPDF').addEventListener('click', (e) => {
    e.preventDefault();
    if (chartInstance) {
        const canvas = document.getElementById('tsmChart');
        // Usamos la imagen en JPEG para aligerar el PDF
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        const { jsPDF } = window.jspdf;
        // Formato horizontal ('l' = landscape)
        const pdf = new jsPDF('l', 'mm', 'a4'); 
        
        // Calcular dimensiones para mantener proporción
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        // (imagen, formato, x, y, ancho, alto)
        pdf.addImage(imgData, 'JPEG', 0, 20, pdfWidth, pdfHeight); 
        pdf.save(`${getNombreArchivoBase()}.pdf`);
    }
});

// 4. Imprimir Gráfico
document.getElementById('exportPrint').addEventListener('click', (e) => {
    e.preventDefault();
    if (chartInstance) {
        const canvas = document.getElementById('tsmChart');
        const dataUrl = canvas.toDataURL('image/png');
        const ventanaImpresion = window.open('', '_blank');
        
        ventanaImpresion.document.write(`
            <html>
                <head>
                    <title>Imprimir Gráfico - ${getNombreArchivoBase()}</title>
                    <style>
                        body { margin: 0; padding: 20px; text-align: center; font-family: Arial, sans-serif; }
                        img { max-width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    <img src="${dataUrl}">
                    <script>
                        // Esperar a que la imagen cargue antes de lanzar el diálogo de impresión
                        window.onload = function() { 
                            window.print(); 
                            // Opcional: cerrar la ventana después de imprimir
                            // window.close(); 
                        };
                    <\/script>
                </body>
            </html>
        `);
        ventanaImpresion.document.close();
    }
});