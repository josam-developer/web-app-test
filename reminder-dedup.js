/* Shared by the page and FCM service worker. The read/write transaction makes
 * retries of one occurrence idempotent even across tabs and worker contexts. */
(function (scope) {
  const databaseName = 'band-calendar-reminder-deliveries' +
    ((scope.__FCM_BASE_PATH__ || '').startsWith('/web-app-test/') ? ':test' : '');
  scope.bandCalendarClaimReminder = function (occurrenceId, recipientId) {
    if (!occurrenceId || !recipientId || !scope.indexedDB) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var open = scope.indexedDB.open(databaseName, 1);
      open.onupgradeneeded = function () {
        var store = open.result.createObjectStore('seen', { keyPath: 'id' });
        store.createIndex('expiresAt', 'expiresAt');
      };
      open.onerror = function () { resolve(true); };
      open.onblocked = function () { resolve(true); };
      open.onsuccess = function () {
        var db = open.result;
        var tx = db.transaction('seen', 'readwrite');
        var store = tx.objectStore('seen');
        var key = recipientId + ':' + occurrenceId;
        var claimed = false;
        var now = Date.now();
        var lookup = store.get(key);
        lookup.onsuccess = function () {
          if (!lookup.result || lookup.result.expiresAt <= now) {
            claimed = true;
            store.put({ id: key, expiresAt: now + 172800000 });
          }
        };
        var expired = store.index('expiresAt').openCursor(scope.IDBKeyRange.upperBound(now));
        expired.onsuccess = function () {
          var cursor = expired.result;
          if (cursor) { cursor.delete(); cursor.continue(); }
        };
        tx.oncomplete = function () { db.close(); resolve(claimed); };
        tx.onerror = tx.onabort = function () { db.close(); resolve(true); };
      };
    });
  };
})(typeof self !== 'undefined' ? self : globalThis);
