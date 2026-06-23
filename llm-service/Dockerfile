FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 advisor

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R advisor:advisor /app
USER advisor

EXPOSE 11435
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "11435"]
