FROM node:24-alpine

WORKDIR /app

# Install dependencies into the image so the fe_node_modules named volume
# gets initialized with the correct Linux/arm64 binaries on first container start.
# Source code is still live-edited via the ./fe:/app bind mount.
COPY package.json package-lock.json ./
RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev"]
