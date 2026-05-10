# Weather Dashboard

A weather dashboard built with vanilla HTML, CSS, and JavaScript using the OpenWeatherMap API.

## Features

- **Current weather** — temperature, feels like, weather condition, humidity, wind speed and direction
- **Air quality** — AQI badge with PM2.5, PM10, and O₃ pollutant bars
- **5-day forecast** — daily high/low, condition text, weather icons, precipitation probability
- **City search** — autocomplete dropdown with up to 5 suggestions (not just for the same city, but for the search query) as you type
- **Recent searches** — last 5 cities saved to localStorage, with animated add/remove
- **°C / °F toggle** — persisted across sessions
- **Dynamic backgrounds** — 7 weather themes (clear day/night, clouds, rain, thunderstorm, snow, mist) with CSS ambient effects
- **Responsive** — works on desktop, tablet, and mobile

## Tech Stack

HTML, CSS, JavaScript — no frameworks, no build tools, no dependencies.

## Getting Started

1. Clone the repo
2. Copy the config template and add your OpenWeatherMap API key:
   ```bash
   cp js/config.example.js js/config.js
   
---

Notes from your self-review that you might want to add:

- Consider switching to the **YR.no API** in a future version for better accuracy, especially in Scandinavia
- The design could use a rework — the atmospheric dark theme was a concept exploration and may not be to your taste

Just paste the markdown block above into `README.md` and commit. Want me to add anything else?
