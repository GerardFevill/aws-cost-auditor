# AWS Cost Auditor

Outil web complet pour auditer les coûts et ressources de vos comptes AWS.

## Fonctionnalités

- **Audit complet** de tous les services AWS
- **Dashboard** avec vue d'ensemble des coûts
- **Détection automatique** des problèmes et recommandations
- **Sélection flexible** des services à auditer
- **Interface AWS Cloudscape** (thème AWS officiel)
- **Déploiement serverless** (Lambda + S3)

## Services AWS audités

| Catégorie | Services |
|-----------|----------|
| **Compute** | EC2, Lambda, ECS, EKS, Lightsail, Batch, Elastic Beanstalk |
| **Storage** | S3, EBS, EFS, FSx, Backup |
| **Database** | RDS, DynamoDB, ElastiCache, Redshift, DocumentDB, Neptune |
| **Network** | VPC, CloudFront, Route53, API Gateway, ELB, NAT Gateway |
| **Security** | IAM, KMS, Secrets Manager, ACM, WAF, GuardDuty |
| **Analytics** | Athena, EMR, Kinesis, OpenSearch, Glue |
| **Integration** | SQS, SNS, EventBridge, Step Functions |
| **Management** | CloudWatch, CloudTrail, Config, SSM, Organizations |
| **Containers** | ECR |
| **AI/ML** | SageMaker, Bedrock |
| **Cost** | Cost Explorer, Budgets |

## Architecture

```
aws-cost-auditor/
├── backend/           # API Lambda (Node.js + TypeScript)
│   ├── src/
│   │   ├── services/  # Services d'audit par catégorie
│   │   ├── types/     # Types TypeScript
│   │   └── index.ts   # Handler Lambda
│   └── tests/         # Tests Jest
│
└── frontend/          # Angular 17 + Cloudscape
    ├── src/
    │   ├── app/
    │   │   ├── pages/      # Login, Dashboard, Audit, Results
    │   │   ├── services/   # Service API
    │   │   └── models/     # Types et constantes
    │   └── styles.scss
    └── angular.json
```

## Prérequis

- Node.js 18+
- npm ou yarn
- Compte AWS avec credentials IAM

## Installation

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

## Développement local

### Backend

```bash
cd backend
npm run dev
# API disponible sur http://localhost:3000
```

### Frontend

```bash
cd frontend
npm start
# Application disponible sur http://localhost:4200
```

## Tests

### Backend

```bash
cd backend
npm test                 # Lancer les tests
npm run test:coverage    # Avec couverture
```

### Frontend

```bash
cd frontend
npm test                 # Lancer les tests
npm run test:ci          # Mode CI (headless)
```

## Déploiement AWS

### 1. Backend (Lambda)

```bash
cd backend
npm run build
npm run package
# Créer la fonction Lambda et uploader lambda.zip
```

### 2. API Gateway

Créer une API REST avec les routes :
- `GET /services` - Liste des services
- `POST /validate` - Validation credentials
- `POST /audit` - Lancer un audit
- `POST /audit/{category}` - Audit par catégorie

### 3. Frontend (S3 + CloudFront)

```bash
cd frontend
npm run build:prod
# Uploader dist/aws-cost-auditor vers S3
# Configurer CloudFront pour la distribution
```

Mettre à jour `environment.prod.ts` avec l'URL de l'API Gateway.

## Permissions IAM requises

L'utilisateur doit avoir une policy avec ces permissions :

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AWSCostAuditReadOnly",
            "Effect": "Allow",
            "Action": [
                "ce:Get*", "ce:Describe*", "ce:List*",
                "budgets:Describe*", "budgets:View*",
                "ec2:Describe*",
                "s3:List*", "s3:GetBucket*",
                "rds:Describe*",
                "lambda:List*", "lambda:Get*",
                "iam:List*", "iam:Get*",
                "cloudwatch:GetMetric*", "cloudwatch:List*", "cloudwatch:Describe*",
                "logs:DescribeLogGroups",
                "ecs:Describe*", "ecs:List*",
                "eks:Describe*", "eks:List*",
                "dynamodb:Describe*", "dynamodb:List*",
                "elasticache:Describe*",
                "sqs:List*", "sqs:GetQueueAttributes",
                "sns:List*",
                "kms:List*", "kms:Describe*",
                "secretsmanager:List*",
                "acm:List*", "acm:Describe*",
                "cloudfront:List*", "cloudfront:GetDistribution",
                "route53:List*",
                "apigateway:GET",
                "elasticloadbalancing:Describe*",
                "cloudtrail:Describe*", "cloudtrail:GetTrailStatus",
                "config:Describe*",
                "guardduty:List*", "guardduty:Get*",
                "wafv2:List*",
                "ssm:Describe*", "ssm:List*",
                "organizations:Describe*", "organizations:List*",
                "ecr:Describe*", "ecr:List*", "ecr:GetLifecyclePolicy",
                "sagemaker:List*",
                "bedrock:List*",
                "athena:List*",
                "emr:List*",
                "kinesis:List*", "kinesis:DescribeStreamSummary",
                "es:List*", "es:Describe*",
                "glue:Get*",
                "events:List*",
                "states:List*",
                "backup:List*",
                "efs:Describe*",
                "fsx:Describe*",
                "redshift:Describe*",
                "neptune:Describe*",
                "docdb:Describe*",
                "batch:Describe*",
                "lightsail:Get*",
                "sts:GetCallerIdentity"
            ],
            "Resource": "*"
        }
    ]
}
```

## Sécurité

- Les credentials AWS sont transmis via headers HTTPS uniquement
- Aucune donnée sensible n'est stockée côté serveur
- Les credentials sont stockés en sessionStorage (effacés à la fermeture)
- Permissions en lecture seule uniquement

## Licence

MIT

## Auteur

AWS Cost Auditor - Audit complet des coûts AWS
