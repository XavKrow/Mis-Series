import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// ESPERAR A QUE EL DOM ESTÉ LISTO
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar tema inicial
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark-mode');
    }

    // 2. Configurar botón de modo oscuro
    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDark);
            location.reload(); // Recarga para actualizar colores de Chart.js
        });
    }

    // 3. Configurar botón de PDF
    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
        btnDownload.addEventListener('click', descargarReporte);
    }
});

// --- PROTECCIÓN DE RUTA Y CARGA DE DATOS ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const q = query(collection(db, "series"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        procesarDatos(querySnapshot);
    } else {
        window.location.replace("index.html");
    }
});

function procesarDatos(snapshot) {
    let totalMinutos = 0;
    let totalCapitulos = 0;
    let estados = { viendo: 0, terminada: 0, pendiente: 0 };

    snapshot.forEach(doc => {
        const data = doc.data();
        const duracion = data.duracionEpisodio || 30;
        const vistos = data.vistosGlobal || 0;
        
        totalMinutos += (vistos * duracion);
        totalCapitulos += vistos;

        const est = vistos >= data.totalCapsSerie ? "terminada" : (vistos > 0 ? "viendo" : "pendiente");
        estados[est]++;
    });

    // Formatear tiempo: Xh Ym
    const horas = Math.floor(totalMinutos / 60);
    const mins = totalMinutos % 60;

    document.getElementById('total-vistos').innerText = totalCapitulos;
    document.getElementById('tiempo-total').innerText = `${horas}h ${mins}m`;

    const ctx = document.getElementById('chartReporte').getContext('2d');
    const colorTexto = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#000';

    new Chart(ctx, {
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
    
    // Detectar si estamos en modo oscuro para el fondo del PDF
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();

    try {
        const canvas = await html2canvas(element, { 
            scale: 2,
            backgroundColor: backgroundColor,
            logging: false,
            useCORS: true
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        // Si es modo oscuro, pintamos el fondo de la página de negro/azul oscuro antes de poner la imagen
        if (isDarkMode) {
            pdf.setFillColor(15, 23, 42); // Color aproximado a tu --bg oscuro
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        }

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        pdf.save('Reporte_Series.pdf');
    } catch (err) {
        console.error("Error al generar PDF:", err);
    }
}