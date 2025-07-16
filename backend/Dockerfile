FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# --- THE CRUCIAL BUILD STEP ---
# This runs "tsc" which compiles src/*.ts into dist/*.js
RUN npm run build

# After the build, we can remove the devDependencies to make the final image smaller
# The --omit=dev flag is available in npm v7+
#RUN npm prune --production

# Expose the port the application runs on
EXPOSE 3000

# The command to run the application. 
# This is now handled by the 'command' directive in docker-compose.prod.yml
# but it's good practice to have a default CMD here.
CMD [ "npm", "run", "start" ]