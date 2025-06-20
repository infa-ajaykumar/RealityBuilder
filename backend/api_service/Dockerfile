# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build --if-present

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variable
ENV NODE_ENV production

# Run the app when the container launches
CMD ["node", "dist/index.js"]
