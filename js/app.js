import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, getDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---
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
let currentSerieId = "", quickActionType = "", editId = null, currentColeccion = "";
let cacheNombres = {}; // Para no pedir el mismo nombre muchas veces

// Configuración para alertas normales
const swalConfig = {
    background: 'var(--card-bg)',
    color: 'var(--text-main)',
    confirmButtonColor: 'var(--primary)'
};

// Configuración para notificaciones rápidas
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    background: 'var(--card-bg)', 
    color: 'var(--text-main)',
    iconColor: 'var(--primary)', 
    didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    }
});

// --- 2. PROTECCIÓN DE RUTA Y SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) { 
        currentUser = user; 
        try {
            const userRef = doc(db, "users_public", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    email: user.email.toLowerCase(),
                    uid: user.uid,
                    nombre: user.displayName || user.email.split('@')[0],
                    createdAt: Date.now()
                });
            }
        } catch (e) { console.error("Error en perfilado:", e); }

        const isDark = localStorage.getItem('darkMode') === 'true';
        if (isDark) document.documentElement.classList.add('dark-mode');
        actualizarIconoVisual(isDark);
        cargarSeries(); 
    } else if (!window.location.pathname.includes('index.html')) {
        window.location.href = "index.html"; 
    }
});

// --- 3. LÓGICA DE LA API (TMDB) ---
const inputName = document.getElementById('serie-name');
if (inputName) {
    inputName.oninput = async (e) => {
        const busqueda = e.target.value;
        if (busqueda.length < 3) return;
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${API_KEY}&language=es-MX&query=${encodeURIComponent(busqueda)}`);
            const data = await res.json();
            if (data.results?.length > 0) {
                const serie = data.results[0];
                serieSeleccionadaAPI = serie;
                document.getElementById('serie-img').value = `https://image.tmdb.org/t/p/w500${serie.poster_path}`;
                const resD = await fetch(`https://api.themoviedb.org/3/tv/${serie.id}?api_key=${API_KEY}&language=es-MX`);
                const dataD = await resD.json();
                document.getElementById('serie-map').value = dataD.seasons.filter(s => s.season_number > 0).map(s => s.episode_count || 10).join(', ');
            }
        } catch (error) { console.error("Error API:", error); }
    };
}

// --- 4. GESTIÓN DE DATOS (CRUD) ---
const btnSave = document.getElementById('btn-save');
if (btnSave) {
    btnSave.onclick = async () => {
        const nombre = document.getElementById('serie-name').value;
        const mapaTexto = document.getElementById('serie-map').value;
        const urlImg = document.getElementById('serie-img').value;

        if(nombre && mapaTexto && currentUser) {
            const mapaCapitulos = mapaTexto.split(',').map(n => parseInt(n.trim()));
            await addDoc(collection(db, "series"), {
                userId: currentUser.uid,
                nombre, mapaCapitulos,
                imagen: urlImg || "https://placehold.co/300x450/1e293b/white?text=Sin+Portada",
                tempActual: 1, capActual: 0, vistosGlobal: 0,
                totalCapsSerie: mapaCapitulos.reduce((a, b) => a + b, 0),
                valoracion: 0, timestamp: Date.now()
            });
            ['serie-name', 'serie-map', 'serie-img'].forEach(id => document.getElementById(id).value = "");
            Toast.fire({ icon: 'success', title: 'Serie agregada' });
        }
    };
}

function cargarSeries() {
    const qPers = query(collection(db, "series"), where("userId", "==", currentUser.uid));
    const qColab = query(collection(db, "series_colaborativas"), where("usuarios", "array-contains", currentUser.uid));
    onSnapshot(qPers, (snap) => renderizarGrid(snap, 'series-container', true));
    onSnapshot(qColab, (snap) => renderizarGrid(snap, 'colaborativas-container', false));
}

