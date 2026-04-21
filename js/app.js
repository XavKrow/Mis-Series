import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURACIÓN ---
const API_KEY = 'c3996a6520eefec7d7fb0ced15c27787';
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
let currentUser = null;
let serieSeleccionadaAPI = null;

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2000,
  timerProgressBar: true,
  background: 'var(--card-bg)',
  color: 'var(--text-main)',
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

// --- FUNCIONES DE INTERFAZ (EXTRAS) ---
const actualizarIconoVisual = (isDark) => {
    const iconSpan = document.getElementById('theme-icon');
    if (iconSpan) {
        iconSpan.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
};

// --- PROTECCIÓN DE RUTA ---
onAuthStateChanged(auth, (user) => {
    if (user) { 
        currentUser = user; 
        const isDark = localStorage.getItem('darkMode') === 'true';
        if (isDark) {
            document.documentElement.classList.add('dark-mode');
        }
        actualizarIconoVisual(isDark); // Sincroniza el icono al cargar
        cargarSeries(); 
    } else if (!window.location.pathname.includes('index.html')) {
        window.location.href = "index.html"; 
    }
});

// --- LÓGICA DE LA API ---
const inputName = document.getElementById('serie-name');
if (inputName) {
    inputName.oninput = async (e) => {
        const busqueda = e.target.value;
        if (busqueda.length < 3) return;
        try {
            const resBusqueda = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${API_KEY}&language=es-MX&query=${encodeURIComponent(busqueda)}`);
            const dataBusqueda = await resBusqueda.json();
            if (dataBusqueda.results?.length > 0) {
                const serie = dataBusqueda.results[0];
                serieSeleccionadaAPI = serie;
                document.getElementById('serie-img').value = `https://image.tmdb.org/t/p/w500${serie.poster_path}`;
                const resDetalle = await fetch(`https://api.themoviedb.org/3/tv/${serie.id}?api_key=${API_KEY}&language=es-MX`);
                const dataDetalle = await resDetalle.json();
                if (dataDetalle.seasons) {
                    document.getElementById('serie-map').value = dataDetalle.seasons
                        .filter(s => s.season_number > 0)
                        .map(s => s.episode_count || 10).join(', ');
                }
            }
        } catch (error) { console.error("Error API:", error); }
    };
}

// --- GUARDAR NUEVA SERIE ---
const btnSave = document.getElementById('btn-save');
if (btnSave) {
    btnSave.onclick = async () => {
        const nombre = document.getElementById('serie-name').value;
        const mapaTexto = document.getElementById('serie-map').value;
        const urlImg = document.getElementById('serie-img').value;

        if(nombre && mapaTexto && currentUser) {
            const mapaCapitulos = mapaTexto.split(',').map(n => parseInt(n.trim()));
            const totalCapsSerie = mapaCapitulos.reduce((a, b) => a + b, 0);
            let duracionEpisodio = serieSeleccionadaAPI?.episode_run_time?.[0] || 30;

            await addDoc(collection(db, "series"), {
                userId: currentUser.uid,
                nombre, mapaCapitulos,
                imagen: urlImg || "https://placehold.co/300x450/1e293b/white?text=Sin+Portada",
                tmdbId: serieSeleccionadaAPI?.id || null,
                duracionEpisodio,
                tempActual: 1, capActual: 0, vistosGlobal: 0,
                totalCapsSerie, valoracion: 0, timestamp: Date.now()
            });
            ['serie-name', 'serie-map', 'serie-img'].forEach(id => document.getElementById(id).value = "");
            serieSeleccionadaAPI = null;
        }
    };
}

