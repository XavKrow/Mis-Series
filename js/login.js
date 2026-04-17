import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

toggleAuth.onclick = () => {
    isLogin = !isLogin;
    btnAction.innerText = isLogin ? 'Iniciar Sesión' : 'Registrarse';
    toggleAuth.innerText = isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Ingresa aquí';
};

btnAction.onclick = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
            
            // Alerta de Bienvenida
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
            
            // Alerta de Registro Exitoso
            await Swal.fire({
                title: '¡Cuenta creada!',
                text: 'Ya puedes iniciar sesión con tus credenciales.',
                icon: 'success',
                confirmButtonColor: 'var(--primary)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)'
            });
            
            // Opcional: Cambiar a modo login automáticamente o redirigir
            location.reload(); 
        }
    } catch (error) {
        // Manejo de errores amigable
        let mensajeError = "Hubo un problema al procesar tu solicitud.";
        
        if (error.code === 'auth/wrong-password') mensajeError = "Contraseña incorrecta.";
        if (error.code === 'auth/user-not-found') mensajeError = "No existe una cuenta con este correo.";
        if (error.code === 'auth/email-already-in-use') mensajeError = "Este correo ya está registrado.";

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