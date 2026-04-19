import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

onAuthStateChanged(auth, (user) => {
    if (user) { 
        currentUser = user; 
        cargarSeries(); 
    } else { 
        // Si no hay usuario y no estamos en el login, redirigir
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = "index.html"; 
        }
    }
});

// Función para recuperar contraseña (usando SweetAlert2)
window.recuperarPassword = async () => {
    const { value: email } = await Swal.fire({
        title: 'Recuperar Contraseña',
        input: 'email',
        inputLabel: 'Ingresa tu correo electrónico',
        inputPlaceholder: 'ejemplo@correo.com',
        showCancelButton: true,
        confirmButtonText: 'Enviar enlace',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--primary)',
        background: 'var(--card-bg)',
        color: 'var(--text-main)',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
        }
    });

    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            Swal.fire({
                title: '¡Correo enviado!',
                text: 'Revisa tu bandeja de entrada (y la carpeta de spam).',
                icon: 'success',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                confirmButtonColor: 'var(--primary)'
            });
        } catch (error) {
            let mensaje = "No pudimos enviar el correo.";
            if (error.code === 'auth/user-not-found') mensaje = "No hay ninguna cuenta registrada con ese correo.";
            
            Swal.fire({
                title: 'Error',
                text: mensaje,
                icon: 'error',
                background: 'var(--card-bg)',
                color: 'var(--text-main)'
            });
        }
    }
};

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
            nombre: nombre,
            mapaCapitulos: mapaCapitulos,
            imagen: urlImg || "https://placehold.co/300x450/1e293b/white?text=Sin+Portada",
            tempActual: 1,
            capActual: 0,
            vistosGlobal: 0,
            totalCapsSerie: totalCapsSerie,
            valoracion: 0,
            timestamp: Date.now()
        });
        document.getElementById('serie-name').value = "";
        document.getElementById('serie-map').value = "";
        document.getElementById('serie-img').value = "";
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
            let estado = data.vistosGlobal >= data.totalCapsSerie ? "terminada" : (data.vistosGlobal > 0 ? "viendo" : "pendiente");

            let estrellasHtml = '';
            for (let i = 1; i <= 5; i++) {
                estrellasHtml += `<span class="star ${i <= data.valoracion ? 'active' : ''}" onclick="cambiarEstrellas('${id}', ${i})">★</span>`;
            }

            container.innerHTML += `
                <div class="card ${estado}" data-fecha="${data.timestamp || 0}">
                    <img src="${data.imagen || 'https://placehold.co/300x450/1e293b/white?text=Sin+Portada'}" class="card-img">
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

                        <div style="display:flex; gap:10px; margin-top:20px; padding-top:15px; border-top:1px solid var(--border-color);">
                            <button onclick="abrirModalEdicion('${id}')" style="border:none; background:none; cursor:pointer; flex:1; font-size:0.75rem; color:var(--primary); text-decoration:underline; font-weight:700;">
                                Editar serie
                            </button>
                            <button onclick="eliminarSerie('${id}')" style="border:none; background:none; cursor:pointer; flex:1; font-size:0.75rem; color:var(--text-muted); text-decoration:underline;">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>`;
        });
        ordenarSeries();
    });
}

// --- FUNCIONES GLOBALES (Expuestas a Window) ---

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
        const nombreA = a.querySelector('h3').innerText.toLowerCase();
        const nombreB = b.querySelector('h3').innerText.toLowerCase();
        const pctA = parseInt(a.querySelector('.pct-text').innerText);
        const pctB = parseInt(b.querySelector('.pct-text').innerText);
        const estrellasA = a.querySelectorAll('.star.active').length;
        const estrellasB = b.querySelectorAll('.star.active').length;
        const fechaA = parseInt(a.dataset.fecha);
        const fechaB = parseInt(b.dataset.fecha);
        const totalA = parseInt(a.querySelector('small').innerText.split('/')[1]);
        const totalB = parseInt(b.querySelector('small').innerText.split('/')[1]);
        switch (criterio) {
            case 'nombre': return nombreA.localeCompare(nombreB);
            case 'nombre-rev': return nombreB.localeCompare(nombreA);
            case 'progreso-max': return pctB - pctA;
            case 'progreso-min': return pctA - pctB;
            case 'valoracion': return estrellasB - estrellasA;
            case 'capitulos': return totalB - totalA;
            case 'antiguas': return fechaA - fechaB;
            default: return fechaB - fechaA;
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
        if (capActual > mapaCapitulos[tempActual - 1]) {
            if (tempActual < mapaCapitulos.length) { tempActual++; capActual = 1; }
        }
    } else if (cambio < 0 && vistosGlobal > 0) {
        vistosGlobal--; capActual--;
        if (capActual < 1 && tempActual > 1) {
            tempActual--; capActual = mapaCapitulos[tempActual - 1];
        }
    }
    await updateDoc(docRef, { capActual, tempActual, vistosGlobal });
};

let quickActionType = ""; // Para saber qué estamos haciendo (temp o caps)
let currentSerieId = "";

