// --- js/app.js ---

import { cargarPaleta, cargarDatosExcel } from './funciones/datos.js';
import { dibujarGrafico, resetearZoom } from './funciones/grafico.js';

// 1. CONFIGURACIÓN DEL MAPA
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

// 2. VARIABLES DEL DOM Y ESTADO GLOBAL
const modal = document.getElementById('stationModal');
const btnResetZoom = document.getElementById('btnResetZoom');
const ctxChart = document.getElementById('tsmChart').getContext('2d');
const OPACIDAD_FONDO = 0.6;

let globalData = { TSM: { fechas: [], valores: [] }, SSM: { fechas: [], valores: [] } };
let estacionActual = '';
let currentTab = 'TSM';
let paletaRGB = [];

// 3. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
    paletaRGB = await cargarPaleta(OPACIDAD_FONDO);
    console.log("Sistema GRASP iniciado modularmente.");
    
    estaciones.forEach(est => {
        L.marker([est.lat, est.lon]).addTo(map)
         .bindTooltip(est.nombre)
         .on('click', () => abrirModal(est));
    });
});

// 4. FUNCIONES DE INTERFAZ
async function abrirModal(estacion) {
    modal.style.display = "block";
    estacionActual = estacion.nombre;
    btnResetZoom.style.display = "none";
    
    document.getElementById('info-nombre').innerText = estacion.nombre;
    document.getElementById('info-lat').innerText = estacion.lat;
    document.getElementById('info-lon').innerText = estacion.lon;
    
    try {
        globalData = await cargarDatosExcel(estacion.colIndex);
        actualizarGraficoVisual();
    } catch (e) {
        console.error("Fallo al procesar Excel:", e);
    }
}

function actualizarGraficoVisual() {
    dibujarGrafico(ctxChart, globalData, estacionActual, currentTab, paletaRGB, btnResetZoom);
}

// 5. EXPOSICIÓN AL ENTORNO GLOBAL (Para botones en HTML)
window.cerrarModal = function() {
    modal.style.display = "none";
};

window.cambiarPestana = function(t) {
    currentTab = t;
    document.getElementById('tab-TSM').classList.toggle('active', t === 'TSM');
    document.getElementById('tab-SSM').classList.toggle('active', t === 'SSM');
    actualizarGraficoVisual();
};

btnResetZoom.addEventListener('click', () => {
    resetearZoom();
    btnResetZoom.style.display = "none";
});