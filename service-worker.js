const CACHE_NAME = 'badminton-v3.0';
const STATIC_CACHE = 'badminton-static-v3.0';
const DYNAMIC_CACHE = 'badminton-dynamic-v3.0';

// Fichiers essentiels à mettre en cache
const STATIC_FILES = [
    './',
    './index.html',
    './manifest.json'
];

// URLs externes à mettre en cache
const EXTERNAL_URLS = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap'
];

// Installation - mise en cache des fichiers statiques
self.addEventListener('install', event => {
    console.log('[SW] Installation...');
    
    event.waitUntil(
        Promise.all([
            // Cache des fichiers locaux
            caches.open(STATIC_CACHE).then(cache => {
                console.log('[SW] Mise en cache des fichiers statiques');
                return cache.addAll(STATIC_FILES);
            }),
            // Cache des ressources externes
            caches.open(DYNAMIC_CACHE).then(cache => {
                console.log('[SW] Pré-chargement des ressources externes');
                const fetchPromises = EXTERNAL_URLS.map(url => {
                    return fetch(url, { mode: 'cors' })
                        .then(response => {
                            if (response.ok) {
                                return cache.put(url, response);
                            }
                        })
                        .catch(err => console.log('[SW] Erreur pré-chargement:', url, err));
                });
                return Promise.all(fetchPromises);
            })
        ]).then(() => {
            console.log('[SW] Installation terminée');
            return self.skipWaiting();
        })
    );
});

// Activation - nettoyage des anciens caches
self.addEventListener('activate', event => {
    console.log('[SW] Activation...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => {
                        return name !== STATIC_CACHE && 
                               name !== DYNAMIC_CACHE && 
                               name !== CACHE_NAME;
                    })
                    .map(name => {
                        console.log('[SW] Suppression ancien cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activation terminée');
            return self.clients.claim();
        })
    );
});

// Stratégie de fetch - Network First avec fallback Cache
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Ignorer les requêtes chrome-extension et autres
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Stratégie pour les fichiers locaux (index.html, etc.)
    if (url.origin === location.origin) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // Stratégie pour les ressources externes (CDN, fonts)
    event.respondWith(cacheFirstStrategy(request));
});

// Network First - essaie le réseau d'abord, puis le cache
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Si succès, mettre à jour le cache
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Réseau indisponible, utilisation du cache');
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback vers index.html pour les routes
        if (request.mode === 'navigate') {
            return caches.match('./index.html');
        }
        
        throw error;
    }
}

// Cache First - essaie le cache d'abord, puis le réseau
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Mettre à jour le cache en arrière-plan (stale-while-revalidate)
        updateCache(request);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Ressource non disponible:', request.url);
        throw error;
    }
}

// Mise à jour du cache en arrière-plan
async function updateCache(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put(request, networkResponse);
            console.log('[SW] Cache mis à jour:', request.url);
        }
    } catch (error) {
        // Silencieux - mise à jour en arrière-plan
    }
}

// Écouter les messages du client
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'clearCache') {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
});

// Synchronisation en arrière-plan (si supporté)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        console.log('[SW] Synchronisation des données...');
        // Implémenter la synchronisation si nécessaire
    }
});

console.log('[SW] Service Worker v3.0 chargé');
