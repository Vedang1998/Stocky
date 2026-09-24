# Secret-free probe image. Built only on runners that have Docker.
# Not used to execute PR-supplied Dockerfiles.
FROM node:22.19.0-bookworm-slim
USER 0
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client redis-tools ca-certificates \
  && rm -rf /var/lib/apt/lists/*
USER 65534:65534
WORKDIR /probe
