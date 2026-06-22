# SPDX-License-Identifier: MIT
# One image for all org services; docker-compose / Railway set the command per service:
#   supplier : python -m orgs.supplier.server
#   gateway  : python -m orgs.gateway.server   (live two-signature visual demo; see railway.json)
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app

# Install deps first for better layer caching.
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir -e ".[a2a,supplier,gateway]"

# App code (orgs/ + demos/).
COPY orgs ./orgs
COPY demos ./demos

# Default command = the live demo gateway (it lazily launches the supplier itself,
# binding 0.0.0.0:$PORT). docker-compose overrides this for the supplier service.
EXPOSE 8000
CMD ["python", "-m", "orgs.gateway.server"]
