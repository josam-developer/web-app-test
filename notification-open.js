/* Keep clicked notification content local. Only an opaque id travels in the
 * route, including across login redirects and a cold app start. */
(function (scope) {
  const databaseName = 'band-calendar-notification-opens' +
    ((scope.__FCM_BASE_PATH__ || '').startsWith('/web-app-test/') ? ':test' : '');
  function database() {
    return new Promise(function (resolve, reject) {
      const request = scope.indexedDB.open(databaseName, 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore('notifications', { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
      request.onblocked = function () { reject(new Error('Database blocked')); };
    });
  }

  scope.bandCalendarSaveNotificationOpen = async function (json) {
    let db;
    try {
      const content = JSON.parse(json);
      const id = scope.crypto.randomUUID();
      const now = Date.now();
      db = await database();
      await new Promise(function (resolve, reject) {
        const tx = db.transaction('notifications', 'readwrite');
        const store = tx.objectStore('notifications');
        store.put({ id: id, content: content, expiresAt: now + 86400000 });
        const cursor = store.openCursor();
        cursor.onsuccess = function () {
          const row = cursor.result;
          if (row) {
            if (row.value.expiresAt <= now) row.delete();
            row.continue();
          }
        };
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = function () { reject(tx.error); };
      });
      return id;
    } catch (_) {
      // Storage unavailable: preserve the existing calendar navigation.
      return null;
    } finally {
      if (db) db.close();
    }
  };

  scope.bandCalendarTakeNotificationOpen = async function (id, recipientId) {
    let db;
    try {
      db = await database();
      return await new Promise(function (resolve, reject) {
        const tx = db.transaction('notifications', 'readwrite');
        const store = tx.objectStore('notifications');
        let result = null;
        const request = store.get(id);
        request.onsuccess = function () {
          const row = request.result;
          if (!row) return;
          if (row.expiresAt <= Date.now()) { store.delete(id); return; }
          if (row.content.recipientId && row.content.recipientId !== recipientId) return;
          result = JSON.stringify(row.content);
          store.delete(id);
        };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = tx.onabort = function () { reject(tx.error); };
      });
    } catch (_) {
      return null;
    } finally {
      if (db) db.close();
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
