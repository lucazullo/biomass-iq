FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg2 and faster installs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

RUN chmod +x entrypoint.sh

# Railway injects PORT at runtime
EXPOSE 8000

CMD ["./entrypoint.sh"]
