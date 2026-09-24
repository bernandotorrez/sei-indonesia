FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime image only needs the built server output, not the source or dev dependencies.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
