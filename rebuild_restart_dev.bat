cd backend
docker build -t shadowlog-optimizer/backend .
cd ..
docker-compose down
docker-compose up --build