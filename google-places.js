// Google Maps JS Places library. Keys are supplied by the Flutter build and
// must be restricted to the application's HTTP referrers and Google APIs.
(() => {
  let ready;
  const sessions = new Map();
  const ended = new Set();
  const safeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(id);
  const safeSession = id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  const failure = error => ({ error:
    /OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|QUOTA_EXCEEDED|429/.test(String(error?.code ?? error?.message ?? ''))
      ? 'places_rate_limit' : 'places_unavailable' });

  function load(key, language) {
    if (ready) return ready;
    if (!key) return Promise.reject(new Error('places_not_configured'));
    ready = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => done(new Error('places_load_timeout')), 15000);
      function done(error) {
        clearTimeout(timer);
        delete window.__bandPlacesLoaded;
        if (error) { script.remove(); reject(error); }
        else resolve();
      }
      window.__bandPlacesLoaded = () => done();
      script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
        key, v: 'weekly', loading: 'async', libraries: 'places', language,
        callback: '__bandPlacesLoaded',
      });
      script.async = true;
      script.onerror = () => done(new Error('places_load_failed'));
      document.head.appendChild(script);
    }).then(() => window.google.maps.importLibrary('places')).catch(error => {
      ready = undefined;
      throw error;
    });
    return ready;
  }

  window.bandCalendarPlacesRequest = async (json, apiKey) => {
    try {
      const body = JSON.parse(json);
      if (!body || typeof body !== 'object') return JSON.stringify({error:'invalid_request'});
      const sessionId = body.session_token;
      if (body.action === 'end_session') {
        sessions.delete(sessionId);
        if (ended.size >= 32) ended.delete(ended.values().next().value);
        ended.add(sessionId);
        return '{}'; // No library load or Google request for cleanup.
      }
      const language = body.language === 'en' ? 'en' : 'it';
      if (body.action !== 'autocomplete' && body.action !== 'details') {
        return JSON.stringify({error:'invalid_request'});
      }
      if (body.action === 'autocomplete' &&
          (!safeSession(sessionId) || typeof body.query !== 'string' ||
           body.query.trim().length < 3 || body.query.length > 200)) {
        return JSON.stringify({error:'invalid_query'});
      }
      if (body.action === 'details' && (!safeId(body.place_id) ||
          (sessionId !== undefined && !safeSession(sessionId)))) {
        return JSON.stringify({error:'invalid_place_id'});
      }
      const lib = await load(apiKey, language);
      if (sessionId && ended.has(sessionId)) return JSON.stringify(body.action === 'autocomplete'
        ? {suggestions:[]} : {error:'places_unavailable'});
      // Bound abandoned sessions and do not retain Google data beyond this page.
      for (const [id, value] of sessions) if (Date.now() - value.at > 180000) sessions.delete(id);
      if (body.action === 'autocomplete') {
        let session = sessions.get(sessionId);
        if (!session) {
          if (sessions.size >= 16) sessions.delete(sessions.keys().next().value);
          session = {token:new lib.AutocompleteSessionToken(), predictions:new Map(), at:Date.now()};
          sessions.set(sessionId, session);
        }
        session.at = Date.now();
        const {suggestions} = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input:body.query.trim(), language, region:'it', sessionToken:session.token,
        });
        const predictions = suggestions.map(s => s.placePrediction)
          .filter(p => p && safeId(p.placeId)).slice(0,5);
        if (sessions.get(sessionId) === session) {
          for (const p of predictions) session.predictions.set(p.placeId,p);
        }
        return JSON.stringify({suggestions:predictions.map(p => ({
          place_id:p.placeId, label:p.text.toString(),
        }))});
      }
      let place;
      if (sessionId) {
        const prediction = sessions.get(sessionId)?.predictions.get(body.place_id);
        if (!prediction) return JSON.stringify({error:'places_unavailable'});
        // toPlace carries the original Google session token to fetchFields.
        place = prediction.toPlace();
      } else {
        place = new lib.Place({id:body.place_id, requestedLanguage:language, requestedRegion:'it'});
      }
      try {
        await place.fetchFields({fields:['id','formattedAddress','location','attributions']});
        if (!place.formattedAddress) return JSON.stringify({error:'places_unavailable'});
        return JSON.stringify({place_id:place.id || body.place_id, address:place.formattedAddress,
          attributions:(place.attributions || []).map(a => ({
            provider:a.provider || '', uri:/^https:\/\//.test(a.providerURI) ? a.providerURI : null,
          }))});
      } finally {
        if (sessionId) sessions.delete(sessionId);
      }
    } catch (error) {
      // Return only a generic code; never log the key or search query.
      return JSON.stringify(failure(error));
    }
  };
})();
