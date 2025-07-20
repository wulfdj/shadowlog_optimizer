# --- Stage 1: Build the Go binary ---
FROM golang:1.24.5-alpine3.22 AS go-builder

WORKDIR /src

# Copy the go.mod and go.sum files to cache dependencies
COPY go-optimizer/go.mod go-optimizer/go.sum ./
RUN go mod download

# Copy the Go source code
COPY go-optimizer/ .

# Build the Go application into a static executable
RUN GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o optimizer .

RUN ls -la /src

# --- Stage 2: Build the Node.js application ---
FROM node:24-alpine3.22

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy Node.js source code
COPY . .

# Compile the TypeScript code
RUN npm run build

# --- Copy the built Go binary from the builder stage ---
COPY --from=go-builder /src/optimizer /usr/local/bin/optimizer

RUN chmod a+x /usr/local/bin/optimizer

RUN ls -la /usr/local/bin/optimizer

EXPOSE 3000
CMD [ "npm", "run", "start" ]