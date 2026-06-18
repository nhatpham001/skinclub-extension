# Use Playwright's official image which includes browsers and dependencies
FROM mcr.microsoft.com/playwright:v1.61.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
