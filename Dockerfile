# Build stage
FROM registry.access.redhat.com/ubi9/nodejs-18 as build

USER root

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY crypto-analyzer-app/package*.json ./
RUN npm install

# Copy source files
COPY crypto-analyzer-app/ ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Copy built files from build stage to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
