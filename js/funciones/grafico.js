let chartInstance = null;

export function resetearZoom() {
    if (chartInstance) chartInstance.resetZoom();
}

export function dibujarGrafico(ctx, data, estacionActual, currentTab, paletaRGB, btnResetZoom) {
    if (chartInstance) chartInstance.destroy();
    
    const isSSM = currentTab === 'SSM';
    
    const pluginFondo = {
        id: 'fondoPersonalizado',
        beforeDraw: (chart) => {
            const { ctx, width, height, chartArea } = chart;
            ctx.save();
            
            // 1. FONDO BLANCO GLOBAL (Asegura que el PNG/JPEG/PDF no sea transparente ni negro)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            
            // 2. MAPA DE CALOR (Solo para SSM y dentro del área del gráfico)
            if (chartArea && currentTab === 'SSM' && paletaRGB.length > 2) {
                const grad = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                paletaRGB.forEach((c, i) => grad.addColorStop(i / (paletaRGB.length - 1), c));
                ctx.fillStyle = grad;
                ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
            }
            
            ctx.restore();
        }
    };

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data[currentTab].fechas,
            datasets: [{
                label: `${currentTab} - ${estacionActual}`,
                data: data[currentTab].valores,
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
                        autoSkip: false,
                        callback: function(val, index, ticks) {
                            const f = this.getLabelForValue(val);
                            if (!f) return null;
                            const [y, m, d] = f.split('-');
                            
                            if (d === '01') {
                                const mesNom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1];
                                
                                let esPrimerMesVisible = false;
                                for (let i = 0; i < ticks.length; i++) {
                                    const tickLabel = this.getLabelForValue(ticks[i].value);
                                    if (tickLabel && tickLabel.endsWith('-01')) {
                                        if (i === index) esPrimerMesVisible = true;
                                        break; 
                                    }
                                }
                                return (m === '01' || esPrimerMesVisible) ? [mesNom, y] : mesNom;
                            }
                            return null;
                        }
                    },
                    grid: {
                        display: true,
                        drawOnChartArea: true,
                        color: function(context) {
                            if (context.chart.data.labels[context.index]) {
                                const dia = context.chart.data.labels[context.index].split('-')[2];
                                if (dia === '01') return 'rgba(0, 0, 0, 0.1)'; 
                            }
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

// --- FUNCIÓN DE EXPORTACIÓN EN ALTA CALIDAD (600 DPI) ---
export function exportarGrafico(formato, estacionActual, currentTab) {
    if (!chartInstance) return;

    const canvas = document.getElementById('tsmChart');
    const nombreArchivo = `${currentTab}_${estacionActual}`;

    // 1. TRUCO DE RESOLUCIÓN: Guardamos la escala actual y la forzamos a 6x (Aprox 600 DPI)
    const originalRatio = chartInstance.options.devicePixelRatio || window.devicePixelRatio;
    chartInstance.options.devicePixelRatio = 6; 
    chartInstance.update('none'); // Actualizamos el gráfico sin animaciones

    // 2. CAPTURAMOS LA IMAGEN EN ALTA RESOLUCIÓN
    // Usamos el formato adecuado (JPEG se verá bien ahora porque el fondo es blanco)
    const mimeType = formato === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, 1.0);

    // 3. PROCESAMOS LA DESCARGA SEGÚN LA OPCIÓN ELEGIDA
    if (formato === 'print') {
        const ventana = window.open('', '', 'width=1000,height=700');
        ventana.document.write(`<html><head><title>Imprimir - ${nombreArchivo}</title></head><body style="text-align:center; padding: 20px;"><img src="${dataUrl}" style="max-width:100%; height:auto;"></body></html>`);
        ventana.document.close();
        ventana.focus();
        setTimeout(() => { ventana.print(); ventana.close(); }, 500); // 500ms para asegurar que la imagen pesada cargue
        
    } else if (formato === 'pdf') {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "landscape" });
        const imgProps = pdf.getImageProperties(dataUrl);
        // Margen de 10 unidades a cada lado
        const pdfWidth = pdf.internal.pageSize.getWidth() - 20; 
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        // Centramos verticalmente si es necesario, o lo ponemos desde arriba
        pdf.addImage(dataUrl, formato === 'jpeg' ? 'JPEG' : 'PNG', 10, 15, pdfWidth, pdfHeight);
        pdf.save(`${nombreArchivo}.pdf`);
        
    } else {
        // PNG o JPEG directo
        const enlace = document.createElement('a');
        enlace.download = `${nombreArchivo}.${formato}`;
        enlace.href = dataUrl;
        enlace.click();
    }

    // 4. RESTAURAMOS LA RESOLUCIÓN NORMAL
    // Esto es crucial para que al cerrar el modal tu web no consuma memoria de más
    chartInstance.options.devicePixelRatio = originalRatio;
    chartInstance.update('none');
}