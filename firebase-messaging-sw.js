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

    // Le EF mandano `typeKey` (es. push.type.live): il valore è nel dizionario
    // della lingua del destinatario, non nel payload (che è uno solo).
    const params = Object.assign({}, data);
    if (params.typeKey) {
      params.type = strings[params.typeKey] || params.typeKey;
    }

    const title = format(strings[data.titleKey] || strings['push.fallback.title'], params)
      || strings['push.fallback.title'];
    const body = format(strings[data.bodyKey] || strings['push.fallback.body'], params)
      || strings['push.fallback.body'];

    self.registration.showNotification(title, {
      body: body,
      icon: './icons/Icon-notification.png',
      badge: './icons/Icon-notification.png',
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
    'push.ownershipTransferred.title': 'Nuovo proprietario',
    'push.ownershipTransferred.body': 'Ora sei il proprietario del progetto "{project}".',

    'push.entryCreated.title': '{project} · Nuovo evento',
    // `{details}` è opzionale e include il separatore iniziale quando presente
    // (es. ' · Garage (Milano)'), così il body non ha separatori orfani.
    'push.entryCreated.body': '{date} · {type}{details}',
    'push.entryUpdated.title': '{project} · Evento modificato',
    'push.entryUpdated.body': '{date} · {type}{details}',
    'push.entryDeleted.title': '{project} · Evento eliminato',
    'push.entryDeleted.body': '{date} · {type}{details}',
    // Tipo di entry: la EF manda `typeKey` e il valore viene risolto qui
    // perché il payload è unico per tutte le lingue.
    'push.type.live': 'Live',
    'push.type.proof': 'Prova',
    'push.type.availability': 'Disponibilità',
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
    'push.ownershipTransferred.title': 'New owner',
    'push.ownershipTransferred.body': 'You are now the owner of the project "{project}".',

    'push.entryCreated.title': '{project} · New event',
    // `{details}` optional, includes its leading separator when present
    // (e.g. ' · Garage (Milano)').
    'push.entryCreated.body': '{date} · {type}{details}',
    'push.entryUpdated.title': '{project} · Event updated',
    'push.entryUpdated.body': '{date} · {type}{details}',
    'push.entryDeleted.title': '{project} · Event deleted',
    'push.entryDeleted.body': '{date} · {type}{details}',
    // Entry type: the EF sends `typeKey`, resolved here because the payload
    // is shared across langs.
    'push.type.live': 'Live',
    'push.type.proof': 'Rehearsal',
    'push.type.availability': 'Availability',
  },
};

// Sostituisce i segnaposto {nome} con i valori in params. I segnaposto
// senza valore diventano stringa vuota (niente "{date}" letterale se una EF
// non è ancora stata ridistribuita), poi rimuove i separatori "·" orfani.
function format(template, params) {
  if (!template) return '';
  return template
    .replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(params || {}, key) ? String(params[key]) : ''
    )
    .replace(/\s*·\s*·/g, ' · ')
    .replace(/^\s*·\s*/, '')
    .replace(/\s*·\s*\$/, '')
    .trim();
}

// Click sulla notifica: chiude la notifica e apre (o focalizza) l'app.
//
// Il link arriva come path interno ("/calendar"), ma l'app usa la URL strategy
// a frammento (#/calendar) ed è pubblicata in un sottocartello di GitHub Pages
// senza fallback SPA: aprire "…/web-app-test/calendar" risponderebbe 404.
// Apriamo quindi la root dell'app (sempre servita da index.html) e mettiamo la
// rotta nel fragment, che il router legge all'avvio; le route interne sono
// quelle di RoutePaths.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const link = typeof data.link === 'string' ? data.link : '';
  // Solo path interni: "//host" e URL assoluti non vengono seguiti.
  const isInternalPath = link.startsWith('/') && !link.startsWith('//');

  const appUrl = new URL('./', self.registration.scope);
  if (isInternalPath) {
    appUrl.hash = link;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // C'è già una finestra dell'app: focalizzala e portala sul link.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (client.navigate) {
            return client.navigate(appUrl.href);
          }
          return;
        }
      }
      // Nessuna finestra aperta: aprine una nuova sulla root con la rotta.
      if (self.clients.openWindow) {
        return self.clients.openWindow(appUrl.href);
      }
    })
  );
});