function renderizarGrid(snapshot, containerId, esPersonal) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (snapshot.empty) {
        container.innerHTML = `<div class="empty-state"><p>No hay series aquí</p></div>`;
        return;
    }

    container.innerHTML = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const capsDeEstaTemp = data.mapaCapitulos[data.tempActual - 1];
        const porcentaje = Math.round((data.vistosGlobal / data.totalCapsSerie) * 100);
        const estado = data.vistosGlobal >= data.totalCapsSerie ? "terminada" : (data.vistosGlobal > 0 ? "viendo" : "pendiente");
        const coleccion = esPersonal ? "series" : "series_colaborativas";

        let badgeColab = "";
        if (!esPersonal) {
            const uids = data.usuarios || [];
            const socioUID = uids.find(uid => uid !== currentUser.uid);
            
            // Creamos un ID único para el contenedor del nombre del socio
            const spanId = `nombre-socio-${id}`;

            // Función autoejecutable para buscar el nombre en tiempo real
            if (socioUID) {
                if (cacheNombres[socioUID]) {
                    // Si ya lo tenemos en caché, lo usamos
                    setTimeout(() => {
                        const el = document.getElementById(spanId);
                        if (el) el.innerText = `Con: ${cacheNombres[socioUID]}`;
                    }, 0);
                } else {
                    // Si no, hacemos un getDoc (o podrías usar onSnapshot para ese usuario específico)
                    getDoc(doc(db, "users_public", socioUID)).then(userSnap => {
                        if (userSnap.exists()) {
                            const nombreReal = userSnap.data().nombre;
                            cacheNombres[socioUID] = nombreReal;
                            const el = document.getElementById(spanId);
                            if (el) el.innerText = `Con: ${nombreReal}`;
                        }
                    });
                }
            }

            badgeColab = `
                <div class="colab-badge">
                    <span class="material-symbols-outlined">group</span>
                    <span id="${spanId}">Cargando socio...</span>
                </div>
            `;
        }

        return `
            <div class="card ${estado}" style="position: relative;" data-fecha="${data.timestamp}" data-nombre="${data.nombre.toLowerCase()}" data-progreso="${porcentaje}" data-valoracion="${data.valoracion || 0}" data-capitulos="${data.totalCapsSerie || 0}">
                ${badgeColab}
                <img src="${data.imagen}" class="card-img">
                <div class="card-content">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3>${data.nombre}</h3>
                        <span class="status-badge">${estado}</span>
                    </div>
                    <div class="temp-info">
                        <b>Temp ${data.tempActual} / ${data.mapaCapitulos.length}</b><br>
                        <span>Cap: ${data.capActual} / ${capsDeEstaTemp}</span>
                        <div class="btn-group-edit">
                            <button class="btn-edit-small" onclick="window.editarUltimaTemp('${id}', '${coleccion}')">+1 CAP</button>
                            <button class="btn-edit-small" onclick="window.agregarTemporada('${id}', '${coleccion}')">+ TEMP</button>
                        </div>
                    </div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${porcentaje}%"></div></div>
                    <div class="stars-container">
                        ${[1,2,3,4,5].map(i => `<span class="star ${i <= data.valoracion ? 'active' : ''}" onclick="window.cambiarEstrellas('${id}', ${i}, '${coleccion}')">★</span>`).join('')}
                    </div>
                    <div class="controls">
                        <button class="btn-cap" onclick="window.modificarProgreso('${id}', -1, '${coleccion}')">-</button>
                        <div style="text-align:center">
                            <span class="pct-text" style="font-weight:800; display:block; font-size:1.1rem;">${porcentaje}%</span>
                            <small style="color:var(--text-muted);">${data.vistosGlobal}/${data.totalCapsSerie}</small>
                        </div>
                        <button class="btn-cap" onclick="window.modificarProgreso('${id}', 1, '${coleccion}')">+</button>
                    </div>
                    <div class="card-actions">
                        <button class="btn-flat btn-edit" onclick="window.abrirModalEdicion('${id}', '${coleccion}')">Editar</button>
                        ${esPersonal ? `<button class="btn-flat btn-share" onclick="window.abrirModalCompartir('${id}')">Compartir</button>` : ''}
                        <button class="btn-flat btn-delete" onclick="window.eliminarSerie('${id}', '${coleccion}')">Eliminar</button>
                    </div>
                </div>
            </div>`;
    }).join('');
    window.ordenarSeries();
}

