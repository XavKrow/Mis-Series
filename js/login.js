import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const btnAction = document.getElementById('btn-action');
const toggleAuth = document.getElementById('toggle-auth');
let isLogin = true;

// --- LÓGICA PARA MOSTRAR/OCULTAR CONTRASEÑA ---
const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');

if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
        // Cambiar tipo de input
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Cambiar icono
        togglePassword.textContent = type === 'password' ? 'visibility' : 'visibility_off';
    });
}

// Función para recuperar contraseña expuesta a window
window.recuperarPassword = async () => {
    const { value: email } = await Swal.fire({
        title: 'Recuperar Contraseña',
        input: 'email',
        inputLabel: 'Tu correo electrónico',
        inputPlaceholder: 'escribe@tu.correo',
        showCancelButton: true,
        confirmButtonText: 'Enviar enlace',
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
                text: 'Revisa tu bandeja de entrada o spam.',
                icon: 'success',
                confirmButtonColor: 'var(--brand)',
                background: 'var(--card-bg)',
                color: 'var(--text-light)'
            });
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: 'No pudimos encontrar ese correo.',
                icon: 'error',
                confirmButtonColor: 'var(--brand)',
                background: 'var(--card-bg)',
                color: 'var(--text-light)'
            });
        }
    }
};

toggleAuth.onclick = () => {
    isLogin = !isLogin;
    btnAction.innerText = isLogin ? 'Iniciar Sesión' : 'Registrarse';
    toggleAuth.innerText = isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Ingresa aquí';
};

btnAction.onclick = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if(!email || !pass) {
        Swal.fire('Atención', 'Por favor llena todos los campos', 'info');
        return;
    }

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
            
            await Swal.fire({
                title: '¡Bienvenido de nuevo!',
                text: 'Accediendo a tu panel...',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: 'var(--card-bg)',
                color: 'var(--text-main)'
            });
            
            window.location.href = "dashboard.html";
        } else {
            await createUserWithEmailAndPassword(auth, email, pass);
            
            await Swal.fire({
                title: '¡Cuenta creada!',
                text: 'Ya puedes iniciar sesión con tus credenciales.',
                icon: 'success',
                confirmButtonColor: 'var(--primary)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)'
            });
            
            location.reload(); 
        }
    } catch (error) {
        let mensajeError = "Hubo un problema al procesar tu solicitud.";
        
        if (error.code === 'auth/wrong-password') mensajeError = "Contraseña incorrecta.";
        if (error.code === 'auth/user-not-found') mensajeError = "No existe una cuenta con este correo.";
        if (error.code === 'auth/email-already-in-use') mensajeError = "Este correo ya está registrado.";
        if (error.code === 'auth/invalid-credential') mensajeError = "Credenciales inválidas.";

        Swal.fire({
            title: 'Error',
            text: mensajeError,
            icon: 'error',
            confirmButtonColor: 'var(--danger)',
            background: 'var(--card-bg)',
            color: 'var(--text-main)'
        });
    }
};