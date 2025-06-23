#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Crypto Price Analyzer...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js to continue.${NC}"
    exit 1
fi

# Create project directory
PROJECT_DIR="crypto-analyzer-app"
echo -e "${GREEN}Creating project directory: ${PROJECT_DIR}${NC}"
mkdir -p $PROJECT_DIR

# Copy the crypto-price-analyzer.tsx component
echo -e "${GREEN}Copying crypto price analyzer component...${NC}"
cp crypto-price-analyzer.tsx $PROJECT_DIR/

# Navigate to project directory
cd $PROJECT_DIR

# Initialize a new Vite React + TypeScript project
echo -e "${GREEN}Initializing a new Vite React + TypeScript project...${NC}"
npm create vite@latest . --template react-ts -- --skip-git

# Update index.html with the correct title
echo -e "${GREEN}Setting application title...${NC}"
cat > index.html << 'EOL'
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

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install
npm install recharts lucide-react

# Create main App component that uses the CryptoPriceAnalyzer
echo -e "${GREEN}Creating main App component...${NC}"
cat > src/App.tsx << 'EOL'
import './App.css'
import CryptoPriceAnalyzer from './CryptoPriceAnalyzer'

function App() {
  return (
    <div className="App">
      <CryptoPriceAnalyzer />
    </div>
  )
}

export default App
EOL

# Copy the CryptoPriceAnalyzer component to the src directory
echo -e "${GREEN}Setting up CryptoPriceAnalyzer component...${NC}"
cp ../crypto-price-analyzer.tsx src/CryptoPriceAnalyzer.tsx

# Update the CSS to include Tailwind-like styles
echo -e "${GREEN}Setting up CSS...${NC}"
cat > src/index.css << 'EOL'
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

/* Tailwind-like utility classes */
.min-h-screen { min-height: 100vh; }
.bg-gradient-to-br { background: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
.from-slate-900 { --tw-gradient-stops: #0f172a, #1e293b; }
.to-slate-800 { --tw-gradient-stops: var(--tw-gradient-stops), #1e293b; }
.p-6 { padding: 1.5rem; }
.max-w-7xl { max-width: 80rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.text-center { text-align: center; }
.mb-8 { margin-bottom: 2rem; }
.text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
.font-bold { font-weight: 700; }
.text-white { color: #ffffff; }
.mb-2 { margin-bottom: 0.5rem; }
.text-slate-300 { color: #cbd5e1; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.text-slate-400 { color: #94a3b8; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.mt-2 { margin-top: 0.5rem; }
.grid { display: grid; }
.gap-6 { gap: 1.5rem; }
.bg-slate-800\/50 { background-color: rgba(30, 41, 59, 0.5); }
.backdrop-blur-sm { backdrop-filter: blur(4px); }
.rounded-xl { border-radius: 0.75rem; }
.border { border-width: 1px; }
.border-slate-700 { border-color: #334155; }
.flex { display: flex; }
.items-center { align-items: center; }
.gap-3 { gap: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }
.w-10 { width: 2.5rem; }
.h-10 { height: 2.5rem; }
.bg-blue-600 { background-color: #2563eb; }
.rounded-full { border-radius: 9999px; }
.justify-center { justify-content: center; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.font-semibold { font-weight: 600; }
.gap-2 { gap: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.text-green-600 { color: #16a34a; }
.text-blue-600 { color: #2563eb; }
.text-yellow-600 { color: #ca8a04; }
.w-5 { width: 1.25rem; }
.h-5 { height: 1.25rem; }
.bg-slate-700 { background-color: #334155; }
.h-2 { height: 0.5rem; }
.bg-blue-500 { background-color: #3b82f6; }
.transition-all { transition-property: all; }
.duration-500 { transition-duration: 500ms; }
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.bg-orange-600 { background-color: #ea580c; }
.bg-orange-500 { background-color: #f97316; }
.w-12 { width: 3rem; }
.h-12 { height: 3rem; }
.bg-yellow-600 { background-color: #ca8a04; }
.text-2xl { font-size: 1.5rem; line-height: 2rem; }
.text-center { text-align: center; }
.mt-8 { margin-top: 2rem; }
.bg-blue-700 { background-color: #1d4ed8; }
.disabled\:bg-blue-800:disabled { background-color: #1e40af; }
.px-8 { padding-left: 2rem; padding-right: 2rem; }
.py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
.transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; }
.w-4 { width: 1rem; }
.h-4 { height: 1rem; }
.animate-spin { animation: spin 1s linear infinite; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Media queries for responsive design */
@media (min-width: 768px) {
  .md\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .lg\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
EOL

# Update vite.config.ts to use port 8080 and add proxy for CoinGecko API
echo -e "${GREEN}Configuring Vite to use port 8080 and proxy for CoinGecko API...${NC}"
cat > vite.config.ts << 'EOL'
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

# Create a start script
echo -e "${GREEN}Creating start script...${NC}"
cat > start.sh << 'EOL'
#!/bin/bash
npm run dev
EOL

chmod +x start.sh

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}To start the application, run:${NC}"
echo -e "${GREEN}cd ${PROJECT_DIR} && ./start.sh${NC}"
echo -e "${YELLOW}The application will be available at:${NC} ${GREEN}http://localhost:8080${NC}"
