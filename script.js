// script.js - Weather dashboard using Open-Meteo free APIs.
// No API key required.

// UI elements
const q = document.getElementById('q');
const searchForm = document.getElementById('searchForm');
const locBtn = document.getElementById('locBtn');
const messageEl = document.getElementById('message');
const currentCard = document.getElementById('current');
const placeEl = document.getElementById('place');
const descEl = document.getElementById('desc');
const tempEl = document.getElementById('temp');
const unitToggle = document.getElementById('unitToggle');
const windEl = document.getElementById('wind');
const updatedEl = document.getElementById('updated');
const iconEl = document.getElementById('icon');
const forecastEl = document.getElementById('forecast');
let useF = false;

unitToggle.addEventListener('change', () => {
  useF = unitToggle.checked;
  document.querySelectorAll('.unit').forEach(u => u.textContent = useF ? '°F' : '°C');
  // If we have current data shown, re-render by searching again with same text
  if (currentCard.classList.contains('hidden') === false) {
    // try to re-render using the visible place text (async load not stored here)
    const place = placeEl.dataset.lat && placeEl.dataset.lon ? { lat: placeEl.dataset.lat, lon: placeEl.dataset.lon } : null;
    if (place) fetchWeather(placeEl.dataset.lat, placeEl.dataset.lon, placeEl.dataset.name);
  }
});

searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const v = q.value.trim();
  if (!v) return showMessage('Type a city name first');
  searchCity(v);
});

locBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return showMessage('Geolocation not supported by your browser');
  showMessage('Locating…');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    fetchWeather(latitude, longitude, 'Your location');
  }, err => {
    showMessage('Could not get location: ' + err.message, true);
  }, { timeout: 10000 });
});

function showMessage(msg, isError = false) {
  messageEl.hidden = false;
  messageEl.textContent = msg;
  messageEl.style.background = isError ? 'rgba(128,32,32,0.12)' : '';
  setTimeout(() => {
    messageEl.hidden = true;
  }, isError ? 6000 : 4000);
}

async function searchCity(name) {
  showMessage('Searching...');
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      showMessage('Location not found', true);
      return;
    }
    const place = data.results[0];
    fetchWeather(place.latitude, place.longitude, `${place.name}${place.country ? ', ' + place.country : ''}`);
  } catch (err) {
    showMessage('Search error: ' + err.message, true);
  }
}

function fmtTimeISO(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch { return ts; }
}

function c2f(c) { return (c * 9/5) + 32; }

function weatherCodeToIcon(code) {
  // Lightweight mapping using emoji. Can be replaced by SVG icons.
  if (code === 0) return { icon: '☀️', text: 'Clear' };
  if (code === 1 || code === 2) return { icon: '⛅', text: 'Partly cloudy' };
  if (code === 3) return { icon: '☁️', text: 'Overcast' };
  if (code === 45 || code === 48) return { icon: '🌫️', text: 'Fog' };
  if (code >= 51 && code <= 67) return { icon: '🌦️', text: 'Drizzle' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', text: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: '🌧️', text: 'Rain showers' };
  if (code >= 85 && code <= 86) return { icon: '❄️', text: 'Heavy snow' };
  if (code >= 95 && code <= 99) return { icon: '⛈️', text: 'Thunderstorm' };
  return { icon: '🌈', text: 'Unknown' };
}

async function fetchWeather(lat, lon, placeName = '') {
  try {
    showMessage('Fetching weather…');
    currentCard.classList.add('hidden');
    forecastEl.classList.add('hidden');

    // Open-Meteo endpoint: current_weather + daily forecast
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error (${res.status})`);
    const data = await res.json();

    // Update current
    const cw = data.current_weather;
    const daily = data.daily;
    const placeLabel = placeName || `${lat.toFixed(3)},${lon.toFixed(3)}`;

    placeEl.textContent = placeLabel;
    placeEl.dataset.lat = lat;
    placeEl.dataset.lon = lon;
    placeEl.dataset.name = placeLabel;
    const wc = weatherCodeToIcon(cw.weathercode);
    iconEl.textContent = wc.icon;
    descEl.textContent = wc.text;

    let tempC = cw.temperature;
    let displayTemp = useF ? Math.round(c2f(tempC)) : Math.round(tempC);
    tempEl.textContent = displayTemp;
    document.querySelectorAll('.unit').forEach(u => u.textContent = useF ? '°F' : '°C');

    windEl.textContent = `${cw.windspeed} m/s`;
    updatedEl.textContent = `Updated: ${fmtTimeISO(cw.time)}`;

    // Build forecast cards from daily arrays
    forecastEl.innerHTML = '';
    for (let i = 0; i < daily.time.length; i++) {
      const day = daily.time[i];
      const maxC = daily.temperature_2m_max[i];
      const minC = daily.temperature_2m_min[i];
      const code = daily.weathercode[i];
      const wc2 = weatherCodeToIcon(code);
      const max = useF ? Math.round(c2f(maxC)) : Math.round(maxC);
      const min = useF ? Math.round(c2f(minC)) : Math.round(minC);

      const card = document.createElement('article');
      card.className = 'forecast-card';
      card.innerHTML = `
        <small>${new Date(day).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}</small>
        <div class="icon" style="font-size:26px">${wc2.icon}</div>
        <div style="margin-top:6px"><strong>${max}°</strong> / <span>${min}°</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:6px">${wc2.text}</div>
      `;
      forecastEl.appendChild(card);
    }

    // show UI
    currentCard.classList.remove('hidden');
    forecastEl.classList.remove('hidden');
    messageEl.hidden = true;
  } catch (err) {
    showMessage('Weather fetch error: ' + err.message, true);
  }
}

// Optionally: show a sample city on load
(async () => {
  // try to show a default city
  await searchCity('New York');
})();
