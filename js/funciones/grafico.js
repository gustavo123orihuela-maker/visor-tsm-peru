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
                            
                            // Analizamos solo los días que marcan el inicio de mes (01)
                            if (d === '01') {
                                const mesNom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1];
                                
                                // MÁGIA DEL ZOOM: Buscamos cuál es el PRIMER día '01' visible en el gráfico actual
                                let esPrimerMesVisible = false;
                                for (let i = 0; i < ticks.length; i++) {
                                    const tickLabel = this.getLabelForValue(ticks[i].value);
                                    if (tickLabel && tickLabel.endsWith('-01')) {
                                        // Si el índice actual es el primero que encontramos, ¡bingo!
                                        if (i === index) esPrimerMesVisible = true;
                                        break; 
                                    }
                                }

                                // Muestra el Año debajo del mes si: es Enero O es el primer mes visible en el zoom
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