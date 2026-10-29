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

// Activate the aligned SDK promptly. Old pages without the message bridge are
// supported by the acknowledgement fallback below.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Handle app data-only messages before Firebase's origin-wide foreground
// routing: another app on the same origin must not swallow this app's push.
self.addEventListener('push', (event) => {
  let payload;
  try { payload = event.data && event.data.json(); } catch (_) { return; }
  if (!payload || typeof payload.data?.titleKey !== 'string') return;
  event.stopImmediatePropagation();
  event.waitUntil(deliverBandPush(payload));
});

self.window = self;
importScripts('./firebase-config.js');
const firebaseSdkVersion = self.flutterfire_web_sdk_version || '12.19.0';
importScripts(`https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-messaging-compat.js`);
importScripts('./reminder-dedup.js');
importScripts('./notification-open.js');

if (!self.__FIREBASE_CONFIG__ || self.__FIREBASE_CONFIG__.apiKey.startsWith('AIzaSyPLACEHOLDER')) {
  console.warn('[firebase-messaging-sw] Firebase non configurato.');
} else {
  firebase.initializeApp(self.__FIREBASE_CONFIG__);
  // Keep compatibility with other Firebase messages without our data contract.
  firebase.messaging().onBackgroundMessage(showBandPush);
}

async function deliverBandPush(payload) {
  const appUrl = new URL('./', self.registration.scope);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visible = windows.filter(client => {
    const url = new URL(client.url);
    return url.origin === appUrl.origin && url.pathname.startsWith(appUrl.pathname) &&
      client.visibilityState === 'visible';
  });
  if (visible.length) {
    const delivered = await Promise.all(visible.map(client => sendBandPush(client, payload)));
    if (delivered.some(Boolean)) return;
  }
  return showBandPush(payload);
}

function sendBandPush(client, payload) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    let completed = false;
    const finish = ok => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      channel.port1.close();
      resolve(ok);
    };
    const timeout = setTimeout(() => finish(false), 400);
    channel.port1.onmessage = event => finish(event.data === 'queued');
    try {
      client.postMessage({ type: 'BAND_PUSH_MESSAGE', payload }, [channel.port2]);
    } catch (_) { finish(false); }
  });
}

async function showBandPush(payload) {
  const data = (payload && payload.data) || {};
  if (data.occurrenceId && !await self.bandCalendarClaimReminder(data.occurrenceId, data.recipientId)) return;
  const lang = data.lang === 'en' ? 'en' : 'it';
  const strings = STRINGS[lang];

  // Le EF mandano `typeKey` (es. push.type.live): il valore è nel dizionario
  // della lingua del destinatario, non nel payload (che è uno solo).
  const params = Object.assign({}, data);
  if (params.typeKey) {
    params.type = strings[params.typeKey] || params.typeKey;
  }

  const eventType = data.typeKey === 'push.type.live' || data.typeKey === 'push.type.proof';
  params.status = eventType && ['push.status.confirmed', 'push.status.unconfirmed'].includes(data.statusKey)
    ? strings[data.statusKey] : '';
  let titleKey = data.titleKey;
  if (titleKey === 'push.entryUpdated.title' && eventType) {
    if (data.confirmationChange === 'confirmed') titleKey = 'push.entryConfirmed.title';
    if (data.confirmationChange === 'unconfirmed') titleKey = 'push.entryUnconfirmed.title';
  }
  const title = format(strings[titleKey] || strings['push.fallback.title'], params)
    || strings['push.fallback.title'];
  const body = format(strings[data.bodyKey] || strings['push.fallback.body'], params)
    || strings['push.fallback.body'];

  return self.registration.showNotification(title, {
    body: body,
    icon: './icons/Icon-notification.png',
    badge: './icons/Icon-notification.png',
    tag: data.tag || 'band-calendar',
    renotify: false,
    data: { link: data.link || '', recipientId: data.recipientId || '', announcementId: data.announcementId || '', titleKey: titleKey || '' },
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
    'push.reminder.title': '{project} · Promemoria',
    'push.reminder.body': '{reminderBody}',
    'push.announcement.title': '{announcementTitle}',
    'push.announcement.body': '{announcementBody}',
    'push.ownershipTransferred.title': 'Nuovo proprietario',
    'push.ownershipTransferred.body': 'Ora sei il proprietario del progetto "{project}".',

    'push.entryCreated.title': '{project} · Nuovo evento',
    // `{details}` è opzionale e include il separatore iniziale quando presente
    // (es. ' · Garage (Milano)'), così il body non ha separatori orfani.
    'push.entryCreated.body': '{status} · {date} · {type}{details}',
    'push.entryUpdated.title': '{project} · Evento modificato',
    'push.entryUpdated.body': '{status} · {date} · {type}{details}',
    'push.entryDeleted.title': '{project} · Evento eliminato',
    'push.entryDeleted.body': '❌ Eliminato · {date} · {type}{details}',
    'push.entryConfirmed.title': '{project} · Evento confermato',
    'push.entryUnconfirmed.title': '{project} · Evento da confermare',
    'push.status.confirmed': '✅ Confermato',
    'push.status.unconfirmed': '❓ Da confermare',
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
    'push.reminder.title': '{project} · Reminder',
    'push.reminder.body': '{reminderBody}',
    'push.announcement.title': '{announcementTitle}',
    'push.announcement.body': '{announcementBody}',
    'push.ownershipTransferred.title': 'New owner',
    'push.ownershipTransferred.body': 'You are now the owner of the project "{project}".',

    'push.entryCreated.title': '{project} · New event',
    // `{details}` optional, includes its leading separator when present
    // (e.g. ' · Garage (Milano)').
    'push.entryCreated.body': '{status} · {date} · {type}{details}',
    'push.entryUpdated.title': '{project} · Event updated',
    'push.entryUpdated.body': '{status} · {date} · {type}{details}',
    'push.entryDeleted.title': '{project} · Event deleted',
    'push.entryDeleted.body': '❌ Deleted · {date} · {type}{details}',
    'push.entryConfirmed.title': '{project} · Event confirmed',
    'push.entryUnconfirmed.title': '{project} · Event to be confirmed',
    'push.status.confirmed': '✅ Confirmed',
    'push.status.unconfirmed': '❓ To be confirmed',
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
    (async () => {
      const id = await self.bandCalendarSaveNotificationOpen(JSON.stringify({
        title: event.notification.title,
        body: event.notification.body,
        recipientId: data.recipientId || '',
        announcementId: data.announcementId || '',
        titleKey: data.titleKey || '',
      }));
      if (id) {
        const route = new URL(isInternalPath ? link : '/calendar', self.location.origin);
        route.searchParams.set('notification', id);
        appUrl.hash = route.pathname + route.search;
      }
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Test e produzione condividono il dominio: riusa solo finestre
      // sotto la base di questa app (con slash finale, per evitare prefissi simili).
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin !== appUrl.origin ||
            !clientUrl.pathname.startsWith(appUrl.pathname)) continue;
        if ('focus' in client) {
          await client.focus();
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
    })()
  );
});
