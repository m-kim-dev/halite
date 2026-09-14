ARG QA_BASE=node:24-bookworm-slim
FROM node:24-bookworm-slim AS node-runtime
FROM ${QA_BASE}
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY package.deb /qa/package.deb
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends xvfb xauth dbus-x11 fonts-dejavu-core procps util-linux /qa/package.deb && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1200 tester
COPY package.json /qa/package.json
COPY node_modules /qa/node_modules
COPY scripts /qa/scripts
COPY tests /qa/tests
RUN mkdir -p /qa/test-results && chown -R tester:tester /qa/test-results
WORKDIR /qa
CMD ["sh", "/qa/scripts/linux-qa/check-installed.sh"]