// --- CARGAR Y RENDERIZAR SERIES ---
function cargarSeries() {
    const q = query(collection(db, "series"), where("userId", "==", currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('series-container');
        if (!container) return;

        // --- VALIDACIÓN DE EMPTY STATE ---
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">movie_filter</span>
                    <h2>¡Tu lista está vacía!</h2>
                    <p>Parece que aún no has agregado ninguna serie. ¡Empieza añadiendo una en el formulario de arriba!</p>
                </div>
            `;
            return; // Detenemos la ejecución aquí
        }

        // --- RENDERIZADO NORMAL SI HAY DATOS ---
        container.innerHTML = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const capsDeEstaTemp = data.mapaCapitulos[data.tempActual - 1];
            const porcentaje = Math.round((data.vistosGlobal / data.totalCapsSerie) * 100);
            const estado = data.vistosGlobal >= data.totalCapsSerie ? "terminada" : (data.vistosGlobal > 0 ? "viendo" : "pendiente");
            
            let estrellas = '';
            for (let i = 1; i <= 5; i++) {
                estrellas += `<span class="star ${i <= data.valoracion ? 'active' : ''}" onclick="window.cambiarEstrellas('${id}', ${i})">★</span>`;
            }

            return `
                <div class="card ${estado}" data-fecha="${data.timestamp || 0}">
                    <img src="${data.imagen}" class="card-img" alt="${data.nombre}">
                    <div class="card-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h3>${data.nombre}</h3>
                            <span class="status-badge">${estado}</span>
                        </div>
                        
                        <div class="temp-info">
                            <b>Temporada ${data.tempActual} / ${data.mapaCapitulos.length}</b><br>
                            <span>Cap: ${data.capActual} / ${capsDeEstaTemp}</span>
                            
                            <div class="btn-group-edit">
                                <button class="btn-edit-small" onclick="window.editarUltimaTemp('${id}')">+1 CAP</button>
                                <button class="btn-edit-small" onclick="window.agregarTemporada('${id}')">+ TEMP</button>
                            </div>
                        </div>

                        <div class="progress-container"><div class="progress-bar" style="width: ${porcentaje}%"></div></div>
                        <div class="stars-container">${estrellas}</div>
                        
                        <div class="controls">
                            <button class="btn-cap" onclick="window.modificarProgreso('${id}', -1)">-</button>
                            <div style="text-align:center">
                                <span class="pct-text" style="font-weight:800; display:block; font-size:1.1rem;">${porcentaje}%</span>
                                <small style="color:var(--text-muted);">${data.vistosGlobal}/${data.totalCapsSerie}</small>
                            </div>
                            <button class="btn-cap" onclick="window.modificarProgreso('${id}', 1)">+</button>
                        </div>

                        <div class="card-actions">
                            <button class="btn-flat btn-edit" onclick="window.abrirModalEdicion('${id}')">Editar serie</button>
                            <button class="btn-flat btn-delete" onclick="window.eliminarSerie('${id}')">Eliminar</button>
                        </div>
                    </div>
                </div>`;
        }).join('');
        
        ordenarSeries();
    });
}

// Función para generar el contenido del Empty State
function mostrarEstadoVacio() {
    const container = document.getElementById('series-container');
    container.innerHTML = `
        <div class="empty-state">
            <span class="material-symbols-outlined">movie_filter</span>
            <h2>¡Tu lista está vacía!</h2>
            <p>Parece que aún no has agregado ninguna serie. ¡Empieza añadiendo una en el formulario de arriba!</p>
        </div>
    `;
}

// --- MODALES ---
let currentSerieId = "", quickActionType = "", editId = null;

window.abrirModalEdicion = async (id) => {
    try {
        editId = id;
        const snap = await getDoc(doc(db, "series", id));
        if (!snap.exists()) return;
        const d = snap.data();
        document.getElementById('edit-name').value = d.nombre || "";
        document.getElementById('edit-img').value = d.imagen || "";
        document.getElementById('edit-map').value = d.mapaCapitulos?.join(', ') || "";
        const inputDur = document.getElementById('edit-episodio-duracion');
        if (inputDur) inputDur.value = d.duracionEpisodio || 30;
        document.getElementById('edit-modal').style.display = 'flex';
    } catch (error) { document.getElementById('edit-modal').style.display = 'flex'; }
};

const btnUpdate = document.getElementById('btn-update-confirm');
if (btnUpdate) {
    btnUpdate.onclick = async () => {
        const nombre = document.getElementById('edit-name').value;
        const imagen = document.getElementById('edit-img').value;
        const mapaTxt = document.getElementById('edit-map').value;
        const duracion = parseInt(document.getElementById('edit-episodio-duracion')?.value || 30);

        if (nombre && mapaTxt && editId) {
            const mapaCapitulos = mapaTxt.split(',').map(n => parseInt(n.trim()));
            await updateDoc(doc(db, "series", editId), { 
                nombre, imagen, mapaCapitulos, 
                duracionEpisodio: duracion,
                totalCapsSerie: mapaCapitulos.reduce((a, b) => a + b, 0) 
            });
            cerrarModal();
            Swal.fire({ title: '¡Actualizado!', icon: 'success', timer: 1500, showConfirmButton: false });
        }
    };
}

// --- FUNCIONES GLOBALES ---
window.cerrarModal = () => { document.getElementById('edit-modal').style.display = 'none'; editId = null; };
window.cerrarQuickModal = () => document.getElementById('quick-modal').style.display = 'none';

window.toggleDarkMode = () => { 
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    actualizarIconoVisual(isDark);
};

window.modificarProgreso = async (id, cambio) => {
    try {
        const docRef = doc(db, "series", id);
        const snap = await getDoc(docRef);
        const d = snap.data();
        let { capActual, tempActual, vistosGlobal, mapaCapitulos, totalCapsSerie } = d;

        if (cambio > 0 && vistosGlobal < totalCapsSerie) {
            vistosGlobal++; 
            capActual++;
            if (capActual > mapaCapitulos[tempActual - 1] && tempActual < mapaCapitulos.length) { 
                tempActual++; 
                capActual = 1; 
            }
        } else if (cambio < 0 && vistosGlobal > 0) {
            vistosGlobal--; 
            capActual--;
            if (capActual < 1 && tempActual > 1) { 
                tempActual--; 
                capActual = mapaCapitulos[tempActual - 1]; 
            }
        } else {
            // Si intenta sumar estando al final o restar estando en 0
            return; 
        }

        await updateDoc(docRef, { capActual, tempActual, vistosGlobal });

        // --- LANZAMOS EL TOAST DE ÉXITO ---
        Toast.fire({
            icon: 'success',
            title: cambio > 0 ? '¡Capítulo sumado!' : 'Capítulo restado',
            // Opcional: puedes mostrar el progreso actual en el mensaje
            text: `Vas en el cap. ${capActual}` 
        });

    } catch (error) {
        console.error("Error al actualizar:", error);
        
        // --- TOAST DE ERROR ---
        Toast.fire({
            icon: 'error',
            title: 'No se pudo actualizar',
            text: 'Revisa tu conexión a internet'
        });
    }
};

window.abrirQuickModal = (id, tipo, titulo, etiqueta, valorInicial) => {
    currentSerieId = id; quickActionType = tipo;
    document.getElementById('quick-modal-title').innerText = titulo;
    document.getElementById('quick-modal-label').innerText = etiqueta;
    const input = document.getElementById('quick-modal-input');
    input.value = valorInicial; input.placeholder = valorInicial;
    document.getElementById('quick-modal').style.display = 'flex';
};

const btnQuick = document.getElementById('btn-quick-confirm');
if (btnQuick) {
    btnQuick.onclick = async () => {
        const inputElement = document.getElementById('quick-modal-input');
        if (!inputElement) return;

        const valor = parseInt(inputElement.value);
        if (isNaN(valor) || valor < 0) return Swal.fire('Error', 'Número inválido', 'error');
        
        try {
            const docRef = doc(db, "series", currentSerieId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;
            const d = snap.data();

            let nuevoMapa = [...d.mapaCapitulos];
            if (quickActionType === "nuevaTemp") {
                nuevoMapa.push(valor);
                await updateDoc(docRef, { mapaCapitulos: nuevoMapa, totalCapsSerie: d.totalCapsSerie + valor });
            } else {
                const diferencia = valor - nuevoMapa[nuevoMapa.length - 1];
                nuevoMapa[nuevoMapa.length - 1] = valor;
                await updateDoc(docRef, { mapaCapitulos: nuevoMapa, totalCapsSerie: d.totalCapsSerie + diferencia });
            }
            window.cerrarQuickModal();
        } catch (error) { console.error(error); }
    };
}

window.editarUltimaTemp = async (id) => {
    const snap = await getDoc(doc(db, "series", id));
    abrirQuickModal(id, "editarTemp", "Editar Capítulos", "Nuevo total de la temporada:", snap.data().mapaCapitulos.slice(-1)[0]);
};

window.agregarTemporada = (id) => abrirQuickModal(id, "nuevaTemp", "Nueva Temporada", "¿Cuántos capítulos tiene?", 10);

window.cambiarEstrellas = async (id, n) => {
    try {
        const docRef = doc(db, "series", id);
        
        // Actualizamos en Firebase
        await updateDoc(docRef, { valoracion: n });

        // Lanzamos el Toast de éxito
        Toast.fire({
            icon: 'success',
            title: `Valoración: ${n} ${n === 1 ? 'estrella' : 'estrellas'}`,
            // Un pequeño toque extra: cambiar el color del icono del Toast
            iconColor: 'var(--warning)' 
        });

    } catch (error) {
        console.error("Error al calificar:", error);
        
        Toast.fire({
            icon: 'error',
            title: 'No se pudo guardar la nota',
            background: 'var(--card-bg)',
            color: 'var(--danger)'
        });
    }
};

window.eliminarSerie = async (id) => {
    const isDark = document.documentElement.classList.contains('dark-mode');
    const res = await Swal.fire({ 
        title: '¿Eliminar?', icon: 'warning', showCancelButton: true,
        background: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000'
    });
    if (res.isConfirmed) await deleteDoc(doc(db, "series", id));
};

window.logout = async () => { await signOut(auth); window.location.href = "index.html"; };

window.ordenarSeries = () => {
    const criterio = document.getElementById('sort-filter')?.value || 'recientes';
    const container = document.getElementById('series-container');
    const tarjetas = Array.from(container.getElementsByClassName('card'));
    tarjetas.sort((a, b) => {
        const getVal = (el, sel) => el.querySelector(sel)?.innerText.toLowerCase() || "";
        switch (criterio) {
            case 'nombre': return getVal(a, 'h3').localeCompare(getVal(b, 'h3'));
            case 'progreso-max': return parseInt(getVal(b, '.pct-text')) - parseInt(getVal(a, '.pct-text'));
            case 'antiguas': return parseInt(a.dataset.fecha) - parseInt(b.dataset.fecha);
            default: return parseInt(b.dataset.fecha) - parseInt(a.dataset.fecha);
        }
    });
    tarjetas.forEach(t => container.appendChild(t));
};

window.onclick = (e) => { if (e.target.className === 'modal-overlay') { window.cerrarModal(); window.cerrarQuickModal(); } };