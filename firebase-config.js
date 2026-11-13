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
  // Keep the page and worker on one SDK version. Test uses a different Web
  // App in the same Firebase project so its token cache cannot revoke production.
  globalScope.flutterfire_web_sdk_version = '12.19.0';
  var basePath = '/';
  if (typeof document !== 'undefined') {
    basePath = new URL(document.baseURI).pathname;
  } else if (globalScope.registration) {
    basePath = new URL(globalScope.registration.scope).pathname;
  }
  var isTest = basePath.startsWith('/web-app-test/');
  globalScope.__FCM_BASE_PATH__ = basePath;

  globalScope.__FIREBASE_CONFIG__ = {
    apiKey: "AIzaSyCOPSiwLLBEPCqdZ0EEiPm30pUgBAc1qrc",
    authDomain: "band-calendar-6addd.firebaseapp.com",
    projectId: "band-calendar-6addd",
    storageBucket: "band-calendar-6addd.firebasestorage.app",
    messagingSenderId: "651491475722",
    appId: isTest
      ? "1:651491475722:web:d4158b722eb024fc31faf3"
      : "1:651491475722:web:3499a9c240226f9e31faf3",
    // Chiave VAPID per web push (Console Firebase → Cloud Messaging →
    // Certificati Web Push → genera chiave coppia). Non è segreta.
    vapidKey: "BM8f32Y3GHCl8-kEFhifI-SePey-YmB0VTDt2Pj6_oVUkKtp5CdBOWOWa21nAH1Uw96byuqFXKl4lC--qp3gP2k",
  };
})(typeof window !== 'undefined' ? window : self);
