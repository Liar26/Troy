FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
# On first start the gallery is empty; run the import once (see DEPLOY.md), or bake data/paintings.json into the image.
CMD ["node", "server.js"]
