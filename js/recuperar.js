import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, confirmPasswordReset, verifyPasswordResetCode } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// 1. Obtener el código de operación (oobCode) de la URL
const urlParams = new URLSearchParams(window.location.search);
const oobCode = urlParams.get('oobCode');

// Verificación inicial del código al cargar la página
if (oobCode) {
    verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
            document.getElementById('user-email-info').innerText = `Restableciendo cuenta: ${email}`;
        })
        .catch(() => {
            Swal.fire({
                title: 'Enlace inválido',
                text: 'El enlace ha expirado o ya fue utilizado.',
                icon: 'error',
                confirmButtonColor: '#6366f1',
                background: '#1e293b',
                color: '#f8fafc'
            }).then(() => window.location.href = 'index.html');
        });
} else {
    window.location.href = 'index.html';
}

// 2. Lógica del botón de actualizar
document.getElementById('btn-reset').onclick = async () => {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword.length < 6) {
        return Swal.fire('Error', 'La contraseña debe tener al menos 6 caracteres.', 'error');
    }

    if (newPassword !== confirmPassword) {
        return Swal.fire('Error', 'Las contraseñas no coinciden.', 'error');
    }

    try {
        await confirmPasswordReset(auth, oobCode, newPassword);
        await Swal.fire({
            title: '¡Contraseña actualizada!',
            text: 'Ya puedes iniciar sesión con tu nueva clave.',
            icon: 'success',
            confirmButtonColor: '#6366f1',
            background: '#1e293b',
            color: '#f8fafc'
        });
        window.location.href = 'index.html';
    } catch (error) {
        Swal.fire('Error', 'No se pudo actualizar la contraseña. Revisa el enlace.', 'error');
    }
};