// --- 5. BÚSQUEDA Y ORDENAMIENTO ---
window.filtrarSeries = () => {
    const termino = document.getElementById('input-busqueda').value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tarjetas = document.querySelectorAll('.card');
    tarjetas.forEach(t => {
        const nombre = t.dataset.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        t.style.display = nombre.includes(termino) ? 'block' : 'none';
    });
    window.ordenarSeries();
};

window.ordenarSeries = () => {
    const criterio = document.getElementById('sort-filter')?.value || 'recientes';
    ['series-container', 'colaborativas-container'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const tarjetas = Array.from(container.getElementsByClassName('card'));
        if (tarjetas.length === 0) return;

        tarjetas.sort((a, b) => {
            const nA = a.dataset.nombre, nB = b.dataset.nombre;
            const fA = parseInt(a.dataset.fecha), fB = parseInt(b.dataset.fecha);
            const pA = parseInt(a.dataset.progreso), pB = parseInt(b.dataset.progreso);
            const vA = parseInt(a.dataset.valoracion), vB = parseInt(b.dataset.valoracion);
            const cA = parseInt(a.dataset.capitulos), cB = parseInt(b.dataset.capitulos);

            switch (criterio) {
                case 'nombre': return nA.localeCompare(nB);
                case 'nombre-rev': return nB.localeCompare(nA);
                case 'antiguas': return fA - fB;
                case 'recientes': return fB - fA;
                case 'progreso-max': return pB - pA;
                case 'progreso-min': return pA - pB;
                case 'valoracion': return vB - vA;
                case 'capitulos': return cB - cA;
                default: return fB - fA;
            }
        });
        tarjetas.forEach(t => container.appendChild(t));
    });
};

// --- 6. MODALES Y ACCIONES ---
window.abrirModalCompartir = (id) => {
    currentSerieId = id;
    document.getElementById('share-modal').style.display = 'flex';
};

window.cerrarShareModal = () => {
    document.getElementById('share-modal').style.display = 'none';
    document.getElementById('share-email').value = "";
};

document.getElementById('btn-share-confirm').onclick = async () => {
    const emailACompartir = document.getElementById('share-email').value.toLowerCase().trim();
    if (!emailACompartir || emailACompartir === currentUser.email) {
        return Swal.fire({ ...swalConfig, title: 'Nota', text: 'Escribe un correo diferente al tuyo', icon: 'info' });
    }

    try {
        const uQuery = query(collection(db, "users_public"), where("email", "==", emailACompartir));
        const uSnap = await getDocs(uQuery);

        if (uSnap.empty) {
            window.cerrarShareModal(); 
            return Swal.fire({ ...swalConfig, title: 'No encontrado', text: 'El colaborador debe iniciar sesión y configurar su nombre primero.', icon: 'question' });
        }

        const partnerData = uSnap.docs[0].data();
        const userRef = doc(db, "users_public", currentUser.uid);
        const mySnap = await getDoc(userRef);
        
        // Obtenemos nombres reales de Firestore
        const miNombre = mySnap.exists() ? mySnap.data().nombre : (currentUser.displayName || currentUser.email.split('@')[0]);
        const suNombre = partnerData.nombre || emailACompartir.split('@')[0];

        const originalSerie = await getDoc(doc(db, "series", currentSerieId));
        
        await addDoc(collection(db, "series_colaborativas"), {
            ...originalSerie.data(),
            usuarios: [currentUser.uid, partnerData.uid],
            nombresColab: {
                [currentUser.uid]: miNombre,
                [partnerData.uid]: suNombre
            },
            esColaborativa: true,
            timestamp: Date.now()
        });

        window.cerrarShareModal();
        Swal.fire({ ...swalConfig, title: '¡Éxito!', text: 'Serie compartida', icon: 'success' });
    } catch (e) {
        console.error(e);
        window.cerrarShareModal();
        Swal.fire({ ...swalConfig, title: 'Error', text: 'No se pudo compartir la serie', icon: 'error' });
    }
};

