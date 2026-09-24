FROM node:22-alpine
WORKDIR /app

# sequelize-cli is a devDependency but is needed at runtime by the `migrate` service (see the
# root docker-compose.yml), so this deliberately does NOT use --omit=dev.
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4000

CMD ["node", "server.js"]
