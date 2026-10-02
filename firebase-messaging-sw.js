/* Service worker per Firebase Cloud Messaging (solo notifiche in background).
 *
 * Viene registrato manualmente da index.html con uno scope relativo al
 * <base href>: l'app è pubblicata su GitHub Pages in sottopercorso
 * (/band-calendar-web-app/) e il default di Firebase (root del dominio)
 * fallirebbe con 404.
 *
 * Le notifiche sono "data-only": il server invia chiavi di traduzione
 * (titleKey, bodyKey) e parametri; i testi localizzati it/en vivono qui sotto,
 * così la notifica di sistema è già pronta nella lingua dell'utente anche a
 * app chiusa.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// firebase-config.js definisce window.__FIREBASE_CONFIG__; nel SW window non
// c'è: lo esponiamo su self prima di importarlo.
self.window = self;
importScripts('./firebase-config.js');

if (!self.__FIREBASE_CONFIG__ || self.__FIREBASE_CONFIG__.apiKey.startsWith('AIzaSyPLACEHOLDER')) {
  console.warn('[firebase-messaging-sw] firebase-config.js non è configurato: notifiche disabilitate.');
} else {
  firebase.initializeApp(self.__FIREBASE_CONFIG__);

  const messaging = firebase.messaging();

  // Messaggi ricevuti con l'app chiusa o in background: mostriamo la notifica
  // di sistema traducendo le chiavi del payload.
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw] Messaggio in background:', payload);

    const data = (payload && payload.data) || {};
    const lang = data.lang === 'en' ? 'en' : 'it';
    const strings = STRINGS[lang];

    const title = strings[data.titleKey] || strings['push.fallback.title'];
    const body = format(strings[data.bodyKey] || strings['push.fallback.body'], data);

    self.registration.showNotification(title, {
      body: body,
      icon: './icons/Icon-192.png',
      badge: './icons/Icon-192.png',
      tag: data.tag || 'band-calendar',
      renotify: false,
      data: { link: data.link || '' },
    });
  });
}

// Dizionario dei testi: le stesse chiavi usate dalle Edge Functions in
// supabase/functions/_shared/fcm.ts.
const STRINGS = {
  it: {
    'push.fallback.title': 'Band Calendar',
    'push.fallback.body': 'Hai un nuovo aggiornamento nel tuo calendario.',

    'push.invite.title': 'Nuovo invito',
    'push.invite.body': '{owner} ti ha invitato nel progetto "{project}".',
    'push.addedToProject.title': 'Aggiornamento progetto',
    'push.addedToProject.body': 'Sei stato aggiunto al progetto "{project}".',
    'push.removed.title': 'Progetto abbandonato',
    'push.removed.body': 'Sei stato rimosso dal progetto "{project}".',
    'push.projectDeleted.title': 'Progetto eliminato',
    'push.projectDeleted.body': 'Il progetto "{project}" è stato eliminato dal proprietario.',

    'push.entryCreated.title': 'Nuovo evento',
    'push.entryCreated.body': '{user} ha aggiunto un evento: {description}.',
    'push.entryUpdated.title': 'Evento modificato',
    'push.entryUpdated.body': '{user} ha modificato un evento: {description}.',
    'push.entryDeleted.title': 'Evento eliminato',
    'push.entryDeleted.body': '{user} ha eliminato un evento: {description}.',
  },
  en: {
    'push.fallback.title': 'Band Calendar',
    'push.fallback.body': 'You have a new update in your calendar.',

    'push.invite.title': 'New invitation',
    'push.invite.body': '{owner} invited you to the project "{project}".',
    'push.addedToProject.title': 'Project update',
    'push.addedToProject.body': 'You have been added to the project "{project}".',
    'push.removed.title': 'Removed from project',
    'push.removed.body': 'You have been removed from the project "{project}".',
    'push.projectDeleted.title': 'Project deleted',
    'push.projectDeleted.body': 'The project "{project}" has been deleted by the owner.',

    'push.entryCreated.title': 'New event',
    'push.entryCreated.body': '{user} added an event: {description}.',
    'push.entryUpdated.title': 'Event updated',
    'push.entryUpdated.body': '{user} updated an event: {description}.',
    'push.entryDeleted.title': 'Event deleted',
    'push.entryDeleted.body': '{user} deleted an event: {description}.',
  },
};

// Sostituisce i segnaposto {nome} con i valori in params.
function format(template, params) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params || {}, key) ? String(params[key]) : match
  );
}

// Click sulla notifica: chiude la notifica e apre (o focalizza) l'app
// sull'eventuale deep link ricevuto nel payload.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = (event.notification.data && event.notification.data.link) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se c'è già una finestra dell'app aperta, focalizzala e naviga al link.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (client.navigate && link) {
            return client.navigate(link);
          }
          return;
        }
      }
      // Nessuna finestra aperta: aprine una nuova sul link.
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    })
  );
});
