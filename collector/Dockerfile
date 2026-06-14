FROM python:3.11-slim

# libpcap required by scapy for BPF filter compilation and live capture
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpcap-dev \
    libpcap0.8 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY grfics_collector.py .

ENTRYPOINT ["python", "grfics_collector.py"]
