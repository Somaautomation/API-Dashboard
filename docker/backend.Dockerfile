FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl ca-certificates tar \
    && rm -rf /var/lib/apt/lists/*

ARG K6_VERSION=0.51.0
RUN curl -fsSL -o /tmp/k6.tgz https://github.com/grafana/k6/releases/download/v${K6_VERSION}/k6-v${K6_VERSION}-linux-amd64.tar.gz \
    && tar -xzf /tmp/k6.tgz -C /tmp \
    && mv /tmp/k6-v${K6_VERSION}-linux-amd64/k6 /usr/local/bin/k6 \
    && chmod +x /usr/local/bin/k6 \
    && rm -rf /tmp/k6.tgz /tmp/k6-v${K6_VERSION}-linux-amd64

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "600"]
