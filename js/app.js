import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- PROTECCIÓN DE RUTA ---
onAuthStateChanged(auth, (user) => {
    if (user) { 
        currentUser = user; 
        cargarSeries(); 
    } else { 
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = "index.html"; 
        }
    }
});

// --- GUARDAR NUEVA SERIE ---
document.getElementById('btn-save').onclick = async () => {
    const nombre = document.getElementById('serie-name').value;
    const mapaTexto = document.getElementById('serie-map').value;
    const urlImg = document.getElementById('serie-img').value;

    if(nombre && mapaTexto && currentUser) {
        const mapaCapitulos = mapaTexto.split(',').map(n => parseInt(n.trim()));
        const totalCapsSerie = mapaCapitulos.reduce((a, b) => a + b, 0);

        await addDoc(collection(db, "series"), {
            userId: currentUser.uid,
            nombre,
            mapaCapitulos,
            imagen: urlImg || "https://placehold.co/300x450/1e293b/white?text=Sin+Portada",
            tempActual: 1,
            capActual: 0,
            vistosGlobal: 0,
            totalCapsSerie,
            valoracion: 0,
            timestamp: Date.now()
        });
        
        ['serie-name', 'serie-map', 'serie-img'].forEach(id => document.getElementById(id).value = "");
    }
};

// --- CARGAR Y RENDERIZAR SERIES ---
function cargarSeries() {
    const q = query(collection(db, "series"), where("userId", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('series-container');
        container.innerHTML = "";
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const capsDeEstaTemp = data.mapaCapitulos[data.tempActual - 1];
            const porcentaje = Math.round((data.vistosGlobal / data.totalCapsSerie) * 100);
            const estado = data.vistosGlobal >= data.totalCapsSerie ? "terminada" : (data.vistosGlobal > 0 ? "viendo" : "pendiente");

            let estrellasHtml = '';
            for (let i = 1; i <= 5; i++) {
                estrellasHtml += `<span class="star ${i <= data.valoracion ? 'active' : ''}" onclick="cambiarEstrellas('${id}', ${i})">★</span>`;
            }

            container.innerHTML += `
                <div class="card ${estado}" data-fecha="${data.timestamp || 0}">
                    <img src="${data.imagen}" class="card-img" alt="${data.nombre}">
                    <div class="card-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h3>${data.nombre}</h3>
                            <span class="status-badge">${estado}</span>
                        </div>
                        
                        <div class="temp-info">
                            <div class="btn-group-edit">
                                <button class="btn-edit-small" onclick="editarUltimaTemp('${id}')">+1 CAP</button>
                                <button class="btn-edit-small" onclick="agregarTemporada('${id}')">+ TEMP</button>
                            </div>
                            <b>Temporada ${data.tempActual} / ${data.mapaCapitulos.length}</b><br>
                            <span>Cap: ${data.capActual} / ${capsDeEstaTemp}</span>
                        </div>

                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${porcentaje}%"></div>
                        </div>

                        <div class="stars-container">${estrellasHtml}</div>
                        
                        <div class="controls">
                            <button class="btn-cap" onclick="modificarProgreso('${id}', -1)">-</button>
                            <div style="text-align:center">
                                <span class="pct-text" style="font-weight:800; display:block; font-size:1.1rem;">${porcentaje}%</span>
                                <small style="color:var(--text-muted);">${data.vistosGlobal}/${data.totalCapsSerie}</small>
                            </div>
                            <button class="btn-cap" onclick="modificarProgreso('${id}', 1)">+</button>
                        </div>

                        <div class="card-actions">
                            <button class="btn-flat btn-edit" onclick="abrirModalEdicion('${id}')">Editar serie</button>
                            <button class="btn-flat btn-delete" onclick="eliminarSerie('${id}')">Eliminar</button>
                        </div>
                    </div>
                </div>`;
        });
        ordenarSeries();
    });
}

// --- FUNCIONES GLOBALES ---

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

window.filtrarSeries = () => {
    const busqueda = document.getElementById('search-bar').value.toLowerCase();
    document.querySelectorAll('.card').forEach(card => {
        const titulo = card.querySelector('h3').innerText.toLowerCase();
        card.style.display = titulo.includes(busqueda) ? "block" : "none";
    });
};

window.ordenarSeries = () => {
    const criterio = document.getElementById('sort-filter').value;
    const container = document.getElementById('series-container');
    const tarjetas = Array.from(container.getElementsByClassName('card'));
    
    if(tarjetas.length === 0) return;
    
    tarjetas.sort((a, b) => {
        const getVal = (el, sel) => el.querySelector(sel).innerText.toLowerCase();
        switch (criterio) {
            case 'nombre': return getVal(a, 'h3').localeCompare(getVal(b, 'h3'));
            case 'nombre-rev': return getVal(b, 'h3').localeCompare(getVal(a, 'h3'));
            case 'progreso-max': return parseInt(getVal(b, '.pct-text')) - parseInt(getVal(a, '.pct-text'));
            case 'progreso-min': return parseInt(getVal(a, '.pct-text')) - parseInt(getVal(b, '.pct-text'));
            case 'valoracion': return b.querySelectorAll('.star.active').length - a.querySelectorAll('.star.active').length;
            case 'antiguas': return parseInt(a.dataset.fecha) - parseInt(b.dataset.fecha);
            default: return parseInt(b.dataset.fecha) - parseInt(a.dataset.fecha);
        }
    });
    tarjetas.forEach(t => container.appendChild(t));
};

