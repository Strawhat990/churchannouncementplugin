// idb-storage.js — IndexedDB wrapper for Church Announcement System
// Replaces localStorage for bulk data (announcements list, presets) to bypass the 5 MB limit.
// cas_current and cas_style remain in localStorage for the cross-page display.js polling bridge.

var idbStore = (function () {
  'use strict';

  var DB_NAME = 'cas_db';
  var DB_VERSION = 1;
  var STORE_NAME = 'appData';
  var db = null;

  // Keys that should be migrated from localStorage into IndexedDB on first run
  var MIGRATE_KEYS = ['cas_list', 'cas_presets'];

  function open() {
    return new Promise(function (resolve, reject) {
      if (db) { resolve(); return; }

      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = function (event) {
        db = event.target.result;
        migrate().then(resolve).catch(function (err) {
          console.warn('IndexedDB migration warning:', err);
          resolve(); // still proceed even if migration has issues
        });
      };

      request.onerror = function (event) {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // One-time migration: move existing localStorage data into IndexedDB
  function migrate() {
    var promises = [];

    MIGRATE_KEYS.forEach(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw !== null) {
          var parsed = JSON.parse(raw);
          promises.push(
            set(key, parsed).then(function () {
              localStorage.removeItem(key);
              console.log('Migrated "' + key + '" from localStorage to IndexedDB');
            })
          );
        }
      } catch (e) {
        console.warn('Migration skipped for "' + key + '":', e);
      }
    });

    return promises.length > 0 ? Promise.all(promises) : Promise.resolve();
  }

  function get(key) {
    return new Promise(function (resolve, reject) {
      if (!db) { reject(new Error('IndexedDB not open')); return; }
      var tx = db.transaction(STORE_NAME, 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var request = store.get(key);
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function set(key, value) {
    return new Promise(function (resolve, reject) {
      if (!db) { reject(new Error('IndexedDB not open')); return; }
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var request = store.put(value, key);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
    });
  }

  return {
    open: open,
    get: get,
    set: set
  };
})();
