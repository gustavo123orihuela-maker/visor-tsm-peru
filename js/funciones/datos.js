// --- js/funciones/datos.js ---

// 1. Cargar Paleta
export async function cargarPaleta(opacidad) {
    try {
        const response = await fetch("Paleta_colores/paleta_salinidad.txt");
        const texto = await response.text();
        
        return texto.split(/\r?\n/).filter(l => l.trim() !== '').map(l => {
            const rgb = l.trim().split(/\s+/).map(n => Math.floor(parseFloat(n) * 255));
            return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacidad})`;
        });
    } catch(e) {
        console.error("Error al cargar la paleta:", e);
        return [`rgba(0,0,255,${opacidad})`, `rgba(255,0,0,${opacidad})`];
    }
}

// 2. Cargar y Extraer Excel
export async function cargarDatosExcel(colIndex) {
    const res = await fetch("data/TSM_is.xlsx");
    const ab = await res.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    
    const h1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const h2 = wb.SheetNames.length > 1 ? XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { header: 1 }) : [];
    
    return {
        TSM: extraer(h1, colIndex),
        SSM: extraer(h2, colIndex)
    };
}

function extraer(d, c) {
    const fechas = [], valores = [];
    for(let i=1; i<d.length; i++) {
        if(d[i][c] !== undefined && d[i][1] >= 2025) {
            const anio = d[i][1];
            const mes = String(d[i][2]).padStart(2, '0');
            const dia = String(d[i][7]).padStart(2, '0');
            fechas.push(`${anio}-${mes}-${dia}`);
            valores.push(parseFloat(d[i][c]));
        }
    }
    return { fechas, valores };
}