import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- 2. ELEMENTOS DE LA INTERFAZ ---
const btnAction = document.getElementById('btn-action');
const toggleAuth = document.getElementById('toggle-auth');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');
const clearEmailBtn = document.getElementById('clear-email');

let isLogin = true;

// --- 3. LÓGICA DE INTERFAZ RÁPIDA ---

// Mostrar/Ocultar Contraseña
if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.textContent = type === 'password' ? 'visibility' : 'visibility_off';
    });
}

// Borrar Email Rápido
if (clearEmailBtn && emailInput) {
    clearEmailBtn.addEventListener('click', () => {
        emailInput.value = "";
        emailInput.focus();
    });
}

// --- 3.5 NUEVO: ESCUCHAR TECLA ENTER ---
const handleEnterKey = (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Evita comportamientos extraños del navegador
        btnAction.click();      // Simula el clic en el botón principal
    }
};

// Aplicamos el listener a ambos campos
emailInput?.addEventListener('keydown', handleEnterKey);
passwordInput?.addEventListener('keydown', handleEnterKey);


// Alternar entre Login y Registro
toggleAuth.onclick = () => {
    isLogin = !isLogin;
    const highlightText = isLogin ? 'Regístrate aquí' : 'Ingresa aquí';
    
    btnAction.innerText = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
    toggleAuth.innerHTML = isLogin 
        ? `¿No tienes cuenta? <span class="highlight">${highlightText}</span>` 
        : `¿Ya tienes cuenta? <span class="highlight">${highlightText}</span>`;
    
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.innerText = isLogin 
            ? "Gestiona tu progreso de forma inteligente" 
            : "Únete a la mejor comunidad de seriéfilos";
    }
};

// --- 4. LÓGICA DE FIREBASE ---

// Recuperar Contraseña
window.recuperarPassword = async () => {
    const { value: email } = await Swal.fire({
        title: 'Recuperar Contraseña',
        input: 'email',
        inputLabel: 'Tu correo electrónico',
        confirmButtonText: 'Enviar enlace',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--brand)',
        background: 'var(--card-bg)', 
        color: 'var(--text-light)'
    });

    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            Swal.fire({
                title: '¡Correo enviado!',
                text: 'Revisa tu bandeja de entrada.',
                icon: 'success',
                confirmButtonColor: 'var(--brand)',
                background: 'var(--card-bg)',
                color: 'var(--text-light)'
            });
        } catch (error) {
            Swal.fire({ title: 'Error', text: 'No pudimos procesar la solicitud.', icon: 'error', background: 'var(--card-bg)', color: 'var(--text-light)' });
        }
    }
};

// Acción Principal (Login / Registro)
btnAction.onclick = async () => {
    const email = emailInput.value;
    const pass = passwordInput.value;

    if(!email || !pass) {
        Swal.fire({ title: 'Atención', text: 'Por favor llena todos los datos', icon: 'info', background: 'var(--card-bg)', color: 'var(--text-light)' });
        return;
    }

    try {
        if (isLogin) {
            // INICIO DE SESIÓN
            await signInWithEmailAndPassword(auth, email, pass);
            
            await Swal.fire({
                title: '¡Bienvenido de nuevo!',
                text: 'Accediendo a tu panel personal...',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: 'var(--card-bg)',
                color: 'var(--text-light)'
            });

            window.location.href = "dashboard.html";
        } else {
            // REGISTRO
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            await setDoc(doc(db, "users_public", user.uid), {
                email: email.toLowerCase(),
                uid: user.uid,
                createdAt: Date.now()
            });

            await Swal.fire({
                title: '¡Cuenta creada!',
                text: 'Ya puedes acceder a tu panel personal y compartir series.',
                icon: 'success',
                confirmButtonColor: 'var(--brand)',
                background: 'var(--card-bg)',
                color: 'var(--text-light)'
            });
            location.reload(); 
        }
    } catch (error) {
        let mensajeError = "Hubo un problema al procesar tu solicitud.";
        
        const errorMap = {
            'auth/wrong-password': "Contraseña incorrecta.",
            'auth/user-not-found': "No existe una cuenta con este correo.",
            'auth/email-already-in-use': "Este correo ya está registrado.",
            'auth/invalid-credential': "Credenciales inválidas.",
            'auth/weak-password': "La contraseña debe tener al menos 6 caracteres."
        };

        mensajeError = errorMap[error.code] || mensajeError;

        Swal.fire({
            title: 'Error de autenticación',
            text: mensajeError,
            icon: 'error',
            confirmButtonColor: 'var(--danger)',
            background: 'var(--card-bg)',
            color: 'var(--text-light)'
        });
    }
};

document.getElementById('link-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.recuperarPassword();
});