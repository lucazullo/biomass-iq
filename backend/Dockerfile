FROM python:3.12-slim

# Set PYTHONUNBUFFERED so print() flushes immediately (Railway log visibility)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps first for cache-friendly layers
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy application code (includes scripts/ and parsed_samples.json)
COPY . .

EXPOSE 8080

# Python starter (no bash dependency, line-buffered logs)
CMD ["python", "scripts/start.py"]
