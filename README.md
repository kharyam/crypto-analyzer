# Crypto Price Analyzer Docker Setup

This repository contains a Dockerized version of the Crypto Price Analyzer application, which provides real-time cryptocurrency price analysis and trading recommendations.

## Features

- Real-time price tracking for Bitcoin, Ethereum, and XRP
- Price comparison charts and ratio analysis
- Trading recommendations based on cryptocurrency performance
- Proxy configuration for CoinGecko API to avoid CORS issues

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
   - Build the React application

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
