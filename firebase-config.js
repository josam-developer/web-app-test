// Configurazione Firebase per il web.
// ⚠️ Questo file viene eseguito in DUE contesti:
// - la finestra dell'app (via <script src="firebase-config.js"> in index.html);
// - il service worker FCM (via importScripts in firebase-messaging-sw.js,
//   che prima imposta self.window = self).
// Nel service worker non esistono window/document: il codice qui sotto è
// scritto per funzionare in entrambi i casi senza errori di valutazione.
//
// I valori sono pubblici per progetto (identificano l'app, non concedono
// accessi), esattamente come la anon key di Supabase già presente in
// lib/helpers/supabase_helper.dart.

(function (globalScope) {
  // Base path dell'app: deriva dal <base href> di index.html, così funziona
  // sia in locale (root) sia su GitHub Pages (/band-calendar-web-app/).
  // Solo nel contesto finestra: il service worker non ha document.
  if (typeof document !== 'undefined') {
    var base = document.querySelector('base');
    var href = base && base.getAttribute('href');
    if (href && href.startsWith('/') && href.endsWith('/')) {
      globalScope.__FCM_BASE_PATH__ = href;
    } else {
      globalScope.__FCM_BASE_PATH__ = '/';
    }
  }

  globalScope.__FIREBASE_CONFIG__ = {
    apiKey: "AIzaSyCOPSiwLLBEPCqdZ0EEiPm30pUgBAc1qrc",
    authDomain: "band-calendar-6addd.firebaseapp.com",
    projectId: "band-calendar-6addd",
    storageBucket: "band-calendar-6addd.firebasestorage.app",
    messagingSenderId: "651491475722",
    appId: "1:651491475722:web:3499a9c240226f9e31faf3",
    // Chiave VAPID per web push (Console Firebase → Cloud Messaging →
    // Certificati Web Push → genera chiave coppia). Non è segreta.
    vapidKey: "BM8f32Y3GHCl8-kEFhifI-SePey-YmB0VTDt2Pj6_oVUkKtp5CdBOWOWa21nAH1Uw96byuqFXKl4lC--qp3gP2k",
  };
})(typeof window !== 'undefined' ? window : self);