window.abrirQuickModal = (id, tipo, titulo, etiqueta, valorInicial, coleccion) => {
    currentSerieId = id; quickActionType = tipo; currentColeccion = coleccion;
    document.getElementById('quick-modal-title').innerText = titulo;
    document.getElementById('quick-modal-label').innerText = etiqueta;
    const input = document.getElementById('quick-modal-input');
    input.value = valorInicial; input.placeholder = valorInicial;
    document.getElementById('quick-modal').style.display = 'flex';
};

window.editarUltimaTemp = async (id, coleccion) => {
    const snap = await getDoc(doc(db, coleccion, id));
    window.abrirQuickModal(id, "editarTemp", "Editar Capítulos", "Total capítulos temp:", snap.data().mapaCapitulos.slice(-1)[0], coleccion);
};

window.agregarTemporada = (id, coleccion) => window.abrirQuickModal(id, "nuevaTemp", "Nueva Temporada", "¿Cuántos capítulos?", 10, coleccion);

document.getElementById('btn-quick-confirm').onclick = async () => {
    const valor = parseInt(document.getElementById('quick-modal-input').value);
    if (isNaN(valor) || valor < 1) return;
    try {
        const docRef = doc(db, currentColeccion, currentSerieId);
        const snap = await getDoc(docRef);
        const d = snap.data();
        let nM = [...d.mapaCapitulos], nT = d.totalCapsSerie;
        if (quickActionType === "nuevaTemp") { nM.push(valor); nT += valor; }
        else { nT = (nT - nM[nM.length - 1]) + valor; nM[nM.length - 1] = valor; }
        await updateDoc(docRef, { mapaCapitulos: nM, totalCapsSerie: nT });
        window.cerrarQuickModal();
        Toast.fire({ icon: 'success', title: 'Datos actualizados' });
    } catch (e) { console.error(e); }
};

window.abrirModalEdicion = async (id, coleccion) => {
    editId = id; currentColeccion = coleccion;
    const snap = await getDoc(doc(db, coleccion, id));
    const d = snap.data();
    document.getElementById('edit-name').value = d.nombre;
    document.getElementById('edit-img').value = d.imagen;
    document.getElementById('edit-map').value = d.mapaCapitulos.join(', ');
    document.getElementById('edit-episodio-duracion').value = d.duracionEpisodio || 30;
    document.getElementById('edit-modal').style.display = 'flex';
};

document.getElementById('btn-update-confirm').onclick = async () => {
    const nM = document.getElementById('edit-map').value.split(',').map(n => parseInt(n.trim()));
    await updateDoc(doc(db, currentColeccion, editId), { 
        nombre: document.getElementById('edit-name').value,
        imagen: document.getElementById('edit-img').value,
        mapaCapitulos: nM,
        duracionEpisodio: parseInt(document.getElementById('edit-episodio-duracion').value),
        totalCapsSerie: nM.reduce((a, b) => a + b, 0) 
    });
    window.cerrarModal();
    Toast.fire({ icon: 'success', title: 'Cambios guardados' });
};

window.modificarProgreso = async (id, cambio, coleccion) => {
    const docRef = doc(db, coleccion, id);
    const snap = await getDoc(docRef);
    const d = snap.data();
    let { capActual, tempActual, vistosGlobal, mapaCapitulos, totalCapsSerie } = d;
    if (cambio > 0 && vistosGlobal < totalCapsSerie) {
        vistosGlobal++; capActual++;
        if (capActual > mapaCapitulos[tempActual - 1] && tempActual < mapaCapitulos.length) { tempActual++; capActual = 1; }
    } else if (cambio < 0 && vistosGlobal > 0) {
        vistosGlobal--; capActual--;
        if (capActual < 1 && tempActual > 1) { tempActual--; capActual = mapaCapitulos[tempActual - 1]; }
    } else return;
    await updateDoc(docRef, { capActual, tempActual, vistosGlobal });
};

