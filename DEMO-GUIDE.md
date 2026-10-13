# Demo Guide: showing every step to faculty

A step-by-step script for demonstrating the project by hand. Every command is for **PowerShell** on Windows
and is run from the project folder unless a step says otherwise:

```powershell
cd $HOME\OneDrive\Documents\DevOps-Project
```

Total time: about 25–30 minutes (Part 7 is optional).

| Part | What it shows | Time |
|---|---|---|
| 0 | Preparation (do this **before** the faculty arrives) | 10 min |
| 1 | The code and project structure | 3 min |
| 2 | Run the app and its tests without Docker | 3 min |
| 3 | Docker: build an image and run a container | 4 min |
| 4 | Docker Hub: push the image to a registry | 2 min |
| 5 | Kubernetes: deploy, load balancing, self-healing, scaling, rollback | 7 min |
| 6 | CI/CD: one `git push` runs GitHub Actions **and** Jenkins | 6 min |
| 7 | (Optional) A failing test stops the pipeline | 4 min |

---

## Part 0: Preparation (before the demo)

1. **Restart Windows** if Docker Desktop has had problems today. It clears stuck files that stop Docker from starting.
2. Open **Docker Desktop** and wait until the bottom-left shows the **Engine running** and **Kubernetes running** (green).
3. Check the cluster:
   ```powershell
   kubectl get nodes
   ```
   Expected: `docker-desktop   Ready   control-plane`
4. Start Jenkins:
   ```powershell
   cd jenkins
   docker compose up -d
   cd ..
   ```
   Wait about 1 minute, then open http://localhost:8090 and **Sign in** with the admin user from `jenkins\.env`.
5. Stop anything left on port 3000 from earlier tests:
   ```powershell
   docker compose down
   ```
6. Open these browser tabs in advance:
   - http://localhost:8090/job/devops-webapp/ (Jenkins)
   - https://github.com/Saadahmed05/devops-webapp/actions (GitHub Actions, signed in to GitHub so the logs are visible)
   - https://hub.docker.com/r/saadahmed05/devops-webapp/tags (Docker Hub)
7. Open the project folder in **VS Code**: `code .`

---

## Part 1: The code and project structure

Show in VS Code and explain each part:

| File / folder | Say this |
|---|---|
| `app/src/app.js` | The web app: a REST API for tasks, `/health` for health checks, `/api/info` shows which container answered. |
| `app/tests/app.test.js` | Automated tests (Jest + Supertest). Pipelines refuse to deploy if any test fails. |
| `Dockerfile` | Packages the app into an image: multi-stage build, non-root user, built-in health check. |
| `k8s/` | Kubernetes manifests: 3 replicas, rolling updates, probes, a NodePort service, autoscaler. |
| `.github/workflows/ci-cd.yml` | The GitHub Actions pipeline (runs in GitHub's cloud). |
| `Jenkinsfile` | The Jenkins pipeline (runs on this PC). |
| `jenkins/casc.yaml` | Jenkins configured as code: users, credentials and the job are created automatically. |

---

## Part 2: Run the app without Docker

```powershell
cd app
npm install
npm test
```

**Point out:** 5 tests pass, and the coverage table shows how much of the code is tested.

```powershell
npm start
```

Open http://localhost:3000, add a task, and show the **Deployment info** box. **hostname** is this PC's name.
Press `Ctrl + C` to stop the app, then go back to the project folder:

```powershell
cd ..
```

**Say:** "This works on my machine, but another machine needs the same Node version and dependencies.
Docker solves that."

---

## Part 3: Docker (build an image, run a container)

```powershell
docker build -t devops-webapp:latest .
docker images devops-webapp
```

**Point out:** the two build stages in the output, and the final image size.

```powershell
docker run -d --name demo -p 3000:3000 devops-webapp:latest
docker ps
```

Wait about 30 seconds and run `docker ps` again. **Point out:** the STATUS column changes to **(healthy)**.
That is the `HEALTHCHECK` from the Dockerfile.

Open http://localhost:3000. **hostname** is now the **container ID**, not the PC name.

```powershell
docker logs demo
docker exec demo whoami
```

**Point out:** `whoami` prints `node`. The app runs as a non-root user (security best practice).

Clean up:

```powershell
docker rm -f demo
```

*(Alternative: `docker compose up -d --build` starts the same container from `docker-compose.yml`, then `docker compose down` stops it.)*

---

## Part 4: Docker Hub (push the image to a registry)

```powershell
docker login -u saadahmed05
```

When asked for a password, paste your **Docker Hub access token**. It is not shown on screen.

```powershell
docker tag devops-webapp:latest saadahmed05/devops-webapp:manual-demo
docker push saadahmed05/devops-webapp:manual-demo
```

Refresh the Docker Hub tab. **Point out:** the new `manual-demo` tag next to the tags the pipelines pushed
(commit IDs from GitHub Actions, `jenkins-N` from Jenkins).

**Say:** "A registry is how the image moves from the build machine to the servers that run it."

---

## Part 5: Kubernetes

### 5.1 Deploy

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
kubectl -n devops-webapp get all
```

**Point out:** 3 pods `Running`, the service on port **30080**, the deployment `3/3`.
(If the app is already deployed, `apply` just says `unchanged`. Kubernetes is declarative: it makes the
cluster match the files.)

Open http://localhost:30080. **hostname** is now a **pod name**.

### 5.2 Load balancing

```powershell
1..9 | ForEach-Object { (Invoke-RestMethod http://localhost:30080/api/info -DisableKeepAlive).hostname }
```

**Point out:** the requests are spread across the 3 different pod names.

### 5.3 Self-healing

```powershell
kubectl -n devops-webapp get pods
kubectl -n devops-webapp delete pod <paste-one-pod-name>
kubectl -n devops-webapp get pods
```

**Point out:** Kubernetes immediately creates a replacement pod (new name, age a few seconds), so 3 are
running again. The app never went down.

### 5.4 Scaling

```powershell
kubectl -n devops-webapp scale deployment devops-webapp --replicas=5
kubectl -n devops-webapp get pods
kubectl -n devops-webapp scale deployment devops-webapp --replicas=3
```

### 5.5 Rolling update and rollback

```powershell
kubectl -n devops-webapp rollout history deployment/devops-webapp
kubectl -n devops-webapp rollout undo deployment/devops-webapp
kubectl -n devops-webapp rollout status deployment/devops-webapp
kubectl -n devops-webapp get deployment devops-webapp -o wide
```

**Point out:** the IMAGES column changes back to the previous version, and pods are replaced one at a
time (`maxUnavailable: 0`), so there is zero downtime. Run `rollout undo` once more to return to the latest version.

---

## Part 6: CI/CD (one push runs both pipelines)

### 6.1 Make a change

Open `k8s\configmap.yaml` and change the version (for example `"1.1.0"` to `"1.2.0"`). Or change the
subtitle text in `app\public\index.html`. Then:

```powershell
git add .
git commit -m "Release version 1.2.0"
git push
```

### 6.2 GitHub Actions (cloud)

Go to the **Actions** tab and click the new run. **Point out:**
- The 3 jobs run in order: **Build & Test**, then **Docker Build & Push**, then **Deploy to Kubernetes**. Each waits for the previous one.
- Click a job to show the live logs: `npm test`, the Docker push, and `kubectl rollout status` in the deploy job.
- Settings, then Secrets and variables, then Actions: the Docker Hub token is stored as an encrypted secret, not in the code.
- The deploy job creates a temporary Kubernetes cluster (kind) inside GitHub, because GitHub can't reach the cluster on this PC.

Takes about 2–3 minutes.

### 6.3 Jenkins (local)

Within 2 minutes Jenkins notices the new commit and starts a build by itself (it polls GitHub). You can
also click **Build Now** to start it immediately. **Point out:**
- **Stage View**: Checkout, Install & Test, Build Docker Image, Smoke Test, Push to Docker Hub, Deploy to Kubernetes.
- Click the build, then **Console Output**, to show each command running.
- Credentials (**Manage Jenkins**, then **Credentials**): `dockerhub-creds` and `kubeconfig`, both created from `casc.yaml`.

Takes about 4–6 minutes.

### 6.4 Show the result

```powershell
kubectl -n devops-webapp get pods
kubectl -n devops-webapp get deployment devops-webapp -o wide
```

Refresh http://localhost:30080. **Point out:** new pod names, the image tag `jenkins-N`, and the new
**version** number. Nobody ran a single deploy command by hand.

---

## Part 7 (optional): a failing test stops the pipeline

Shows that broken code never reaches users. Open `app\tests\app.test.js` and change
`expect(res.body.status).toBe('UP');` to `toBe('DOWN')`, then:

```powershell
git commit -am "Demo: broken test"
git push
```

**Point out:** GitHub Actions fails at **Build & Test** and the later jobs are skipped. Jenkins fails at
**Install & Test**. The running app at http://localhost:30080 is untouched.

Then undo it:

```powershell
git revert --no-edit HEAD
git push
```

Both pipelines go green again.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Docker Desktop closes or won't start | Restart Windows, then open Docker Desktop again. |
| `port is already allocated` on 3000 | `docker compose down` and `docker rm -f demo` |
| Jenkins page doesn't open | `cd jenkins` then `docker compose up -d`. Jenkins uses port **8090** (8080 is used by another program). |
| Jenkins push fails with a timeout | Slow internet. The pipeline retries 3 times; if all fail, click **Build Now** again. |
| `kubectl` says `connection refused` | Kubernetes isn't running yet. Wait for the green status in Docker Desktop. |
| GitHub says "Sign in to view logs" | Sign in to GitHub in that browser. |

## Likely viva questions

- **Why Docker?** The same image runs identically everywhere, which removes "works on my machine" problems.
- **Why Kubernetes?** It keeps the app running: replicas, self-healing, load balancing, scaling, zero-downtime updates and rollback.
- **Why both GitHub Actions and Jenkins?** GitHub Actions is a hosted CI/CD service (no server to manage). Jenkins is self-hosted and fully customisable. The project shows the same pipeline in both.
- **CI vs CD?** CI means every change is automatically built and tested. CD means every change that passes is automatically released and deployed.
- **Where are the secrets?** In GitHub encrypted secrets and the Jenkins credentials store (loaded from a git-ignored `.env`), never in the code.
- **Why do tasks disappear after a refresh on port 30080?** Each pod keeps tasks in its own memory. A real app would use a shared database (listed in Future Scope).