// Función para abrir el modal rápido
window.abrirQuickModal = (id, tipo, titulo, etiqueta, valorInicial) => {
    currentSerieId = id;
    quickActionType = tipo;
    document.getElementById('quick-modal-title').innerText = titulo;
    document.getElementById('quick-modal-label').innerText = etiqueta;
    document.getElementById('quick-modal-input').value = valorInicial;
    document.getElementById('quick-modal-input').placeholder = valorInicial;
    document.getElementById('quick-modal').style.display = 'flex';
};

window.cerrarQuickModal = () => {
    document.getElementById('quick-modal').style.display = 'none';
};

// Acción al confirmar en el modal rápido
document.getElementById('btn-quick-confirm').onclick = async () => {
    const valor = parseInt(document.getElementById('quick-modal-input').value);
    if (isNaN(valor) || valor < 0) return alert("Ingresa un número válido");

    const docRef = doc(db, "series", currentSerieId);
    const snap = await getDoc(docRef);
    const d = snap.data();

    if (quickActionType === "nuevaTemp") {
        const nuevoMapa = [...d.mapaCapitulos, valor];
        await updateDoc(docRef, { 
            mapaCapitulos: nuevoMapa, 
            totalCapsSerie: d.totalCapsSerie + valor 
        });
    } 
    else if (quickActionType === "editarTemp") {
        let nuevoMapa = [...d.mapaCapitulos];
        const ultimaPos = nuevoMapa.length - 1;
        const diferencia = valor - nuevoMapa[ultimaPos];
        nuevoMapa[ultimaPos] = valor;
        await updateDoc(docRef, { 
            mapaCapitulos: nuevoMapa, 
            totalCapsSerie: d.totalCapsSerie + diferencia 
        });
    }

    cerrarQuickModal();
};

// REEMPLAZA tus antiguas funciones por estas llamadas:
window.agregarTemporada = (id) => {
    abrirQuickModal(id, "nuevaTemp", "Nueva Temporada", "¿Cuántos capítulos tiene?", 10);
};

window.editarUltimaTemp = async (id) => {
    const snap = await getDoc(doc(db, "series", id));
    const actual = snap.data().mapaCapitulos.slice(-1)[0];
    abrirQuickModal(id, "editarTemp", "Editar Capítulos", "Nuevo total de la temporada:", actual);
};

// Variable global para saber qué serie estamos editando
let editId = null;

window.abrirModalEdicion = async (id) => {
    editId = id;
    const docRef = doc(db, "series", id);
    const snap = await getDoc(docRef);
    const data = snap.data();

    // Rellenar los campos del modal con la info actual
    document.getElementById('edit-name').value = data.nombre;
    document.getElementById('edit-img').value = data.imagen;
    document.getElementById('edit-map').value = data.mapaCapitulos.join(', ');

    // Mostrar el modal
    document.getElementById('edit-modal').style.display = 'flex';
};

window.cerrarModal = () => {
    document.getElementById('edit-modal').style.display = 'none';
    editId = null;
};

// Acción de guardar dentro del modal
document.getElementById('btn-update-confirm').onclick = async () => {
    if (!editId) return;

    const nuevoNombre = document.getElementById('edit-name').value;
    const nuevaImg = document.getElementById('edit-img').value;
    const nuevoMapaTxt = document.getElementById('edit-map').value;

    if (nuevoNombre && nuevoMapaTxt) {
        const nuevoMapa = nuevoMapaTxt.split(',').map(n => parseInt(n.trim()));
        const nuevoTotal = nuevoMapa.reduce((a, b) => a + b, 0);

        const docRef = doc(db, "series", editId);
        await updateDoc(docRef, {
            nombre: nuevoNombre,
            imagen: nuevaImg,
            mapaCapitulos: nuevoMapa,
            totalCapsSerie: nuevoTotal
        });

        cerrarModal();
        Swal.fire({
            title: '¡Actualizado!',
            text: 'Los cambios se guardaron correctamente',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: 'var(--card-bg)',
            color: 'var(--text-main)'
        });
    }
};

// Cerrar modal si hacen clic fuera del cuadro blanco
window.onclick = (event) => {
    const editModal = document.getElementById('edit-modal');
    const quickModal = document.getElementById('quick-modal');
    
    if (event.target == editModal) cerrarModal();
    if (event.target == quickModal) cerrarQuickModal();
};

// Cerrar modales con la tecla Escape
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        cerrarModal();
        cerrarQuickModal();
    }
});

window.cambiarEstrellas = async (id, n) => { await updateDoc(doc(db, "series", id), { valoracion: n }); };

window.eliminarSerie = async (id) => {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¡No podrás revertir esto!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        cancelButtonColor: 'var(--text-muted)',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: 'var(--card-bg)',
        color: 'var(--text-main)'
    });

    if (result.isConfirmed) {
        await deleteDoc(doc(db, "series", id));
        Swal.fire({
            title: '¡Eliminado!',
            icon: 'success',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            timer: 1500,
            showConfirmButton: false
        });
    }
};

window.logout = () => signOut(auth); // Corrección: Ahora expuesta a window