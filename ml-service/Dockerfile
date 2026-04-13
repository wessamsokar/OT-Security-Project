FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --isolated --no-cache-dir --default-timeout=1200 --retries=10 -r requirements.txt

COPY . /app

EXPOSE 8001

CMD ["uvicorn", "api.api:app", "--host", "0.0.0.0", "--port", "8001"]
