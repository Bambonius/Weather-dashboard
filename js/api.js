const API = (() => {
  const BASE = 'https://api.openweathermap.org/data/2.5';
  const GEO_BASE = 'https://api.openweathermap.org/geo/1.0';
  const ICON_BASE = 'https://openweathermap.org/img/wn';

  function key() {
    return typeof CONFIG !== 'undefined' ? CONFIG.API_KEY : null;
  }

  function units() {
    return typeof CONFIG !== 'undefined' ? CONFIG.UNITS : 'metric';
  }

  async function request(endpoint, params = {}) {
    const k = key();
    if (!k) throw new Error('API key not configured');

    const url = new URL(`${BASE}${endpoint}`);
    url.searchParams.set('appid', k);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });

      if (res.status === 401) throw new Error('Invalid API key');
      if (res.status === 404) throw new Error('City not found. Check spelling and try again.');
      if (res.status === 429) throw new Error('API rate limit exceeded. Wait a moment and try again.');
      if (!res.ok) throw new Error('Unable to fetch weather data.');

      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchWeather(city) {
    const data = await request('/weather', { q: city, units: units() });
    return {
      city: data.name,
      country: data.sys.country,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      windDeg: data.wind.deg,
      condition: data.weather[0].description,
      icon: data.weather[0].icon,
      iconUrl: `${ICON_BASE}/${data.weather[0].icon}@2x.png`,
      lat: data.coord.lat,
      lon: data.coord.lon,
      dt: data.dt
    };
  }

  async function fetchForecast(city) {
    const data = await request('/forecast', { q: city, units: units() });
    return data.list.map(item => ({
      dt: item.dt,
      temp: Math.round(item.main.temp),
      tempMin: Math.round(item.main.temp_min),
      tempMax: Math.round(item.main.temp_max),
      humidity: item.main.humidity,
      condition: item.weather[0].description,
      icon: item.weather[0].icon,
      iconUrl: `${ICON_BASE}/${item.weather[0].icon}@2x.png`,
      windSpeed: item.wind.speed,
      pop: item.pop || 0
    }));
  }

  async function fetchAirPollution(lat, lon) {
    const data = await request('/air_pollution', { lat, lon });
    const aqi = data.list[0].main.aqi;
    const components = data.list[0].components;
    return {
      aqi,
      aqiLabel: aqiLabel(aqi),
      aqiColor: aqiColor(aqi),
      pm25: components.pm2_5,
      pm10: components.pm10,
      o3: components.o3
    };
  }

  function aqiLabel(aqi) {
    const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    return labels[aqi - 1] || 'Unknown';
  }

  function aqiColor(aqi) {
    const colors = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#7c3aed'];
    return colors[aqi - 1] || '#6b7280';
  }

  function getIconUrl(code) {
    return `${ICON_BASE}/${code}@2x.png`;
  }

  async function fetchCities(query) {
    const k = key();
    if (!k) throw new Error('API key not configured');

    const url = new URL(`${GEO_BASE}/direct`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('appid', k);

    const res = await fetch(url.toString());

    if (!res.ok) throw new Error('Failed to fetch city suggestions');
    const data = await res.json();

    return data.map(city => ({
      name: city.name,
      state: city.state || '',
      country: city.country,
      lat: city.lat,
      lon: city.lon,
      label: city.state
        ? `${city.name}, ${city.state}, ${city.country}`
        : `${city.name}, ${city.country}`
    }));
  }

  return { fetchWeather, fetchForecast, fetchAirPollution, getIconUrl, units, key, fetchCities };
})();
