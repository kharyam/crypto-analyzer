# Crypto Price Analyzer Docker Setup

This repository contains a Dockerized version of the Crypto Price Analyzer application, which provides real-time cryptocurrency price analysis and trading recommendations. The application now supports **configurable cryptocurrency selection** - you can analyze any supported cryptocurrencies relative to Bitcoin!

## Features

- **Configurable cryptocurrency selection**: Choose any cryptocurrencies to compare against Bitcoin
- Real-time price tracking with dynamic crypto support (defaults to Ethereum and XRP)
- Price comparison charts and ratio analysis for selected cryptocurrencies
- Trading recommendations based on cryptocurrency performance
- **Settings interface**: Easy-to-use configuration panel for selecting cryptocurrencies
- **URL sharing**: Share configurations via URL parameters (e.g., `?cryptos=ethereum,cardano,solana`)
- **Popular crypto presets**: Quick selection from popular cryptocurrencies like ADA, SOL, DOT, LINK, etc.
- **Backward compatibility**: Maintains original ETH & XRP behavior by default
- Proxy configuration for CoinGecko API to avoid CORS issues

## Cryptocurrency Configuration

### Default Behavior
By default, the application analyzes **Ethereum (ETH)** and **XRP** relative to Bitcoin, maintaining the original functionality.

### Configuration Options

1. **Settings Panel**: Click the gear icon in the top-right to open the configuration panel
2. **URL Parameters**: Add `?cryptos=ethereum,cardano,solana` to the URL
3. **Local Storage**: Your selections are automatically saved for future visits

### Supported Cryptocurrencies
The application includes presets for popular cryptocurrencies:
- Ethereum (ETH), XRP, Cardano (ADA), Solana (SOL)
- Polkadot (DOT), Chainlink (LINK), Litecoin (LTC)
- Polygon (MATIC), Avalanche (AVAX), Uniswap (UNI)
- And many more!

### Example URLs
- Default: `http://localhost:8080` (ETH & XRP)
- DeFi tokens: `http://localhost:8080?cryptos=ethereum,uniswap,chainlink`
- Layer 1s: `http://localhost:8080?cryptos=ethereum,cardano,solana,polkadot`
- Custom mix: `http://localhost:8080?cryptos=ripple,litecoin,avalanche-2`

## Prerequisites

- Docker or Podman installed on your system

## Building the Docker Image

To build the Docker image, run the following command from the root directory of the project:

```bash
docker build -t crypto-analyzer .
```

Or if you're using Podman:

```bash
podman build -t crypto-analyzer .
```

## Running the Container

To run the container, execute:

```bash
docker run -d -p 8080:8080 --name crypto-analyzer-app crypto-analyzer
```

Or with Podman:

```bash
podman run -d -p 8080:8080 --name crypto-analyzer-app crypto-analyzer
```

The application will be available at [http://localhost:8080](http://localhost:8080).

## How It Works

The Dockerfile uses a multi-stage build process:

1. **Build Stage**: Uses Red Hat UBI9 Node.js 18 image to:
   - Install dependencies
   - Build the React application with the title "Crypto Price Analyzer"

2. **Production Stage**: Uses Nginx Alpine image to:
   - Serve the built static files
   - Configure Nginx to handle API proxying to CoinGecko
   - Run on port 8080

## Configuration

The Nginx configuration includes a proxy for the CoinGecko API to avoid CORS issues. The proxy forwards requests from `/api/coingecko/` to `https://api.coingecko.com/`.

## Stopping the Container

To stop and remove the running container:

```bash
docker stop crypto-analyzer-app && docker rm crypto-analyzer-app
```

Or with Podman:

```bash
podman stop crypto-analyzer-app && podman rm crypto-analyzer-app
```

## License

This project is open source and available under the MIT License.
