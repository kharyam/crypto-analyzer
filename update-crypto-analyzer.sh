#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Updating Crypto Price Analyzer with CORS proxy fix...${NC}"

# Check if the project directory exists
PROJECT_DIR="crypto-analyzer-app"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Project directory $PROJECT_DIR not found. Please run setup-crypto-analyzer.sh first.${NC}"
    exit 1
fi

# Copy the updated crypto-price-analyzer.tsx component to the project
echo -e "${GREEN}Copying updated crypto price analyzer component...${NC}"
cp crypto-price-analyzer.tsx $PROJECT_DIR/src/CryptoPriceAnalyzer.tsx

# Update vite.config.ts to add proxy for CoinGecko API
echo -e "${GREEN}Updating Vite configuration with proxy for CoinGecko API...${NC}"
cat > $PROJECT_DIR/vite.config.ts << 'EOL'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    open: true,
    proxy: {
      '/api/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, '')
      }
    }
  }
})
EOL

echo -e "${GREEN}Update complete!${NC}"
echo -e "${YELLOW}To start the application, run:${NC}"
echo -e "${GREEN}cd ${PROJECT_DIR} && ./start.sh${NC}"
echo -e "${YELLOW}The application will be available at:${NC} ${GREEN}http://localhost:8080${NC}"
