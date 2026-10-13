// Declarative Jenkins pipeline: Test -> Build image -> Smoke test -> Push -> Deploy to Kubernetes
// Credentials (created automatically by jenkins/casc.yaml from jenkins/.env):
//   dockerhub-creds  (Username with password)  -> Docker Hub username + access token
//   kubeconfig       (Secret file)             -> kubeconfig for the target cluster
pipeline {
    agent any

    environment {
        DOCKERHUB_USER = credentials('dockerhub-creds')   // exposes DOCKERHUB_USER_USR / _PSW
        IMAGE_NAME     = "${DOCKERHUB_USER_USR}/devops-webapp"
        IMAGE_TAG      = "jenkins-${env.BUILD_NUMBER}"
        K8S_NAMESPACE  = 'devops-webapp'
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 20, unit: 'MINUTES')
    }

    triggers {
        // Poll GitHub every 2 min (or configure a GitHub webhook instead)
        pollSCM('H/2 * * * *')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Test') {
            steps {
                dir('app') {
                    sh 'node --version && npm --version'
                    sh 'npm ci'
                    sh 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Smoke Test Container') {
            steps {
                sh '''
                    docker rm -f smoke-${BUILD_NUMBER} 2>/dev/null || true
                    docker run -d --name smoke-${BUILD_NUMBER} ${IMAGE_NAME}:${IMAGE_TAG}
                    for i in $(seq 1 10); do
                      docker exec smoke-${BUILD_NUMBER} wget -qO- http://localhost:3000/health && break
                      sleep 2
                    done
                    docker exec smoke-${BUILD_NUMBER} wget -qO- http://localhost:3000/health
                '''
            }
            post {
                always { sh 'docker rm -f smoke-${BUILD_NUMBER} || true' }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh '''
                    echo "$DOCKERHUB_USER_PSW" | docker login -u "$DOCKERHUB_USER_USR" --password-stdin
                    docker push ${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                    sh '''
                        kubectl apply -f k8s/namespace.yaml
                        kubectl apply -f k8s/
                        kubectl -n ${K8S_NAMESPACE} set image deployment/devops-webapp web=${IMAGE_NAME}:${IMAGE_TAG}
                        kubectl -n ${K8S_NAMESPACE} rollout status deployment/devops-webapp --timeout=180s
                        kubectl -n ${K8S_NAMESPACE} get pods,svc -o wide
                    '''
                }
            }
        }
    }

    post {
        failure {
            withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                sh 'kubectl -n ${K8S_NAMESPACE} rollout undo deployment/devops-webapp || true'
            }
        }
        always {
            sh 'docker logout || true'
            sh 'docker image prune -f || true'
        }
        success {
            echo "Deployed ${IMAGE_NAME}:${IMAGE_TAG} successfully"
        }
    }
}
