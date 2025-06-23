# Crypto Analyzer Docker Setup

This document provides instructions for building and running the Crypto Analyzer application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, for easier management)

## Building the Docker Image

To build the Docker image, run the following command from the project root directory:

```bash
docker build -t crypto-analyzer .
```

This will create a Docker image named `crypto-analyzer` based on the provided Dockerfile.

## Running the Container

To run the container, use the following command:

```bash
docker run -p 8080:8080 crypto-analyzer
```

This will start the container and map port 8080 from the container to port 8080 on your host machine.

You can then access the application by navigating to:

```
http://localhost:8080
```

## Using Docker Compose (Optional)

For easier management, you can use Docker Compose. Create a `docker-compose.yml` file with the following content:

```yaml
version: '3'
services:
  crypto-analyzer:
    build: .
    ports:
      - "8080:8080"
```

Then run:

```bash
docker-compose up
```

To build and start the container in one command.

## Notes

- The application uses the CoinGecko API for cryptocurrency data
- The Nginx server inside the container is configured to proxy API requests to CoinGecko
- The application runs on port 8080 inside the container
