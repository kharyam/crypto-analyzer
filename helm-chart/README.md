# Crypto Analyzer Helm Chart

This Helm chart deploys the Crypto Price Analyzer application on a Kubernetes cluster.

## Prerequisites

- Kubernetes 1.14+
- Helm 3.0+
- Ingress controller (optional, for ingress support)

## Installing the Chart

To install the chart with the release name `crypto-analyzer`:

```bash
helm install crypto-analyzer ./helm-chart
```

The command deploys the Crypto Price Analyzer application on the Kubernetes cluster with default configuration. The [Parameters](#parameters) section lists the parameters that can be configured during installation.

## Uninstalling the Chart

To uninstall/delete the `crypto-analyzer` deployment:

```bash
helm uninstall crypto-analyzer
```

## Parameters

The following table lists the configurable parameters of the Crypto Analyzer chart and their default values.

### Global parameters

| Parameter                 | Description                                     | Default                                                 |
|---------------------------|-------------------------------------------------|---------------------------------------------------------|
| `replicaCount`            | Number of replicas                              | `1`                                                     |
| `image.repository`        | Image repository                                | `crypto-analyzer`                                       |
| `image.tag`               | Image tag                                       | `latest`                                                |
| `image.pullPolicy`        | Image pull policy                               | `IfNotPresent`                                          |
| `imagePullSecrets`        | Image pull secrets                              | `[]`                                                    |
| `nameOverride`            | String to partially override fullname template  | `""`                                                    |
| `fullnameOverride`        | String to fully override fullname template      | `""`                                                    |

### Service parameters

| Parameter                 | Description                                     | Default                                                 |
|---------------------------|-------------------------------------------------|---------------------------------------------------------|
| `service.type`            | Kubernetes Service type                         | `ClusterIP`                                             |
| `service.port`            | Service HTTP port                               | `8080`                                                  |

### Ingress parameters

| Parameter                 | Description                                     | Default                                                 |
|---------------------------|-------------------------------------------------|---------------------------------------------------------|
| `ingress.enabled`         | Enable ingress controller resource              | `true`                                                  |
| `ingress.className`       | IngressClass that will be used                  | `nginx`                                                 |
| `ingress.annotations`     | Ingress annotations                             | `kubernetes.io/ingress.class: nginx`                    |
| `ingress.hosts[0].host`   | Hostname to your installation                   | `crypto-analyzer.local`                                 |
| `ingress.hosts[0].paths`  | Path within the host                            | `[{path: "/", pathType: "Prefix"}]`                     |
| `ingress.tls`             | TLS configuration                               | `[]`                                                    |

### Resource parameters

| Parameter                 | Description                                     | Default                                                 |
|---------------------------|-------------------------------------------------|---------------------------------------------------------|
| `resources.limits`        | The resources limits for containers             | `{cpu: 500m, memory: 512Mi}`                            |
| `resources.requests`      | The requested resources for containers          | `{cpu: 100m, memory: 128Mi}`                            |

### Nginx configuration parameters

| Parameter                       | Description                                     | Default                                                 |
|---------------------------------|-------------------------------------------------|---------------------------------------------------------|
| `nginxConfig.apiProxy.enabled`  | Enable API proxy for CoinGecko                  | `true`                                                  |
| `nginxConfig.apiProxy.coingeckoUrl` | CoinGecko API URL                           | `https://api.coingecko.com`                             |

### Autoscaling parameters

| Parameter                                | Description                                     | Default                                                 |
|------------------------------------------|-------------------------------------------------|---------------------------------------------------------|
| `autoscaling.enabled`                    | Enable autoscaling                              | `false`                                                 |
| `autoscaling.minReplicas`                | Minimum number of replicas                      | `1`                                                     |
| `autoscaling.maxReplicas`                | Maximum number of replicas                      | `10`                                                    |
| `autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization percentage           | `80`                                                    |

### Other parameters

| Parameter                 | Description                                     | Default                                                 |
|---------------------------|-------------------------------------------------|---------------------------------------------------------|
| `nodeSelector`            | Node labels for pod assignment                  | `{}`                                                    |
| `tolerations`             | Tolerations for pod assignment                  | `[]`                                                    |
| `affinity`                | Affinity for pod assignment                     | `{}`                                                    |

Specify each parameter using the `--set key=value[,key=value]` argument to `helm install`.

For example:

```bash
helm install crypto-analyzer ./helm-chart \
  --set replicaCount=2 \
  --set service.type=LoadBalancer
```

Alternatively, a YAML file that specifies the values for the parameters can be provided while installing the chart. For example:

```bash
helm install crypto-analyzer ./helm-chart -f values.yaml
```

## Configuration and Installation Details

### Ingress

This chart provides support for Ingress resources. If you have an ingress controller installed on your cluster, such as [nginx-ingress](https://kubernetes.github.io/ingress-nginx/) or [traefik](https://traefik.io/), you can utilize the ingress controller to serve your application.

To enable ingress integration, set `ingress.enabled` to `true`. The `ingress.hostname` property can be used to set the host name. The `ingress.tls` parameter can be used to add the TLS configuration for this host.

### TLS Secrets

The chart also facilitates the creation of TLS secrets for use with the Ingress controller, using the `ingress.tls` parameter.

### Scaling the Application

The application can be scaled by adjusting the `replicaCount` parameter or by enabling autoscaling with the `autoscaling.enabled` parameter.

## Persistence

The Crypto Price Analyzer application is a stateless application and does not require persistent storage.
