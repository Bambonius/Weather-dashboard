(function () {
  'use strict';

  const state = {
    currentCity: null,
    units: 'metric',
    weatherData: null,
    forecastData: null,
    pollutionData: null,
    recentSearches: loadRecentSearches(),
    loading: false,
    suggestionsAborter: null,
    suggestionsDebounce: null,
    suggestionsHighlighted: -1
  };

  const dom = {
    setupPrompt: document.getElementById('setupPrompt'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('errorMessage'),
    errorDismiss: document.getElementById('errorDismiss'),
    weatherContent: document.getElementById('weatherContent'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    searchSuggestions: document.getElementById('searchSuggestions'),
    unitSwitch: document.getElementById('unitSwitch'),
    unitLabels: document.querySelectorAll('.toggle__label'),

    cityName: document.getElementById('cityName'),
    dateDisplay: document.getElementById('dateDisplay'),
    tempValue: document.getElementById('tempValue'),
    tempUnit: document.getElementById('tempUnit'),
    weatherIcon: document.getElementById('weatherIcon'),
    weatherDesc: document.getElementById('weatherDesc'),
    feelsLike: document.getElementById('feelsLike'),

    humidityValue: document.getElementById('humidityValue'),
    windValue: document.getElementById('windValue'),
    windDir: document.getElementById('windDir'),
    windArrow: document.getElementById('windArrow'),
    aqiBadge: document.getElementById('aqiBadge'),
    aqiBadgeValue: document.getElementById('aqiBadgeValue'),
    aqiBadgeLabel: document.getElementById('aqiBadgeLabel'),
    pm25Fill: document.getElementById('pm25Fill'),
    pm10Fill: document.getElementById('pm10Fill'),
    o3Fill: document.getElementById('o3Fill'),
    pm25Value: document.getElementById('pm25Value'),
    pm10Value: document.getElementById('pm10Value'),
    o3Value: document.getElementById('o3Value'),

    forecastList: document.getElementById('forecastList'),

    recentSection: document.getElementById('recentSection'),
    recentList: document.getElementById('recentList'),
    recentEmpty: document.getElementById('recentEmpty'),
    clearRecent: document.getElementById('clearRecent')
  };

  /* --- Init --- */
  function init() {
    if (!checkConfig()) return;

    const savedUnit = loadUnitPreference();
    state.units = savedUnit || (typeof CONFIG !== 'undefined' && CONFIG.UNITS ? CONFIG.UNITS : 'metric');
    CONFIG.UNITS = state.units;
    syncUnitToggle();

    dom.searchInput.addEventListener('keydown', onSearchKeydown);
    dom.searchInput.addEventListener('input', onSearchInput);
    dom.searchInput.addEventListener('blur', onSearchBlur);
    dom.searchButton.addEventListener('click', onSearchButtonClick);
    dom.unitSwitch.addEventListener('click', onToggleUnit);
    dom.unitLabels.forEach(label => label.addEventListener('click', onLabelUnit));
    dom.errorDismiss.addEventListener('click', hideError);
    dom.clearRecent.addEventListener('click', clearRecent);

    renderRecentSearches();
    loadCity(typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_CITY : 'Aarhus,DK', true);
  }

  /* --- Config Check --- */
  function checkConfig() {
    if (typeof CONFIG === 'undefined' || !CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
      dom.setupPrompt.hidden = false;
      return false;
    }
    return true;
  }

  /* --- Search --- */
  function onSearchKeydown(e) {
    const suggestions = getSuggestionItems();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length) {
        state.suggestionsHighlighted = Math.min(state.suggestionsHighlighted + 1, suggestions.length - 1);
        highlightSuggestion(suggestions);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length) {
        state.suggestionsHighlighted = Math.max(state.suggestionsHighlighted - 1, 0);
        highlightSuggestion(suggestions);
      }
      return;
    }

    if (e.key === 'Enter') {
      if (state.suggestionsHighlighted >= 0 && suggestions.length) {
        e.preventDefault();
        const active = suggestions[state.suggestionsHighlighted];
        if (active) active.click();
        return;
      }
      const query = dom.searchInput.value.trim();
      if (!query) return;
      dom.searchInput.blur();
      closeSuggestions();
      performSearch(query);
      return;
    }

    if (e.key === 'Escape') {
      closeSuggestions();
      return;
    }
  }

  function onSearchInput() {
    const query = dom.searchInput.value.trim();

    if (state.suggestionsDebounce) clearTimeout(state.suggestionsDebounce);

    if (query.length < 2) {
      closeSuggestions();
      return;
    }

    state.suggestionsDebounce = setTimeout(() => {
      fetchAndRenderSuggestions(query);
    }, 300);
  }

  function onSearchBlur() {
    setTimeout(() => {
      if (!dom.searchSuggestions.contains(document.activeElement)) {
        closeSuggestions();
      }
    }, 150);
  }

  function onSearchButtonClick() {
    const query = dom.searchInput.value.trim();
    if (!query) return;
    dom.searchInput.blur();
    closeSuggestions();
    performSearch(query);
  }

  function performSearch(query) {
    if (state.loading) return;
    loadCity(query, false);
  }

  async function fetchAndRenderSuggestions(query) {
    if (state.suggestionsAborter) state.suggestionsAborter.abort();
    const aborter = new AbortController();
    state.suggestionsAborter = aborter;

    dom.searchSuggestions.innerHTML = `
      <li class="search__suggestions-loading">
        <div class="search__suggestions-spinner"></div>
        <span>Searching cities…</span>
      </li>`;
    dom.searchSuggestions.hidden = false;

    try {
      const cities = await API.fetchCities(query);

      if (aborter.signal.aborted) return;

      if (!cities.length) {
        dom.searchSuggestions.innerHTML = `
          <li class="search__suggestions-empty">No cities found</li>`;
        return;
      }

      state.suggestionsHighlighted = -1;
      renderSuggestions(cities);

    } catch (err) {
      if (aborter.signal.aborted) return;
      dom.searchSuggestions.innerHTML = `
        <li class="search__suggestions-empty">Failed to load suggestions</li>`;
    }
  }

  function renderSuggestions(cities) {
    dom.searchSuggestions.innerHTML = '';

    cities.forEach((city, i) => {
      const li = document.createElement('li');
      li.className = 'search__suggestion-item';
      li.setAttribute('role', 'option');
      li.innerHTML = `
        <svg class="search__suggestion-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <span class="search__suggestion-name">${city.name}</span>
        ${city.state ? `<span class="search__suggestion-state">${city.state}</span>` : ''}
        <span class="search__suggestion-country">${city.country}</span>
      `;

      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectSuggestion(city);
      });

      dom.searchSuggestions.appendChild(li);
    });
  }

  function selectSuggestion(city) {
    dom.searchInput.value = city.label;
    closeSuggestions();
    dom.searchInput.blur();
    performSearch(city.label);
  }

  function getSuggestionItems() {
    return dom.searchSuggestions.querySelectorAll('.search__suggestion-item');
  }

  function highlightSuggestion(items) {
    items.forEach((item, i) => {
      item.classList.toggle('search__suggestion-item--active', i === state.suggestionsHighlighted);
    });
  }

  function closeSuggestions() {
    if (state.suggestionsAborter) {
      state.suggestionsAborter.abort();
      state.suggestionsAborter = null;
    }
    if (state.suggestionsDebounce) {
      clearTimeout(state.suggestionsDebounce);
      state.suggestionsDebounce = null;
    }
    dom.searchSuggestions.hidden = true;
    dom.searchSuggestions.innerHTML = '';
    state.suggestionsHighlighted = -1;
  }

  async function loadCity(city, skipRecent = false, silent = false) {
    setSearchEnabled(false);
    state.loading = true;

    if (silent) {
      dom.weatherContent.classList.add('weather--refreshing');
    } else {
      showLoading();
      hideError();
      dom.searchInput.value = '';
    }

    try {
      const [weather, forecast] = await Promise.all([
        API.fetchWeather(city),
        API.fetchForecast(city)
      ]);

      state.weatherData = weather;
      state.forecastData = forecast;
      state.currentCity = `${weather.city}, ${weather.country}`;

      renderCurrentWeather();

      try {
        state.pollutionData = await API.fetchAirPollution(weather.lat, weather.lon);
      } catch {
        state.pollutionData = null;
      }
      renderAirQuality();

      renderForecast();

      if (!skipRecent) {
        addRecentSearch(state.currentCity);
      }
      renderRecentSearches();

      if (silent) {
        dom.weatherContent.classList.remove('weather--refreshing');
      } else {
        dom.weatherContent.hidden = false;
        hideLoading();
      }

    } catch (err) {
      if (silent) {
        dom.weatherContent.classList.remove('weather--refreshing');
        showError(formatError(err));
      } else {
        hideLoading();
        showError(formatError(err));
      }
    }

    state.loading = false;
    setSearchEnabled(true);
  }

  function setSearchEnabled(enabled) {
    if (enabled) {
      dom.searchInput.disabled = false;
      dom.searchInput.classList.remove('search__input--loading');
    } else {
      dom.searchInput.disabled = true;
      dom.searchInput.classList.add('search__input--loading');
    }
  }

  function formatError(err) {
    if (err.name === 'AbortError') {
      return 'Request timed out. Check your connection and try again.';
    }
    if (err.message && err.message.includes('NetworkError')) {
      return 'Network error. Check your internet connection.';
    }
    if (err.message) return err.message;
    return 'Something went wrong. Please try again.';
  }

  /* --- Render: Current Weather --- */
  function renderCurrentWeather() {
    const w = state.weatherData;
    if (!w) return;

    dom.cityName.textContent = `${w.city}, ${w.country}`;
    dom.dateDisplay.textContent = formatDate(w.dt, w.city);
    dom.tempValue.textContent = w.temp;
    dom.tempUnit.textContent = state.units === 'metric' ? '°C' : '°F';
    dom.weatherIcon.src = w.iconUrl;
    dom.weatherIcon.alt = w.condition;
    dom.weatherIcon.onerror = () => {
      dom.weatherIcon.src = API.getIconUrl('03d');
    };
    dom.weatherDesc.textContent = w.condition;
    dom.feelsLike.textContent = `Feels like ${w.feelsLike}°`;
    dom.humidityValue.textContent = `${w.humidity}%`;

    const unit = state.units === 'metric' ? 'm/s' : 'mph';
    dom.windValue.textContent = `${w.windSpeed} ${unit}`;

    const dir = windDirection(w.windDeg);
    dom.windDir.textContent = dir.label;
    dom.windArrow.style.transform = `rotate(${dir.degrees}deg)`;

    setWeatherTheme(w.icon);
  }

  function setWeatherTheme(icon) {
    const body = document.body;
    body.classList.remove(
      'weather--clear-day', 'weather--clear-night',
      'weather--clouds', 'weather--rain',
      'weather--thunderstorm', 'weather--snow', 'weather--mist'
    );

    const code = icon.replace(/[dn]$/, '');
    const isNight = icon.endsWith('n');

    const themes = {
      '01': isNight ? 'weather--clear-night' : 'weather--clear-day',
      '02': 'weather--clouds',
      '03': 'weather--clouds',
      '04': 'weather--clouds',
      '09': 'weather--rain',
      '10': 'weather--rain',
      '11': 'weather--thunderstorm',
      '13': 'weather--snow',
      '50': 'weather--mist'
    };

    const theme = themes[code] || '';
    if (theme) body.classList.add(theme);
  }

  function windDirection(deg) {
    const directions = [
      { label: 'N',   min: 348.75, max: 360,   degrees: 0 },
      { label: 'N',   min: 0,      max: 11.25,  degrees: 0 },
      { label: 'NNE', min: 11.25,  max: 33.75,  degrees: 22.5 },
      { label: 'NE',  min: 33.75,  max: 56.25,  degrees: 45 },
      { label: 'ENE', min: 56.25,  max: 78.75,  degrees: 67.5 },
      { label: 'E',   min: 78.75,  max: 101.25, degrees: 90 },
      { label: 'ESE', min: 101.25, max: 123.75, degrees: 112.5 },
      { label: 'SE',  min: 123.75, max: 146.25, degrees: 135 },
      { label: 'SSE', min: 146.25, max: 168.75, degrees: 157.5 },
      { label: 'S',   min: 168.75, max: 191.25, degrees: 180 },
      { label: 'SSW', min: 191.25, max: 213.75, degrees: 202.5 },
      { label: 'SW',  min: 213.75, max: 236.25, degrees: 225 },
      { label: 'WSW', min: 236.25, max: 258.75, degrees: 247.5 },
      { label: 'W',   min: 258.75, max: 281.25, degrees: 270 },
      { label: 'WNW', min: 281.25, max: 303.75, degrees: 292.5 },
      { label: 'NW',  min: 303.75, max: 326.25, degrees: 315 },
      { label: 'NNW', min: 326.25, max: 348.75, degrees: 337.5 }
    ];
    const match = directions.find(d => deg >= d.min && deg < d.max);
    return match || { label: '--', degrees: 0 };
  }

  /* --- Render: Air Quality --- */
  function renderAirQuality() {
    const p = state.pollutionData;

    if (!p) {
      dom.aqiBadge.style.background = 'rgba(107, 114, 128, 0.15)';
      dom.aqiBadgeValue.textContent = '--';
      dom.aqiBadgeValue.style.color = 'var(--clr-text-muted)';
      dom.aqiBadgeLabel.textContent = 'No data';
      dom.aqiBadgeLabel.style.color = 'var(--clr-text-muted)';
      dom.pm25Fill.style.width = '0%';
      dom.pm10Fill.style.width = '0%';
      dom.o3Fill.style.width = '0%';
      dom.pm25Value.textContent = '--';
      dom.pm10Value.textContent = '--';
      dom.o3Value.textContent = '--';
      return;
    }

    const badgeColor = p.aqiColor;
    dom.aqiBadge.style.background = hexToRgba(badgeColor, 0.2);
    dom.aqiBadgeValue.textContent = p.aqi;
    dom.aqiBadgeValue.style.color = badgeColor;
    dom.aqiBadgeLabel.textContent = p.aqiLabel;
    dom.aqiBadgeLabel.style.color = badgeColor;

    const pollutants = [
      { fill: dom.pm25Fill, value: dom.pm25Value, val: p.pm25, max: 75, threshold: 15 },
      { fill: dom.pm10Fill, value: dom.pm10Value, val: p.pm10, max: 150, threshold: 45 },
      { fill: dom.o3Fill,  value: dom.o3Value,  val: p.o3,   max: 200, threshold: 100 }
    ];

    pollutants.forEach(pol => {
      const pct = Math.min((pol.val / pol.max) * 100, 100);
      pol.fill.style.width = `${pct}%`;

      if (pol.val <= pol.threshold) {
        pol.fill.style.background = '#22c55e';
      } else if (pol.val <= pol.threshold * 2) {
        pol.fill.style.background = '#eab308';
      } else {
        pol.fill.style.background = '#ef4444';
      }

      pol.value.textContent = pol.val.toFixed(1);
    });
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /* --- Render: Forecast --- */
  function renderForecast() {
    const daily = aggregateForecast(state.forecastData);
    dom.forecastList.innerHTML = '';

    daily.forEach((day, i) => {
      const card = document.createElement('div');
      card.className = 'forecast-card';
      if (day.isToday) card.classList.add('forecast-card--today');
      card.style.animationDelay = `${0.08 * i}s`;

      const popHtml = day.pop > 0 ? `
        <span class="forecast-card__pop">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
          ${day.pop}%
        </span>
      ` : '';

      card.innerHTML = `
        <span class="forecast-card__day">${day.dayName}</span>
        <img class="forecast-card__icon" src="${day.iconUrl}" alt="${day.condition}" loading="lazy">
        <span class="forecast-card__condition">${day.condition}</span>
        <div class="forecast-card__temps">
          <span class="forecast-card__high">${day.tempMax}°</span>
          <span class="forecast-card__low">${day.tempMin}°</span>
        </div>
        ${popHtml}
      `;
      dom.forecastList.appendChild(card);
    });
  }

  function aggregateForecast(list) {
    if (!list || !list.length) return [];

    const days = {};
    list.forEach(item => {
      const date = new Date(item.dt * 1000).toLocaleDateString('en-US');
      if (!days[date]) {
        days[date] = {
          dt: item.dt,
          items: [],
          tempsMin: [],
          tempsMax: [],
          pops: [],
          conditions: []
        };
      }
      days[date].items.push(item);
      days[date].tempsMin.push(item.tempMin);
      days[date].tempsMax.push(item.tempMax);
      days[date].pops.push(item.pop);
      days[date].conditions.push(item.condition);
    });

    const entries = Object.values(days).slice(0, 5);
    const todayStr = new Date().toLocaleDateString('en-US');
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toLocaleDateString('en-US');

    return entries.map((d) => {
      const dateStr = new Date(d.dt * 1000).toLocaleDateString('en-US');

      let dayName;
      if (dateStr === todayStr) {
        dayName = 'Today';
      } else if (dateStr === tomorrowStr) {
        dayName = 'Tomorrow';
      } else {
        dayName = new Date(d.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });
      }

      const midday = d.items.find(i => {
        const h = new Date(i.dt * 1000).getHours();
        return h >= 11 && h <= 14;
      }) || d.items[Math.floor(d.items.length / 2)];

      const maxPop = Math.max(...d.pops, 0);
      const popPercent = maxPop > 0 ? Math.round(maxPop * 100) : 0;

      return {
        dayName,
        tempMax: Math.max(...d.tempsMax),
        tempMin: Math.min(...d.tempsMin),
        condition: midday.condition,
        iconUrl: midday.iconUrl,
        isToday: dateStr === todayStr,
        pop: popPercent
      };
    });
  }

  /* --- Render: Recent Searches --- */
  function renderRecentSearches() {
    const hasItems = state.recentSearches.length > 0;
    dom.recentSection.hidden = false;
    dom.recentEmpty.hidden = hasItems;
    dom.clearRecent.style.display = hasItems ? '' : 'none';
    dom.recentList.innerHTML = '';

    if (!hasItems) return;

    dom.recentList.innerHTML = '';

    state.recentSearches.forEach((city, i) => {
      const chip = document.createElement('button');
      chip.className = 'recent-chip';
      chip.style.animationDelay = `${i * 0.05}s`;
      chip.innerHTML = `
        <svg class="recent-chip__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span class="recent-chip__name">${city}</span>
        <span class="recent-chip__remove" data-index="${i}">&times;</span>
      `;
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('recent-chip__remove')) {
          e.stopPropagation();
          removeRecentChip(chip, Number(e.target.dataset.index));
          return;
        }
        loadCity(city.split(',')[0], false);
      });
      dom.recentList.appendChild(chip);
    });
  }

  function removeRecentChip(chip, index) {
    chip.classList.add('recent-chip--removing');
    chip.addEventListener('transitionend', () => {
      chip.remove();
      state.recentSearches.splice(index, 1);
      saveRecentSearches();
      if (state.recentSearches.length === 0) {
        dom.recentEmpty.hidden = false;
        dom.clearRecent.style.display = 'none';
      }
    }, { once: true });
  }

  function addRecentSearch(city) {
    state.recentSearches = state.recentSearches.filter(c => c !== city);
    state.recentSearches.unshift(city);
    if (state.recentSearches.length > 5) state.recentSearches.pop();
    saveRecentSearches();
  }

  function clearRecent() {
    const chips = dom.recentList.querySelectorAll('.recent-chip');
    chips.forEach((chip, i) => {
      chip.style.animationDelay = `${i * 0.04}s`;
      chip.classList.add('recent-chip--removing');
    });

    const lastChip = chips[chips.length - 1];
    if (lastChip) {
      lastChip.addEventListener('transitionend', () => {
        state.recentSearches = [];
        saveRecentSearches();
        dom.recentEmpty.hidden = false;
        dom.clearRecent.style.display = 'none';
        dom.recentList.innerHTML = '';
      }, { once: true });
    } else {
      state.recentSearches = [];
      saveRecentSearches();
      dom.recentEmpty.hidden = false;
      dom.clearRecent.style.display = 'none';
    }
  }

  /* --- Unit Toggle --- */
  function syncUnitToggle() {
    const isImperial = state.units === 'imperial';
    dom.unitSwitch.setAttribute('aria-checked', isImperial);
    dom.unitLabels.forEach(l => {
      const match = l.dataset.unit === state.units;
      l.classList.toggle('toggle__label--active', match);
    });
  }

  function onToggleUnit() {
    state.units = state.units === 'metric' ? 'imperial' : 'metric';
    CONFIG.UNITS = state.units;
    saveUnitPreference(state.units);
    syncUnitToggle();
    if (state.currentCity) {
      loadCity(state.currentCity.split(',')[0], true, true);
    }
  }

  function onLabelUnit(e) {
    const unit = e.target.dataset.unit;
    if (unit === state.units) return;
    state.units = unit;
    CONFIG.UNITS = unit;
    saveUnitPreference(unit);
    syncUnitToggle();
    if (state.currentCity) {
      loadCity(state.currentCity.split(',')[0], true, true);
    }
  }

  /* --- Loading & Error --- */
  function showLoading() {
    dom.weatherContent.hidden = true;
    dom.loading.hidden = false;
  }

  function hideLoading() {
    dom.loading.hidden = true;
  }

  function showError(msg) {
    dom.errorMessage.textContent = msg;
    dom.error.hidden = false;
  }

  function hideError() {
    dom.error.hidden = true;
  }

  /* --- Storage --- */
  const STORAGE_KEY = 'weather_dashboard_recent';

  function loadRecentSearches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveRecentSearches() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.recentSearches));
    } catch { /* storage full */ }
  }

  const UNIT_STORAGE_KEY = 'weather_dashboard_units';

  function loadUnitPreference() {
    try {
      return localStorage.getItem(UNIT_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function saveUnitPreference(unit) {
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, unit);
    } catch { /* storage full */ }
  }

  /* --- Helpers --- */
  function formatDate(dt, timezone) {
    const date = new Date(dt * 1000);
    try {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  /* --- Bootstrap --- */
  document.addEventListener('DOMContentLoaded', init);
})();
