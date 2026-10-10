# Work container of the Codespace: PostgreSQL 17 client (same major version as the server)
# and the pinned dbmate release used for migrations.
FROM mcr.microsoft.com/devcontainers/base:trixie

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql-client \
 && rm -rf /var/lib/apt/lists/*

COPY db/scripts/install-dbmate.sh /tmp/install-dbmate.sh
RUN bash /tmp/install-dbmate.sh /usr/local/bin/dbmate && rm /tmp/install-dbmate.sh
