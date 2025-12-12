# Knose Scientific Dashboard

A production-grade React (TypeScript) scientific web application UI for visualizing time-series data from multiple IoT devices. Each device streams/logs data from multiple Bosch sensors (e.g., BME690).

## Features

- **Scientific Instrument UI**: Professional dashboard designed for lab analytics and scientific data visualization
- **Real-time Data**: Live data fetching from Firebase Realtime Database
- **Multi-Device Support**: View and manage multiple IoT devices
- **16 Sensors per Device**: Support for up to 16 BME sensors per device
- **Parameter Selection**: View Temperature, Humidity, Voltage, or ADC data
- **Interactive Charts**: Time-series visualization with sensor selection/deselection
- **Data Export**: Export device data to CSV format
- **Responsive Design**: Works on desktop and tablet devices

## Tech Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **Recharts** for data visualization
- **Firebase Realtime Database** for data storage
- **Date-fns** for date formatting

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Firebase Configuration

The app connects to Firebase Realtime Database at:
- Database URL: `https://knose-e1959-default-rtdb.firebaseio.com/`

Make sure Firebase Realtime Database rules allow read access:
```json
{
  "rules": {
    ".read": true,
    ".write": false
  }
}
```

## Deployment to Netlify

1. **Build Command**: `npm run build`
2. **Publish Directory**: `dist`
3. **Node Version**: 18

The `netlify.toml` file is already configured for deployment.

### Manual Deployment Steps

1. Push your code to Git repository
2. Connect repository to Netlify
3. Netlify will automatically detect the build settings from `netlify.toml`
4. Deploy!

## Project Structure

```
src/
├── components/      # Reusable UI components
├── config/          # Firebase configuration
├── pages/           # Page components (Login, Dashboard, DevicesList)
├── services/        # Data service layer
└── assets/          # Static assets
```

## Environment Variables

No environment variables are required. Firebase configuration is hardcoded in `src/config/firebase.ts`.

## License

Private - Knose Scientific Dashboard
