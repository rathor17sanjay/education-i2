FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Next.js reads .env.production automatically during `next build`, inlining
# NEXT_PUBLIC_* vars into the client bundle -- no Docker ARG plumbing needed,
# see .env.production (git-ignored, shipped alongside this Dockerfile at
# deploy time rather than baked into the image build history). NODE_ENV is
# set only after npm ci/build, not before -- setting it earlier makes npm
# skip devDependencies (typescript, tailwind, etc.) that `next build` needs.
RUN npm run build
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]
