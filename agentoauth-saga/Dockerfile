# SPDX-License-Identifier: MIT
# One image for both org services; docker-compose sets the command per service.
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app

# Install deps first for better layer caching.
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir -e ".[a2a,supplier]"

# App code (orgs/ + demos/).
COPY orgs ./orgs
COPY demos ./demos

# Supplier server is the default; the buyer service overrides `command`.
EXPOSE 9999
CMD ["python", "-m", "orgs.supplier.server"]
