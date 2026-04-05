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
            alert("¡Bienvenido de nuevo!");
            window.location.href = "dashboard.html";
        } else {
            await createUserWithEmailAndPassword(auth, email, pass);
            alert("¡Cuenta creada con éxito!");
        }
    } catch (error) {
        alert("Error: " + error.message);
    }
};