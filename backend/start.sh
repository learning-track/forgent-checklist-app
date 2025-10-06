#!/bin/bash

echo "Waiting for database to be ready..."
python -c "
import time
import psycopg2
while True:
    try:
        conn = psycopg2.connect(
            host='postgres', 
            port=5432, 
            user='postgres', 
            password='postgres', 
            dbname='forgent_checklist'
        )
        conn.close()
        break
    except:
        time.sleep(2)
"

echo "Database is ready!"
echo "Running database migrations..."
alembic upgrade head

echo "Setting up initial data..."
cd /app && PYTHONPATH=/app python app/scripts/setup_initial_data.py

echo "Verifying setup..."
cd /app && PYTHONPATH=/app python test_setup.py

echo "Starting FastAPI server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
