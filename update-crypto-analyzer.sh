#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Updating Crypto Price Analyzer with CORS proxy fix and price display fix...${NC}"

# Check if the project directory exists
PROJECT_DIR="crypto-analyzer-app"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Project directory $PROJECT_DIR not found. Please run setup-crypto-analyzer.sh first.${NC}"
    exit 1
fi

# Copy the updated crypto-price-analyzer.tsx component to the project
echo -e "${GREEN}Copying updated crypto price analyzer component...${NC}"
cp crypto-price-analyzer.tsx $PROJECT_DIR/src/CryptoPriceAnalyzer.tsx

# Update index.html with the correct title
echo -e "${GREEN}Updating application title...${NC}"
cat > $PROJECT_DIR/index.html << 'EOL'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Crypto Price Analyzer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOL

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
echo -e "${YELLOW}Note: This update includes the following improvements:${NC}"
echo -e "  ${GREEN}1. CORS errors when calling the CoinGecko API${NC}"
echo -e "  ${GREEN}2. Incorrect (too high) cryptocurrency prices${NC}"
echo -e "  ${GREEN}3. Improved XRP/BTC ratio precision in charts and display${NC}"
echo -e "  ${GREEN}4. Added current price as the final point on the graphs${NC}"
echo -e "${YELLOW}To start the application, run:${NC}"
echo -e "${GREEN}cd ${PROJECT_DIR} && ./start.sh${NC}"
echo -e "${YELLOW}The application will be available at:${NC} ${GREEN}http://localhost:8080${NC}"
