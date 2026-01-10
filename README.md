# AWS Cost Auditor

A comprehensive web application to audit and optimize your AWS infrastructure costs. Analyze 200+ AWS services, identify unused resources, and get actionable recommendations to reduce your cloud spending.

## Features

- **Cost Analysis** - Deep dive into your AWS spending patterns and trends
- **Resource Audit** - Identify unused, underutilized, or misconfigured resources
- **Smart Recommendations** - Get actionable suggestions to reduce costs
- **200+ AWS Services** - Comprehensive coverage across all AWS service categories
- **Real-time Progress** - SSE streaming for live audit progress updates
- **Multi-language** - English and French support
- **Dark/Light Mode** - Toggle between themes

## Architecture

```
aws-cost-auditor/
├── backend/          # Node.js/Express API server
│   ├── src/
│   │   ├── services/ # AWS service auditors
│   │   ├── types/    # TypeScript definitions
│   │   └── index.ts  # Main entry point
│   └── package.json
│
└── frontend/         # Angular 17 application
    ├── src/
    │   ├── app/
    │   │   ├── pages/      # Login, Dashboard, Audit, Results, Help
    │   │   ├── services/   # AWS, Theme, i18n services
    │   │   └── models/     # TypeScript models
    │   └── styles.scss
    └── package.json
```

## Prerequisites

- Node.js 18+
- npm or yarn
- AWS credentials with read-only access

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

## Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

The API server will start at `http://localhost:3000`

### Start Frontend

```bash
cd frontend
npm start
```

The application will be available at `http://localhost:4200`

## AWS IAM Permissions

Create an IAM user or role with read-only access. Here's a minimal policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:*",
        "budgets:View*",
        "ec2:Describe*",
        "s3:List*",
        "s3:GetBucket*",
        "rds:Describe*",
        "lambda:List*",
        "lambda:Get*",
        "iam:List*",
        "iam:Get*",
        "cloudwatch:Get*",
        "cloudwatch:List*"
      ],
      "Resource": "*"
    }
  ]
}
```

For full coverage of all 200+ services, see the complete IAM policy in the Help page of the application.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/services` | List available AWS services |
| POST | `/validate` | Validate AWS credentials |
| POST | `/audit/stream` | Run audit with SSE streaming |
| POST | `/audit/:category` | Run audit for specific category |

## Supported AWS Service Categories

- **Cost Management** - Cost Explorer, Budgets, Savings Plans
- **Compute** - EC2, Lambda, ECS, EKS, Lightsail, Batch
- **Storage** - S3, EFS, FSx, Backup, Glacier
- **Database** - RDS, DynamoDB, ElastiCache, Redshift, Neptune
- **Network** - VPC, CloudFront, Route 53, API Gateway, ELB
- **Security** - IAM, KMS, WAF, GuardDuty, Inspector, Macie
- **Analytics** - Athena, EMR, Kinesis, Glue, OpenSearch
- **Integration** - SQS, SNS, EventBridge, Step Functions
- **Management** - CloudWatch, CloudTrail, Config, Systems Manager
- **Containers** - ECR, ECS, EKS
- **AI/ML** - SageMaker, Bedrock, Comprehend, Rekognition
- **Developer Tools** - CodeCommit, CodeBuild, CodePipeline
- **IoT** - IoT Core, IoT Analytics, IoT Events
- **Media** - MediaConvert, MediaLive, IVS
- **Business** - WorkSpaces, SES, Connect, Pinpoint
- **Migration** - DMS, DataSync, Transfer Family

## Deployment to AWS

The project includes a GitHub Actions workflow for automatic deployment to AWS.

### AWS Resources Required

1. **S3 Bucket** - For hosting the frontend (static website)
2. **CloudFront Distribution** - For CDN and HTTPS (optional but recommended)
3. **Lambda Function** - For the backend API
4. **API Gateway** - To expose the Lambda function

### GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings > Secrets > Actions):

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key for deployment |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for deployment |
| `S3_BUCKET_NAME` | S3 bucket name for frontend |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID (optional) |

### Manual Deployment

#### Frontend to S3

```bash
cd frontend
npm run build -- --configuration=production
aws s3 sync dist/frontend/browser s3://YOUR_BUCKET_NAME --delete
```

#### Backend to Lambda

```bash
cd backend
npm run build
zip -r lambda.zip dist/ node_modules/ package.json
aws lambda update-function-code --function-name aws-cost-auditor-api --zip-file fileb://lambda.zip
```

## Security

- Credentials are stored only in memory and never persisted to disk
- All API calls are made directly to AWS
- No data is sent to third-party servers
- Session data is cleared when you close the browser

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Author

[GerardFevill](https://github.com/GerardFevill)
