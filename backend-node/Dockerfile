FROM node:22-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install Node dependencies
RUN npm install

# Install Playwright browsers (if needed for @playwright/test)
RUN npx playwright install --with-deps

COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000
EXPOSE 5000
EXPOSE 8080

CMD ["npx", "ts-node", "--transpile-only", "src/index.ts"]
