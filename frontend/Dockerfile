# --- Stage 1: Build the Vue application ---
# Use a Node.js image as the builder. 'alpine' is a lightweight version.
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application for production. 
# This runs the "build" script in your package.json and creates a /dist folder.
RUN npm run build


# --- Stage 2: Serve the built assets with Nginx ---
# Use a lightweight Nginx image for the final, small production container
FROM nginx:stable-alpine

# Copy the built files from the 'builder' stage's /dist folder
# into the default Nginx public HTML directory.
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration file into the container.
# This will tell Nginx how to handle routing for a Single Page Application (SPA).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 to allow traffic to the Nginx server
EXPOSE 80

# The default Nginx command starts the server, so we don't need a CMD.