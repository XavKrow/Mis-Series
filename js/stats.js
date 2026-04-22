import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. CONFIGURACIÓN ---
const firebaseConfig = {
    apiKey: "AIzaSyBxdOcs-arbue2ZMw0ov0vwYnsiYcJaWKo",
    authDomain: "misseriesapp-9ae46.firebaseapp.com",
    projectId: "misseriesapp-9ae46",
    storageBucket: "misseriesapp-9ae46.firebasestorage.app",
    messagingSenderId: "957709827456",
    appId: "1:957709827456:web:070fe276464b3fcc045565",
    measurementId: "G-XJD6D6BYYS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let miGrafico = null;

// --- 2. INICIALIZACIÓN DE INTERFAZ ---
document.addEventListener('DOMContentLoaded', () => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.documentElement.classList.add('dark-mode');
    actualizarIconoVisual(isDark);

    // Fecha del reporte
    const elFecha = document.getElementById('report-date');
    if (elFecha) {
        const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
        elFecha.innerText = `Generado el ${new Date().toLocaleDateString('es-MX', opciones)}`;
    }

    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const isDarkNow = document.documentElement.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDarkNow);
            actualizarIconoVisual(isDarkNow);
            // Recarga breve para que Chart.js actualice colores de fuente
            setTimeout(() => location.reload(), 150); 
        });
    }

    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) btnDownload.addEventListener('click', descargarReporte);
});

const actualizarIconoVisual = (isDark) => {
    const iconSpan = document.getElementById('theme-icon');
    if (iconSpan) iconSpan.textContent = isDark ? 'light_mode' : 'dark_mode';
};

// --- 3. ESCUCHADOR DE FIREBASE ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const q = query(collection(db, "series"), where("userId", "==", user.uid));
        onSnapshot(q, (snapshot) => {
            procesarEstadisticas(snapshot);
            renderizarTabla(snapshot);
        });
    } else {
        window.location.replace("index.html");
    }
});

// --- 4. LÓGICA DE NEGOCIO ---

function procesarEstadisticas(snapshot) {
    let totalMinutos = 0;
    let totalCapitulos = 0;
    let estados = { viendo: 0, terminada: 0, pendiente: 0 };

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const duracion = parseInt(data.duracionEpisodio) || 24; 
        const vistos = parseInt(data.vistosGlobal) || 0;
        
        totalMinutos += (vistos * duracion);
        totalCapitulos += vistos;

        const est = vistos >= data.totalCapsSerie ? "terminada" : (vistos > 0 ? "viendo" : "pendiente");
        estados[est]++;
    });

    const horas = Math.floor(totalMinutos / 60);
    const mins = totalMinutos % 60;

    // Actualizar UI
    document.getElementById('total-vistos').innerText = totalCapitulos;
    document.getElementById('tiempo-total').innerText = `${horas}h ${mins}m`;

    generarGrafico(estados);
}

function renderizarTabla(snapshot) {
    const tbody = document.getElementById('tabla-stats-body');
    if (!tbody) return;

    if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay datos disponibles</td></tr>';
        return;
    }

    tbody.innerHTML = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const duracion = parseInt(data.duracionEpisodio) || 24;
        const vistos = parseInt(data.vistosGlobal) || 0;
        const minutosTotales = vistos * duracion;
        
        const horas = Math.floor(minutosTotales / 60);
        const mins = minutosTotales % 60;
        const tiempoFormateado = horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;

        return `
            <tr>
                <td style="font-weight: 800; color: var(--primary);">${data.nombre}</td>
                <td class="text-center">${vistos} caps.</td>
                <td class="text-center">${duracion} min</td>
                <td class="text-center" style="font-weight: 800; color: var(--success);">${tiempoFormateado}</td>
            </tr>
        `;
    }).join('');
}

function generarGrafico(estados) {
    const canvas = document.getElementById('chartReporte');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    // Detectamos el color de texto del tema actual para la leyenda
    const colorTexto = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim();

    if (miGrafico) miGrafico.destroy();

    miGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Viendo', 'Terminadas', 'Pendientes'],
            datasets: [{
                data: [estados.viendo, estados.terminada, estados.pendiente],
                backgroundColor: ['#6366f1', '#10b981', '#94a3b8'],
                hoverOffset: 10,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: colorTexto, font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" } }
                }
            },
            cutout: '70%' // Hace el círculo más estilizado
        }
    });
}

// --- 5. GENERACIÓN DE PDF ---
async function descargarReporte() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('reporte-contenido');
    const tableContainer = document.querySelector('.table-responsive');
    
    if (!element) return;
    
    // UI Feedback: Cambiar cursor a espera
    document.body.style.cursor = 'wait';

    // Preparación para capturar tabla completa
    const originalOverflow = tableContainer ? tableContainer.style.overflow : "";
    if (tableContainer) {
        tableContainer.style.overflow = "visible";
    }

    try {
        const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        
        const canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: backgroundColor,
            scrollY: -window.scrollY
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = imgHeight;
        let position = 0;
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        
        // Colores de fondo para el PDF según el modo
        const bgColor = isDarkMode ? [15, 23, 42] : [248, 250, 252];

        const aplicarFondoYImagen = (pos) => {
            pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
            pdf.addImage(imgData, 'PNG', 0, pos, pdfWidth, imgHeight);
        };

        // Primera página
        aplicarFondoYImagen(position);
        heightLeft -= pdfHeight;

        // Páginas extras si el reporte es largo
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            aplicarFondoYImagen(position);
            heightLeft -= pdfHeight;
        }

        pdf.save(`Reporte_Series_${new Date().getTime()}.pdf`);

    } catch (err) {
        console.error("Error al generar PDF:", err);
    } finally {
        if (tableContainer) tableContainer.style.overflow = originalOverflow;
        document.body.style.cursor = 'default';
    }
}