import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- UTILIDADES ---
const actualizarIconoVisual = (isDark) => {
    const iconSpan = document.getElementById('theme-icon');
    if (iconSpan) {
        iconSpan.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
};

// --- INICIALIZACIÓN DE INTERFAZ ---
document.addEventListener('DOMContentLoaded', () => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.documentElement.classList.add('dark-mode');
    actualizarIconoVisual(isDark);

    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const isDarkNow = document.documentElement.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDarkNow);
            actualizarIconoVisual(isDarkNow);
            setTimeout(() => location.reload(), 100); 
        });
    }

    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) btnDownload.addEventListener('click', descargarReporte);
});

// --- CARGA DE DATOS EN TIEMPO REAL ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const q = query(collection(db, "series"), where("userId", "==", user.uid));
        
        // onSnapshot mantiene los stats actualizados si cambias algo en otra pestaña
        onSnapshot(q, (snapshot) => {
            procesarEstadisticas(snapshot);
            renderizarTabla(snapshot);
        });
    } else {
        window.location.replace("index.html");
    }
});

// --- LÓGICA DE NEGOCIO ---

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

    // Actualizar contadores superiores
    const elVistos = document.getElementById('total-vistos');
    const elTiempo = document.getElementById('tiempo-total');
    if(elVistos) elVistos.innerText = totalCapitulos;
    if(elTiempo) elTiempo.innerText = `${horas}h ${mins}m`;

    generarGrafico(estados);
}

function renderizarTabla(snapshot) {
    const tbody = document.getElementById('tabla-stats-body');
    if (!tbody) return;

    if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No hay datos aún.</td></tr>';
        return;
    }

    // Solo generamos los TR, nada de DIVs o TABLEs extra aquí
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
                <td>${vistos} caps.</td>
                <td>${duracion} min</td>
                <td class="time-highlight">${tiempoFormateado}</td>
            </tr>
        `;
    }).join('');
}

let miGrafico = null; // Variable para resetear el gráfico y que no se encime
function generarGrafico(estados) {
    const canvas = document.getElementById('chartReporte');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const colorTexto = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#000';

    if (miGrafico) miGrafico.destroy(); // Destruir gráfico previo para evitar bugs visuales

    miGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Viendo', 'Terminadas', 'Pendientes'],
            datasets: [{
                data: [estados.viendo, estados.terminada, estados.pendiente],
                backgroundColor: ['#6366f1', '#10b981', '#94a3b8'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: colorTexto, font: { size: 14, weight: 'bold' } }
                }
            }
        }
    });
}

async function descargarReporte() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('reporte-contenido');
    const tableContainer = document.querySelector('.table-container');
    
    if (!element) return;
    
    // Preparación para capturar todo el contenido
    const originalStyle = tableContainer ? tableContainer.style.overflow : "";
    if (tableContainer) {
        tableContainer.style.overflow = "visible";
        tableContainer.style.height = "auto";
    }

    try {
        const canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
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
        const bgColor = isDarkMode ? [15, 23, 42] : [248, 250, 252]; // [R, G, B] aproximados a tus variables

        // FUNCIÓN PARA PINTAR FONDO (Evita el fondo blanco en páginas extra)
        const pintarFondo = () => {
            if (isDarkMode) {
                pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
            }
        };

        // Primera página
        pintarFondo();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Páginas adicionales
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pintarFondo(); // Pintamos el fondo oscuro en la nueva página
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save('Reporte_Series_Completo.pdf');

    } catch (err) {
        console.error("Error al generar PDF:", err);
    } finally {
        if (tableContainer) {
            tableContainer.style.overflow = originalStyle;
        }
    }
}