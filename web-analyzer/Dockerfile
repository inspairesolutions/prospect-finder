FROM mcr.microsoft.com/playwright/python:v1.59.0-noble

WORKDIR /app

# Install dependencies first (cache-friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker code
COPY . .

CMD ["python", "worker.py"]