window.cambiarEstrellas = async (id, n, coleccion) => {
    await updateDoc(doc(db, coleccion, id), { valoracion: n });
    Toast.fire({ icon: 'success', title: `Calificación: ${n} estrellas` });
};

window.eliminarSerie = async (id, coleccion) => {
    const res = await Swal.fire({ 
        title: '¿Eliminar serie?', 
        text: "Esta acción no se puede deshacer.",
        icon: 'warning', 
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        background: 'var(--card-bg)',
        color: 'var(--text-main)',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (res.isConfirmed) {
        await deleteDoc(doc(db, coleccion, id));
        Toast.fire({ icon: 'success', title: 'Serie eliminada' });
    }
};

window.clearInput = (id) => { 
    const input = document.getElementById(id);
    if (input) { input.value = ""; input.focus(); if (id === 'input-busqueda') window.filtrarSeries(); }
};

window.toggleDarkMode = () => { 
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    actualizarIconoVisual(isDark);
};

const actualizarIconoVisual = (isDark) => {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
};

window.cerrarModal = () => document.getElementById('edit-modal').style.display = 'none';
window.cerrarQuickModal = () => document.getElementById('quick-modal').style.display = 'none';
window.cerrarShareModal = () => document.getElementById('share-modal').style.display = 'none';
window.logout = async () => { await signOut(auth); window.location.href = "index.html"; };

window.filtrarPorTipo = () => {
    const tipo = document.getElementById('filter-type').value;
    const personalContainer = document.getElementById('series-container');
    const colabContainer = document.getElementById('colaborativas-container');
    const titlePers = document.getElementById('title-personal');
    const titleColab = document.getElementById('title-colab');
    const divider = document.querySelector('.section-title-divider');

    const d = (el, s) => el && (el.style.display = s);

    if (tipo === 'personal') {
        d(personalContainer, 'grid'); d(colabContainer, 'none');
        d(titlePers, 'flex'); d(titleColab, 'none'); d(divider, 'none');
    } else if (tipo === 'colab') {
        d(personalContainer, 'none'); d(colabContainer, 'grid');
        d(titlePers, 'none'); d(titleColab, 'flex'); d(divider, 'none');
    } else {
        d(personalContainer, 'grid'); d(colabContainer, 'grid');
        d(titlePers, 'flex'); d(titleColab, 'flex'); d(divider, 'block');
    }
};

window.cambiarMiNombre = async () => {
    if (!currentUser) return;
    try {
        const userRef = doc(db, "users_public", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const nombreActual = userSnap.exists() ? (userSnap.data().nombre || "") : (currentUser.displayName || "");

        const { value: nuevoNombre } = await Swal.fire({
            title: 'Configurar Perfil',
            input: 'text',
            inputLabel: '¿Cómo quieres que te vean los demás?',
            inputValue: nombreActual,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            ...swalConfig,
            inputValidator: (value) => {
                if (!value || value.trim().length < 2) return '¡El nombre es muy corto!';
            }
        });

        if (nuevoNombre) {
            await updateDoc(userRef, { nombre: nuevoNombre.trim() });
            Toast.fire({ icon: 'success', title: '¡Nombre actualizado!' });
        }
    } catch (error) {
        console.error(error);
        Swal.fire({ ...swalConfig, icon: 'error', title: 'Error', text: 'No se pudo conectar con la base de datos.' });
    }
};

document.getElementById('input-busqueda')?.addEventListener('input', window.filtrarSeries);
window.onclick = (e) => { if (e.target.className === 'modal-overlay') { window.cerrarModal(); window.cerrarQuickModal(); window.cerrarShareModal(); } };