# Containerized Web Application with Automated CI/CD

A Node.js web app that is containerized with **Docker**, tested and shipped by **GitHub Actions** and **Jenkins**, and deployed to **Kubernetes**.

## Architecture

```
 Developer ──git push──▶ GitHub repo
                           │
           ┌───────────────┴────────────────┐
           ▼                                ▼
   GitHub Actions                       Jenkins
   (ci-cd.yml)                         (Jenkinsfile)
   1. npm ci + jest                     1. Checkout
   2. docker build + smoke test         2. npm ci + jest (in node container)
   3. push → Docker Hub                 3. docker build + smoke test
   4. kubectl apply / set image         4. push → Docker Hub
           │                            5. kubectl apply / set image
           └───────────────┬────────────────┘
                           ▼
                Docker Hub: <user>/devops-webapp:<tag>
                           ▼
          Kubernetes (namespace devops-webapp)
          Deployment (3 replicas, rolling update, probes)
          Service NodePort :30080 · ConfigMap · HPA
```

## Project structure

| Path | Purpose |
|---|---|
| `app/` | Express web app (`src/`), static UI (`public/`), Jest tests (`tests/`) |
| `Dockerfile` | Multi-stage, non-root, health-checked image |
| `docker-compose.yml` | Run the app locally with one command |
| `.github/workflows/ci-cd.yml` | GitHub Actions pipeline: test → build/push → deploy |
| `Jenkinsfile` | Jenkins declarative pipeline (same stages) |
| `jenkins/` | Jenkins image (with Docker CLI + kubectl) and compose file |
| `k8s/` | Namespace, ConfigMap, Deployment, Service, HPA |

App endpoints: `/` (UI), `/health`, `/api/info` (shows which pod answered), `/api/tasks` (demo CRUD).

---

## Step 1: Run locally

```bash
cd app && npm install && npm test && npm start     # http://localhost:3000
```

## Step 2: Docker

```bash
docker compose up --build        # http://localhost:3000
docker compose down
```

## Step 3: Kubernetes (local cluster)

Turn on Kubernetes in **Docker Desktop → Settings → Kubernetes**, or use `minikube start`.

```bash
docker build -t devops-webapp:latest .
# minikube only: minikube image load devops-webapp:latest
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
kubectl -n devops-webapp get pods,svc
```

Open http://localhost:30080 (Docker Desktop). On minikube, run `minikube service devops-webapp -n devops-webapp`.
Refresh `/api/info` to see different pod hostnames, which shows load balancing across replicas.

Useful demo commands:
```bash
kubectl -n devops-webapp scale deployment devops-webapp --replicas=5
kubectl -n devops-webapp rollout history deployment/devops-webapp
kubectl -n devops-webapp rollout undo deployment/devops-webapp
```

## Step 4: GitHub Actions CI/CD

1. Push this project to the GitHub repo `Saadahmed05/devops-webapp` on the `main` branch.
2. Create a Docker Hub access token (Docker Hub → Account Settings → Personal access tokens, *Read & Write*).
3. In GitHub → **Settings → Secrets and variables → Actions → New repository secret**, add `DOCKERHUB_TOKEN`.
   (The Docker Hub username `saadahmed05` is set in the workflow file.)
4. Push a commit. The **Actions** tab shows `Build & Test → Docker Build & Push → Deploy to Kubernetes`.

> GitHub's cloud runners can't reach the Kubernetes cluster on your PC, so the `deploy` job creates a temporary
> Kubernetes cluster ([kind](https://kind.sigs.k8s.io/)) inside the runner, deploys the new image from Docker Hub,
> waits for the rollout and calls `/health`. Jenkins (below) deploys the same image to your real local cluster.

## Step 5: Jenkins CI/CD

Jenkins is configured entirely as code (`jenkins/casc.yaml`): admin user, credentials and the pipeline job are
created automatically, so there is no setup wizard.

1. Create the Jenkins kubeconfig (Docker Desktop cluster, reachable from inside containers):
   ```bash
   kubectl config view --minify --flatten --context docker-desktop | sed 's#127.0.0.1#kubernetes.docker.internal#' > jenkins/kubeconfig
   ```
2. Copy `jenkins/.env.example` to `jenkins/.env` and fill in your admin password and Docker Hub token.
   `.env` and `kubeconfig` are git-ignored, so secrets never reach GitHub.
3. Start Jenkins:
   ```bash
   cd jenkins && docker compose up -d --build
   ```
4. Open http://localhost:8080, log in, open the **devops-webapp** job and click **Build Now**.
   Stages: Checkout → Install & Test → Build Docker Image → Smoke Test → Push to Docker Hub → Deploy to Kubernetes.
   After the first build, Jenkins polls GitHub every 5 minutes and builds automatically on new commits.

## Pipeline features

- Automated unit tests with coverage on every push and PR
- Multi-stage Docker build, non-root user, `HEALTHCHECK`
- Image tags are traceable (commit SHA / build number) and `latest` is also pushed
- Smoke test of the built container before pushing
- Zero-downtime rolling updates (`maxUnavailable: 0`) with readiness and liveness probes
- Automatic `rollout undo` if the deployment fails
- Horizontal Pod Autoscaler (2–6 pods at 70% CPU; needs metrics-server)