window.modificarProgreso = async (id, cambio) => {
    const docRef = doc(db, "series", id);
    const snap = await getDoc(docRef);
    const d = snap.data();
    let { capActual, tempActual, vistosGlobal, mapaCapitulos, totalCapsSerie } = d;

    if (cambio > 0 && vistosGlobal < totalCapsSerie) {
        vistosGlobal++; capActual++;
        if (capActual > mapaCapitulos[tempActual - 1] && tempActual < mapaCapitulos.length) {
            tempActual++; capActual = 1;
        }
    } else if (cambio < 0 && vistosGlobal > 0) {
        vistosGlobal--; capActual--;
        if (capActual < 1 && tempActual > 1) {
            tempActual--; capActual = mapaCapitulos[tempActual - 1];
        }
    }
    await updateDoc(docRef, { capActual, tempActual, vistosGlobal });
};

// --- MODALES (Rápido y Edición) ---
let currentSerieId = "", quickActionType = "", editId = null;

window.abrirQuickModal = (id, tipo, titulo, etiqueta, valorInicial) => {
    currentSerieId = id; quickActionType = tipo;
    document.getElementById('quick-modal-title').innerText = titulo;
    document.getElementById('quick-modal-label').innerText = etiqueta;
    const input = document.getElementById('quick-modal-input');
    input.value = valorInicial; input.placeholder = valorInicial;
    document.getElementById('quick-modal').style.display = 'flex';
};

window.cerrarQuickModal = () => document.getElementById('quick-modal').style.display = 'none';

document.getElementById('btn-quick-confirm').onclick = async () => {
    const valor = parseInt(document.getElementById('quick-modal-input').value);
    if (isNaN(valor) || valor < 0) return Swal.fire('Error', 'Ingresa un número válido', 'error');

    const docRef = doc(db, "series", currentSerieId);
    const d = (await getDoc(docRef)).data();
    let nuevoMapa = [...d.mapaCapitulos];

    if (quickActionType === "nuevaTemp") {
        nuevoMapa.push(valor);
        await updateDoc(docRef, { mapaCapitulos: nuevoMapa, totalCapsSerie: d.totalCapsSerie + valor });
    } else {
        const diferencia = valor - nuevoMapa[nuevoMapa.length - 1];
        nuevoMapa[nuevoMapa.length - 1] = valor;
        await updateDoc(docRef, { mapaCapitulos: nuevoMapa, totalCapsSerie: d.totalCapsSerie + diferencia });
    }
    cerrarQuickModal();
};

window.agregarTemporada = (id) => abrirQuickModal(id, "nuevaTemp", "Nueva Temporada", "¿Cuántos capítulos tiene?", 10);

window.editarUltimaTemp = async (id) => {
    const snap = await getDoc(doc(db, "series", id));
    abrirQuickModal(id, "editarTemp", "Editar Capítulos", "Nuevo total de la temporada:", snap.data().mapaCapitulos.slice(-1)[0]);
};

window.abrirModalEdicion = async (id) => {
    editId = id;
    const d = (await getDoc(doc(db, "series", id))).data();
    document.getElementById('edit-name').value = d.nombre;
    document.getElementById('edit-img').value = d.imagen;
    document.getElementById('edit-map').value = d.mapaCapitulos.join(', ');
    document.getElementById('edit-modal').style.display = 'flex';
};

window.cerrarModal = () => { document.getElementById('edit-modal').style.display = 'none'; editId = null; };

document.getElementById('btn-update-confirm').onclick = async () => {
    const nombre = document.getElementById('edit-name').value;
    const imagen = document.getElementById('edit-img').value;
    const mapaTxt = document.getElementById('edit-map').value;

    if (nombre && mapaTxt && editId) {
        const mapaCapitulos = mapaTxt.split(',').map(n => parseInt(n.trim()));
        await updateDoc(doc(db, "series", editId), { nombre, imagen, mapaCapitulos, totalCapsSerie: mapaCapitulos.reduce((a, b) => a + b, 0) });
        cerrarModal();
        Swal.fire({ title: '¡Actualizado!', icon: 'success', timer: 1500, showConfirmButton: false, background: 'var(--card-bg)', color: 'var(--text-main)' });
    }
};

window.cambiarEstrellas = async (id, n) => await updateDoc(doc(db, "series", id), { valoracion: n });

window.eliminarSerie = async (id) => {
    const res = await Swal.fire({ title: '¿Eliminar serie?', text: "Esta acción es irreversible", icon: 'warning', showCancelButton: true, confirmButtonColor: 'var(--danger)', confirmButtonText: 'Sí, eliminar', background: 'var(--card-bg)', color: 'var(--text-main)' });
    if (res.isConfirmed) {
        await deleteDoc(doc(db, "series", id));
        Swal.fire({ title: 'Eliminado', icon: 'success', timer: 1000, showConfirmButton: false });
    }
};

window.logout = () => signOut(auth);

// Cierres de modal genéricos
window.onclick = (e) => {
    if (e.target.className === 'modal-overlay') { cerrarModal(); cerrarQuickModal(); }
};
window.onkeydown = (e) => {
    if (e.key === 'Escape') { cerrarModal(); cerrarQuickModal(); }
};