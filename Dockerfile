FROM node:slim

COPY . .

RUN yarn install --production

ENTRYPOINT ["node", "/dist/main.js"]
