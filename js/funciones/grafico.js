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
            
            // FONDO BLANCO PURO PARA EVITAR TRANSPARENCIAS EN EXPORTACIÓN
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            
            // MAPA DE CALOR
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

// --- EXPORTACIÓN CON SINCRONIZACIÓN DE RENDERIZADO ---
export function exportarGrafico(formato, estacionActual, currentTab) {
    if (!chartInstance) return;

    const canvas = document.getElementById('tsmChart');
    const contenedor = canvas.parentElement; 
    const nombreArchivo = `${currentTab}_${estacionActual}`;

    // Paso previo para navegadores estrictos: abrimos la ventana de impresión al instante
    let ventanaImpresion = null;
    if (formato === 'print') {
        ventanaImpresion = window.open('', '', 'width=1000,height=700');
        ventanaImpresion.document.write('<html><body style="font-family:sans-serif; text-align:center; padding-top:20%;"><h2>Preparando gráfico en alta definición...</h2></body></html>');
    }

    // 1. Congelamos el tamaño CSS para que el gráfico no salte en la pantalla
    contenedor.style.width = contenedor.clientWidth + 'px';
    contenedor.style.height = contenedor.clientHeight + 'px';

    // 2. Multiplicamos la resolución interna del canvas (4x es ideal para calidad de tesis sin colapsar la RAM)
    const originalRatio = chartInstance.options.devicePixelRatio || window.devicePixelRatio;
    chartInstance.options.devicePixelRatio = 4;
    chartInstance.update('none');

    // 3. Pausa de 300ms. Le damos tiempo al procesador para redibujar en 4x antes de tomar la captura
    setTimeout(() => {
        const mimeType = formato === 'jpeg' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, 1.0);

        if (formato === 'print') {
            ventanaImpresion.document.open();
            ventanaImpresion.document.write(`<html><head><title>Imprimir - ${nombreArchivo}</title></head><body style="text-align:center; padding: 20px;"><img src="${dataUrl}" style="max-width:100%; height:auto;"></body></html>`);
            ventanaImpresion.document.close();
            ventanaImpresion.focus();
            setTimeout(() => { ventanaImpresion.print(); ventanaImpresion.close(); }, 500);
            
        } else if (formato === 'pdf') {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: "landscape" });
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth() - 20; 
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            pdf.addImage(dataUrl, formato === 'jpeg' ? 'JPEG' : 'PNG', 10, 15, pdfWidth, pdfHeight);
            pdf.save(`${nombreArchivo}.pdf`);
            
        } else {
            const enlace = document.createElement('a');
            enlace.download = `${nombreArchivo}.${formato}`;
            enlace.href = dataUrl;
            enlace.click();
        }

        // 4. Restauramos todo a la normalidad para que la página siga siendo rápida
        chartInstance.options.devicePixelRatio = originalRatio;
        chartInstance.update('none');
        contenedor.style.width = '100%';
        contenedor.style.height = '400px';

    }, 300);
}