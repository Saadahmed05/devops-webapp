# Jenkins controller with Node.js, Docker CLI and kubectl preinstalled
FROM jenkins/jenkins:lts-jdk17

USER root

# Node.js 22 (+ npm) copied from the official Node image, used by the "Install & Test" stage
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Docker CLI (talks to the host Docker engine through the mounted socket) and kubectl
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list \
 && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli \
 && curl -fsSLo /usr/local/bin/kubectl "https://dl.k8s.io/release/v1.36.1/bin/linux/$(dpkg --print-architecture)/kubectl" \
 && chmod +x /usr/local/bin/kubectl \
 && rm -rf /var/lib/apt/lists/*

USER jenkins

# Plugins: pipeline, git, credentials, Configuration-as-Code (JCasC) and Job DSL
RUN jenkins-plugin-cli --plugins \
    git workflow-aggregator credentials-binding timestamper pipeline-stage-view \
    configuration-as-code job-dsl
