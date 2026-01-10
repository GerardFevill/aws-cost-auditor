/**
 * Types pour l'AWS Cost Auditor
 */

// Credentials AWS fournis par l'utilisateur
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}

// Configuration d'audit
export interface AuditConfig {
  credentials: AWSCredentials;
  services: string[];
  regions?: string[];
}

// Résultat d'audit générique
export interface AuditResult {
  service: string;
  category: string;
  timestamp: string;
  success: boolean;
  error?: string;
  data: any;
  issues: AuditIssue[];
}

// Problème détecté
export interface AuditIssue {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  message: string;
  resources: string[];
  potentialSavings?: number;
  recommendation?: string;
}

// Catégories de services
export type ServiceCategory =
  | 'compute'
  | 'storage'
  | 'database'
  | 'network'
  | 'security'
  | 'analytics'
  | 'integration'
  | 'management'
  | 'containers'
  | 'ai-ml'
  | 'cost'
  | 'developer-tools'
  | 'iot'
  | 'media'
  | 'game'
  | 'business'
  | 'migration'
  | 'blockchain'
  | 'frontend-web'
  | 'end-user-computing'
  | 'customer-engagement';

// Définition d'un service AWS
export interface AWSService {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  icon?: string;
}

// Liste complète des services AWS (~200 services)
export const AWS_SERVICES: AWSService[] = [
  // ============ COMPUTE (15) ============
  { id: 'ec2', name: 'EC2', category: 'compute', description: 'Instances, volumes, snapshots, AMIs, Elastic IPs' },
  { id: 'lambda', name: 'Lambda', category: 'compute', description: 'Fonctions serverless' },
  { id: 'ecs', name: 'ECS', category: 'compute', description: 'Clusters de containers' },
  { id: 'eks', name: 'EKS', category: 'compute', description: 'Kubernetes managé' },
  { id: 'lightsail', name: 'Lightsail', category: 'compute', description: 'VPS simplifiés' },
  { id: 'beanstalk', name: 'Elastic Beanstalk', category: 'compute', description: 'PaaS' },
  { id: 'batch', name: 'Batch', category: 'compute', description: 'Traitement par lots' },
  { id: 'fargate', name: 'Fargate', category: 'compute', description: 'Containers serverless' },
  { id: 'apprunner', name: 'App Runner', category: 'compute', description: 'Déploiement conteneurs simplifié' },
  { id: 'outposts', name: 'Outposts', category: 'compute', description: 'AWS on-premises' },
  { id: 'wavelength', name: 'Wavelength', category: 'compute', description: 'Edge computing 5G' },
  { id: 'localzones', name: 'Local Zones', category: 'compute', description: 'Latence ultra-faible' },
  { id: 'parallelcluster', name: 'ParallelCluster', category: 'compute', description: 'HPC clusters' },
  { id: 'serverlessrepo', name: 'Serverless Application Repository', category: 'compute', description: 'Applications serverless' },
  { id: 'computeoptimizer', name: 'Compute Optimizer', category: 'compute', description: 'Recommandations compute' },

  // ============ STORAGE (12) ============
  { id: 's3', name: 'S3', category: 'storage', description: 'Stockage objets' },
  { id: 'ebs', name: 'EBS', category: 'storage', description: 'Volumes bloc' },
  { id: 'efs', name: 'EFS', category: 'storage', description: 'Système de fichiers NFS' },
  { id: 'fsx', name: 'FSx', category: 'storage', description: 'Systèmes de fichiers managés' },
  { id: 'backup', name: 'Backup', category: 'storage', description: 'Sauvegardes centralisées' },
  { id: 's3glacier', name: 'S3 Glacier', category: 'storage', description: 'Archivage long terme' },
  { id: 'storagegateway', name: 'Storage Gateway', category: 'storage', description: 'Stockage hybride' },
  { id: 'snowball', name: 'Snowball', category: 'storage', description: 'Transfert de données physique' },
  { id: 'snowcone', name: 'Snowcone', category: 'storage', description: 'Edge computing portable' },
  { id: 'snowmobile', name: 'Snowmobile', category: 'storage', description: 'Transfert exabyte' },
  { id: 'datasync', name: 'DataSync', category: 'storage', description: 'Transfert de données automatisé' },
  { id: 'elasticdisasterrecovery', name: 'Elastic Disaster Recovery', category: 'storage', description: 'Reprise après sinistre' },

  // ============ DATABASE (15) ============
  { id: 'rds', name: 'RDS', category: 'database', description: 'Bases relationnelles managées' },
  { id: 'aurora', name: 'Aurora', category: 'database', description: 'MySQL/PostgreSQL haute performance' },
  { id: 'dynamodb', name: 'DynamoDB', category: 'database', description: 'NoSQL serverless' },
  { id: 'elasticache', name: 'ElastiCache', category: 'database', description: 'Cache Redis/Memcached' },
  { id: 'redshift', name: 'Redshift', category: 'database', description: 'Data warehouse' },
  { id: 'documentdb', name: 'DocumentDB', category: 'database', description: 'MongoDB compatible' },
  { id: 'neptune', name: 'Neptune', category: 'database', description: 'Base graphe' },
  { id: 'keyspaces', name: 'Keyspaces', category: 'database', description: 'Cassandra compatible' },
  { id: 'timestream', name: 'Timestream', category: 'database', description: 'Time series' },
  { id: 'memorydb', name: 'MemoryDB', category: 'database', description: 'Redis durable' },
  { id: 'qldb', name: 'QLDB', category: 'database', description: 'Ledger database' },
  { id: 'dms', name: 'Database Migration Service', category: 'database', description: 'Migration de bases' },
  { id: 'dax', name: 'DAX', category: 'database', description: 'Cache DynamoDB' },
  { id: 'rdsproxyservice', name: 'RDS Proxy', category: 'database', description: 'Proxy pour RDS' },
  { id: 'rdsdataapi', name: 'RDS Data API', category: 'database', description: 'API HTTP pour RDS' },

  // ============ NETWORK (18) ============
  { id: 'vpc', name: 'VPC', category: 'network', description: 'Réseau virtuel privé' },
  { id: 'cloudfront', name: 'CloudFront', category: 'network', description: 'CDN global' },
  { id: 'route53', name: 'Route 53', category: 'network', description: 'DNS et routage' },
  { id: 'apigateway', name: 'API Gateway', category: 'network', description: 'Gestion APIs REST/WebSocket' },
  { id: 'elb', name: 'Elastic Load Balancing', category: 'network', description: 'Load Balancers ALB/NLB/CLB' },
  { id: 'natgateway', name: 'NAT Gateway', category: 'network', description: 'NAT managé' },
  { id: 'directconnect', name: 'Direct Connect', category: 'network', description: 'Connexion dédiée' },
  { id: 'transitgateway', name: 'Transit Gateway', category: 'network', description: 'Hub réseau' },
  { id: 'globalaccelerator', name: 'Global Accelerator', category: 'network', description: 'Accélération globale' },
  { id: 'privatelink', name: 'PrivateLink', category: 'network', description: 'Endpoints privés' },
  { id: 'appmesh', name: 'App Mesh', category: 'network', description: 'Service mesh' },
  { id: 'cloudmap', name: 'Cloud Map', category: 'network', description: 'Service discovery' },
  { id: 'vpn', name: 'VPN', category: 'network', description: 'VPN site-to-site et client' },
  { id: 'networkfirewall', name: 'Network Firewall', category: 'network', description: 'Pare-feu réseau' },
  { id: 'route53resolver', name: 'Route 53 Resolver', category: 'network', description: 'DNS hybride' },
  { id: 'vpcflowlogs', name: 'VPC Flow Logs', category: 'network', description: 'Logs réseau' },
  { id: 'elasticip', name: 'Elastic IP', category: 'network', description: 'IPs statiques' },
  { id: 'vpcpeering', name: 'VPC Peering', category: 'network', description: 'Interconnexion VPC' },

  // ============ SECURITY (22) ============
  { id: 'iam', name: 'IAM', category: 'security', description: 'Identités et accès' },
  { id: 'kms', name: 'KMS', category: 'security', description: 'Clés de chiffrement' },
  { id: 'secretsmanager', name: 'Secrets Manager', category: 'security', description: 'Gestion secrets' },
  { id: 'acm', name: 'ACM', category: 'security', description: 'Certificats SSL/TLS' },
  { id: 'waf', name: 'WAF', category: 'security', description: 'Pare-feu web' },
  { id: 'guardduty', name: 'GuardDuty', category: 'security', description: 'Détection menaces' },
  { id: 'cognito', name: 'Cognito', category: 'security', description: 'Authentification utilisateurs' },
  { id: 'directoryservice', name: 'Directory Service', category: 'security', description: 'Active Directory managé' },
  { id: 'ram', name: 'RAM', category: 'security', description: 'Partage de ressources' },
  { id: 'securityhub', name: 'Security Hub', category: 'security', description: 'Centre de sécurité' },
  { id: 'inspector', name: 'Inspector', category: 'security', description: 'Analyse vulnérabilités' },
  { id: 'macie', name: 'Macie', category: 'security', description: 'Protection données sensibles' },
  { id: 'detective', name: 'Detective', category: 'security', description: 'Investigation sécurité' },
  { id: 'auditmanager', name: 'Audit Manager', category: 'security', description: 'Audits de conformité' },
  { id: 'artifact', name: 'Artifact', category: 'security', description: 'Rapports de conformité' },
  { id: 'firewallmanager', name: 'Firewall Manager', category: 'security', description: 'Gestion centralisée pare-feux' },
  { id: 'shield', name: 'Shield', category: 'security', description: 'Protection DDoS' },
  { id: 'sso', name: 'IAM Identity Center', category: 'security', description: 'SSO centralisé' },
  { id: 'sts', name: 'STS', category: 'security', description: 'Tokens temporaires' },
  { id: 'cloudhsm', name: 'CloudHSM', category: 'security', description: 'HSM dédié' },
  { id: 'privateca', name: 'Private CA', category: 'security', description: 'Autorité de certification' },
  { id: 'signer', name: 'Signer', category: 'security', description: 'Signature de code' },

  // ============ ANALYTICS (18) ============
  { id: 'athena', name: 'Athena', category: 'analytics', description: 'Requêtes SQL sur S3' },
  { id: 'emr', name: 'EMR', category: 'analytics', description: 'Big Data Hadoop/Spark' },
  { id: 'kinesis', name: 'Kinesis', category: 'analytics', description: 'Streaming temps réel' },
  { id: 'kinesisfirehose', name: 'Kinesis Firehose', category: 'analytics', description: 'Livraison streaming' },
  { id: 'kinesisanalytics', name: 'Kinesis Analytics', category: 'analytics', description: 'Analyse streaming' },
  { id: 'opensearch', name: 'OpenSearch', category: 'analytics', description: 'Recherche et analytics' },
  { id: 'glue', name: 'Glue', category: 'analytics', description: 'ETL serverless' },
  { id: 'quicksight', name: 'QuickSight', category: 'analytics', description: 'BI et visualisation' },
  { id: 'datapipeline', name: 'Data Pipeline', category: 'analytics', description: 'Orchestration données' },
  { id: 'lakeformation', name: 'Lake Formation', category: 'analytics', description: 'Data lake' },
  { id: 'msk', name: 'MSK', category: 'analytics', description: 'Kafka managé' },
  { id: 'dataexchange', name: 'Data Exchange', category: 'analytics', description: 'Marketplace données' },
  { id: 'cloudsearch', name: 'CloudSearch', category: 'analytics', description: 'Recherche managée' },
  { id: 'gluedatabrew', name: 'Glue DataBrew', category: 'analytics', description: 'Préparation données visuelle' },
  { id: 'cleanrooms', name: 'Clean Rooms', category: 'analytics', description: 'Analyse collaborative' },
  { id: 'entityresolution', name: 'Entity Resolution', category: 'analytics', description: 'Résolution entités' },
  { id: 'finspace', name: 'FinSpace', category: 'analytics', description: 'Analytics financier' },
  { id: 'redshiftspectrum', name: 'Redshift Spectrum', category: 'analytics', description: 'Requêtes S3 depuis Redshift' },

  // ============ INTEGRATION (12) ============
  { id: 'sqs', name: 'SQS', category: 'integration', description: 'Files de messages' },
  { id: 'sns', name: 'SNS', category: 'integration', description: 'Notifications pub/sub' },
  { id: 'eventbridge', name: 'EventBridge', category: 'integration', description: 'Bus événements serverless' },
  { id: 'stepfunctions', name: 'Step Functions', category: 'integration', description: 'Orchestration workflows' },
  { id: 'appsync', name: 'AppSync', category: 'integration', description: 'GraphQL managé' },
  { id: 'mq', name: 'Amazon MQ', category: 'integration', description: 'ActiveMQ/RabbitMQ managé' },
  { id: 'appflow', name: 'AppFlow', category: 'integration', description: 'Intégration SaaS' },
  { id: 'mwaa', name: 'MWAA', category: 'integration', description: 'Apache Airflow managé' },
  { id: 'eventbridgescheduler', name: 'EventBridge Scheduler', category: 'integration', description: 'Planification tâches' },
  { id: 'eventbridgepipes', name: 'EventBridge Pipes', category: 'integration', description: 'Intégration point-to-point' },
  { id: 'swf', name: 'SWF', category: 'integration', description: 'Simple Workflow' },
  { id: 'b2bi', name: 'B2B Data Interchange', category: 'integration', description: 'Échange données B2B' },

  // ============ MANAGEMENT (22) ============
  { id: 'cloudwatch', name: 'CloudWatch', category: 'management', description: 'Monitoring et observabilité' },
  { id: 'cloudwatchlogs', name: 'CloudWatch Logs', category: 'management', description: 'Agrégation logs' },
  { id: 'cloudtrail', name: 'CloudTrail', category: 'management', description: 'Audit API' },
  { id: 'config', name: 'Config', category: 'management', description: 'Conformité ressources' },
  { id: 'ssm', name: 'Systems Manager', category: 'management', description: 'Gestion opérations' },
  { id: 'organizations', name: 'Organizations', category: 'management', description: 'Multi-comptes' },
  { id: 'trustedadvisor', name: 'Trusted Advisor', category: 'management', description: 'Recommandations best practices' },
  { id: 'health', name: 'Health', category: 'management', description: 'Santé services AWS' },
  { id: 'servicecatalog', name: 'Service Catalog', category: 'management', description: 'Catalogue produits IT' },
  { id: 'licensemanager', name: 'License Manager', category: 'management', description: 'Gestion licences' },
  { id: 'controltower', name: 'Control Tower', category: 'management', description: 'Gouvernance multi-comptes' },
  { id: 'proton', name: 'Proton', category: 'management', description: 'Déploiement infrastructure' },
  { id: 'launchpad', name: 'Launch Wizard', category: 'management', description: 'Déploiement guidé' },
  { id: 'opsworks', name: 'OpsWorks', category: 'management', description: 'Chef/Puppet managé' },
  { id: 'resourcegroups', name: 'Resource Groups', category: 'management', description: 'Groupes de ressources' },
  { id: 'tageditor', name: 'Tag Editor', category: 'management', description: 'Gestion des tags' },
  { id: 'wellarchitected', name: 'Well-Architected Tool', category: 'management', description: 'Review architecture' },
  { id: 'resiliencehub', name: 'Resilience Hub', category: 'management', description: 'Analyse résilience' },
  { id: 'chatbot', name: 'Chatbot', category: 'management', description: 'Notifications Slack/Teams' },
  { id: 'appconfig', name: 'AppConfig', category: 'management', description: 'Configuration applicative' },
  { id: 'cloudformation', name: 'CloudFormation', category: 'management', description: 'Infrastructure as Code' },
  { id: 'cdk', name: 'CDK', category: 'management', description: 'Cloud Development Kit' },

  // ============ CONTAINERS (8) ============
  { id: 'ecr', name: 'ECR', category: 'containers', description: 'Registre Docker' },
  { id: 'ecrpublic', name: 'ECR Public', category: 'containers', description: 'Registre Docker public' },
  { id: 'copilot', name: 'Copilot', category: 'containers', description: 'CLI pour ECS/Fargate' },
  { id: 'rosa', name: 'ROSA', category: 'containers', description: 'Red Hat OpenShift' },
  { id: 'eksanywhere', name: 'EKS Anywhere', category: 'containers', description: 'Kubernetes on-premises' },
  { id: 'eksdistro', name: 'EKS Distro', category: 'containers', description: 'Distribution Kubernetes' },
  { id: 'apprunnercontainers', name: 'App Runner', category: 'containers', description: 'Containers web simplifiés' },
  { id: 'bottlerocket', name: 'Bottlerocket', category: 'containers', description: 'OS pour containers' },

  // ============ AI/ML (28) ============
  { id: 'sagemaker', name: 'SageMaker', category: 'ai-ml', description: 'Plateforme ML complète' },
  { id: 'bedrock', name: 'Bedrock', category: 'ai-ml', description: 'IA générative (Claude, Titan, etc.)' },
  { id: 'comprehend', name: 'Comprehend', category: 'ai-ml', description: 'NLP et analyse texte' },
  { id: 'forecast', name: 'Forecast', category: 'ai-ml', description: 'Prévisions ML' },
  { id: 'frauddetector', name: 'Fraud Detector', category: 'ai-ml', description: 'Détection fraude' },
  { id: 'kendra', name: 'Kendra', category: 'ai-ml', description: 'Recherche intelligente' },
  { id: 'lex', name: 'Lex', category: 'ai-ml', description: 'Chatbots conversationnels' },
  { id: 'personalize', name: 'Personalize', category: 'ai-ml', description: 'Recommandations' },
  { id: 'polly', name: 'Polly', category: 'ai-ml', description: 'Text-to-Speech' },
  { id: 'rekognition', name: 'Rekognition', category: 'ai-ml', description: 'Analyse images/vidéos' },
  { id: 'textract', name: 'Textract', category: 'ai-ml', description: 'Extraction documents' },
  { id: 'transcribe', name: 'Transcribe', category: 'ai-ml', description: 'Speech-to-Text' },
  { id: 'translate', name: 'Translate', category: 'ai-ml', description: 'Traduction automatique' },
  { id: 'deepracer', name: 'DeepRacer', category: 'ai-ml', description: 'Apprentissage par renforcement' },
  { id: 'panorama', name: 'Panorama', category: 'ai-ml', description: 'Vision edge' },
  { id: 'lookoutforvision', name: 'Lookout for Vision', category: 'ai-ml', description: 'Détection anomalies visuelles' },
  { id: 'lookoutformetrics', name: 'Lookout for Metrics', category: 'ai-ml', description: 'Détection anomalies métriques' },
  { id: 'lookoutforequipment', name: 'Lookout for Equipment', category: 'ai-ml', description: 'Maintenance prédictive' },
  { id: 'healthlake', name: 'HealthLake', category: 'ai-ml', description: 'Données santé FHIR' },
  { id: 'devopsguru', name: 'DevOps Guru', category: 'ai-ml', description: 'AIOps' },
  { id: 'codewhisperer', name: 'CodeWhisperer', category: 'ai-ml', description: 'Assistant codage IA' },
  { id: 'monitron', name: 'Monitron', category: 'ai-ml', description: 'Monitoring équipements' },
  { id: 'augmentedai', name: 'Augmented AI', category: 'ai-ml', description: 'Human-in-the-loop ML' },
  { id: 'comprehendmedical', name: 'Comprehend Medical', category: 'ai-ml', description: 'NLP médical' },
  { id: 'sagemakercanvas', name: 'SageMaker Canvas', category: 'ai-ml', description: 'ML no-code' },
  { id: 'sagemakerstudio', name: 'SageMaker Studio', category: 'ai-ml', description: 'IDE ML' },
  { id: 'sagemakerautopilot', name: 'SageMaker Autopilot', category: 'ai-ml', description: 'AutoML' },
  { id: 'sagemakerjumpstart', name: 'SageMaker JumpStart', category: 'ai-ml', description: 'Modèles pré-entraînés' },

  // ============ DEVELOPER TOOLS (15) ============
  { id: 'codecommit', name: 'CodeCommit', category: 'developer-tools', description: 'Git managé' },
  { id: 'codebuild', name: 'CodeBuild', category: 'developer-tools', description: 'Build CI' },
  { id: 'codedeploy', name: 'CodeDeploy', category: 'developer-tools', description: 'Déploiement automatisé' },
  { id: 'codepipeline', name: 'CodePipeline', category: 'developer-tools', description: 'CI/CD pipeline' },
  { id: 'codeartifact', name: 'CodeArtifact', category: 'developer-tools', description: 'Repository artefacts' },
  { id: 'codestar', name: 'CodeStar', category: 'developer-tools', description: 'Gestion projets dev' },
  { id: 'cloud9', name: 'Cloud9', category: 'developer-tools', description: 'IDE cloud' },
  { id: 'xray', name: 'X-Ray', category: 'developer-tools', description: 'Tracing distribué' },
  { id: 'codeguru', name: 'CodeGuru', category: 'developer-tools', description: 'Review code automatisé' },
  { id: 'fis', name: 'Fault Injection Simulator', category: 'developer-tools', description: 'Chaos engineering' },
  { id: 'cloudshell', name: 'CloudShell', category: 'developer-tools', description: 'Shell navigateur' },
  { id: 'applicationcomposer', name: 'Application Composer', category: 'developer-tools', description: 'Design visuel serverless' },
  { id: 'codecatalyst', name: 'CodeCatalyst', category: 'developer-tools', description: 'Espace dev unifié' },
  { id: 'corretto', name: 'Corretto', category: 'developer-tools', description: 'Distribution OpenJDK' },
  { id: 'sam', name: 'SAM', category: 'developer-tools', description: 'Serverless Application Model' },

  // ============ IOT (12) ============
  { id: 'iotcore', name: 'IoT Core', category: 'iot', description: 'Plateforme IoT' },
  { id: 'iotanalytics', name: 'IoT Analytics', category: 'iot', description: 'Analyse données IoT' },
  { id: 'iotevents', name: 'IoT Events', category: 'iot', description: 'Détection événements IoT' },
  { id: 'iotgreengrass', name: 'IoT Greengrass', category: 'iot', description: 'Edge computing IoT' },
  { id: 'iotsitewise', name: 'IoT SiteWise', category: 'iot', description: 'Données industrielles' },
  { id: 'iottwinmaker', name: 'IoT TwinMaker', category: 'iot', description: 'Digital twins' },
  { id: 'freertos', name: 'FreeRTOS', category: 'iot', description: 'OS microcontrôleurs' },
  { id: 'iotdevicedefender', name: 'IoT Device Defender', category: 'iot', description: 'Sécurité IoT' },
  { id: 'iotdevicemanagement', name: 'IoT Device Management', category: 'iot', description: 'Gestion appareils' },
  { id: 'iot1click', name: 'IoT 1-Click', category: 'iot', description: 'Boutons IoT' },
  { id: 'iotfleetwise', name: 'IoT FleetWise', category: 'iot', description: 'Données véhicules' },
  { id: 'iotroborunner', name: 'IoT RoboRunner', category: 'iot', description: 'Orchestration robots' },

  // ============ MEDIA (12) ============
  { id: 'mediaconvert', name: 'MediaConvert', category: 'media', description: 'Transcodage vidéo' },
  { id: 'medialive', name: 'MediaLive', category: 'media', description: 'Live streaming' },
  { id: 'mediapackage', name: 'MediaPackage', category: 'media', description: 'Packaging vidéo' },
  { id: 'mediastore', name: 'MediaStore', category: 'media', description: 'Stockage média' },
  { id: 'mediaconnect', name: 'MediaConnect', category: 'media', description: 'Transport vidéo' },
  { id: 'mediatailor', name: 'MediaTailor', category: 'media', description: 'Personnalisation vidéo' },
  { id: 'elastictranscoder', name: 'Elastic Transcoder', category: 'media', description: 'Transcodage cloud' },
  { id: 'ivs', name: 'Interactive Video Service', category: 'media', description: 'Streaming interactif' },
  { id: 'nimblestudio', name: 'Nimble Studio', category: 'media', description: 'Production créative' },
  { id: 'elementalmedialive', name: 'Elemental Live', category: 'media', description: 'Encodage live on-prem' },
  { id: 'deadlincloud', name: 'Deadline Cloud', category: 'media', description: 'Render farm managé' },
  { id: 'thinkboxdeadline', name: 'Thinkbox Deadline', category: 'media', description: 'Gestion rendu' },

  // ============ GAME (5) ============
  { id: 'gamelift', name: 'GameLift', category: 'game', description: 'Serveurs de jeux' },
  { id: 'gamesparks', name: 'GameSparks', category: 'game', description: 'Backend de jeux' },
  { id: 'lumberyard', name: 'Open 3D Engine', category: 'game', description: 'Moteur de jeu' },
  { id: 'gameanalytics', name: 'Game Analytics', category: 'game', description: 'Analytics gaming' },
  { id: 'gamesessions', name: 'Game Sessions', category: 'game', description: 'Gestion sessions' },

  // ============ BUSINESS APPS (14) ============
  { id: 'workspaces', name: 'WorkSpaces', category: 'business', description: 'Bureaux virtuels VDI' },
  { id: 'workdocs', name: 'WorkDocs', category: 'business', description: 'Stockage documents' },
  { id: 'workmail', name: 'WorkMail', category: 'business', description: 'Email et calendrier' },
  { id: 'appstream', name: 'AppStream 2.0', category: 'business', description: 'Streaming applications' },
  { id: 'chime', name: 'Chime', category: 'business', description: 'Vidéoconférence' },
  { id: 'chimesdk', name: 'Chime SDK', category: 'business', description: 'SDK communications' },
  { id: 'connect', name: 'Connect', category: 'business', description: 'Centre de contact cloud' },
  { id: 'pinpoint', name: 'Pinpoint', category: 'business', description: 'Marketing multicanal' },
  { id: 'ses', name: 'SES', category: 'business', description: 'Email transactionnel' },
  { id: 'honeycode', name: 'Honeycode', category: 'business', description: 'Apps no-code' },
  { id: 'worklink', name: 'WorkLink', category: 'business', description: 'Accès intranet mobile' },
  { id: 'wickr', name: 'Wickr', category: 'business', description: 'Messagerie sécurisée' },
  { id: 'workspacesweb', name: 'WorkSpaces Web', category: 'business', description: 'Navigateur sécurisé' },
  { id: 'supplychain', name: 'Supply Chain', category: 'business', description: 'Gestion supply chain' },

  // ============ MIGRATION (10) ============
  { id: 'migrationhub', name: 'Migration Hub', category: 'migration', description: 'Suivi migrations' },
  { id: 'applicationmigration', name: 'Application Migration Service', category: 'migration', description: 'Migration serveurs' },
  { id: 'transferfamily', name: 'Transfer Family', category: 'migration', description: 'SFTP/FTPS/FTP managé' },
  { id: 'mainframemodernization', name: 'Mainframe Modernization', category: 'migration', description: 'Migration mainframe' },
  { id: 'applicationdiscovery', name: 'Application Discovery', category: 'migration', description: 'Découverte applications' },
  { id: 'migrationevaluator', name: 'Migration Evaluator', category: 'migration', description: 'Évaluation migration' },
  { id: 'schemaconversion', name: 'Schema Conversion Tool', category: 'migration', description: 'Conversion schémas DB' },
  { id: 'datasyncmigration', name: 'DataSync', category: 'migration', description: 'Transfert données' },
  { id: 'snowballedge', name: 'Snowball Edge', category: 'migration', description: 'Migration hors ligne' },
  { id: 'outpostsmigration', name: 'Outposts', category: 'migration', description: 'Migration hybride' },

  // ============ BLOCKCHAIN (3) ============
  { id: 'managedblockchain', name: 'Managed Blockchain', category: 'blockchain', description: 'Hyperledger/Ethereum' },
  { id: 'qldbblockchain', name: 'QLDB', category: 'blockchain', description: 'Ledger vérifiable' },
  { id: 'amb', name: 'AMB Query', category: 'blockchain', description: 'Requêtes blockchain' },

  // ============ FRONTEND/WEB (6) ============
  { id: 'amplify', name: 'Amplify', category: 'frontend-web', description: 'Fullstack web/mobile' },
  { id: 'amplifyhosting', name: 'Amplify Hosting', category: 'frontend-web', description: 'Hébergement web' },
  { id: 'amplifystudio', name: 'Amplify Studio', category: 'frontend-web', description: 'Visual app builder' },
  { id: 'locationservice', name: 'Location Service', category: 'frontend-web', description: 'Cartes et géolocalisation' },
  { id: 'devicefarm', name: 'Device Farm', category: 'frontend-web', description: 'Tests mobiles' },
  { id: 'appsyncgraphql', name: 'AppSync', category: 'frontend-web', description: 'Backend GraphQL' },

  // ============ END USER COMPUTING (5) ============
  { id: 'workspacesthinclients', name: 'WorkSpaces Thin Clients', category: 'end-user-computing', description: 'Clients légers' },
  { id: 'appstreamcomputing', name: 'AppStream', category: 'end-user-computing', description: 'Applications streamées' },
  { id: 'workspacescore', name: 'WorkSpaces Core', category: 'end-user-computing', description: 'VDI personnalisable' },
  { id: 'workspacesfamily', name: 'WorkSpaces Family', category: 'end-user-computing', description: 'Suite bureaux virtuels' },
  { id: 'endusermessaging', name: 'End User Messaging', category: 'end-user-computing', description: 'Messaging utilisateurs' },

  // ============ CUSTOMER ENGAGEMENT (6) ============
  { id: 'connectcontact', name: 'Connect', category: 'customer-engagement', description: 'Centre de contact' },
  { id: 'pinpointengagement', name: 'Pinpoint', category: 'customer-engagement', description: 'Engagement marketing' },
  { id: 'sesv2', name: 'SES v2', category: 'customer-engagement', description: 'Email avancé' },
  { id: 'connectwisdom', name: 'Connect Wisdom', category: 'customer-engagement', description: 'Base connaissances agents' },
  { id: 'connectcases', name: 'Connect Cases', category: 'customer-engagement', description: 'Gestion tickets' },
  { id: 'connectvoiceid', name: 'Connect Voice ID', category: 'customer-engagement', description: 'Authentification vocale' },

  // ============ COST (6) ============
  { id: 'costexplorer', name: 'Cost Explorer', category: 'cost', description: 'Analyse coûts détaillée' },
  { id: 'budgets', name: 'Budgets', category: 'cost', description: 'Alertes budget' },
  { id: 'savingsplans', name: 'Savings Plans', category: 'cost', description: 'Plans économies' },
  { id: 'reservedinstances', name: 'Reserved Instances', category: 'cost', description: 'Instances réservées' },
  { id: 'costandusagereports', name: 'Cost & Usage Reports', category: 'cost', description: 'Rapports détaillés' },
  { id: 'billingconductor', name: 'Billing Conductor', category: 'cost', description: 'Facturation personnalisée' }
];

// Réponse API
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Événement Lambda API Gateway
export interface LambdaEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
}

// Réponse Lambda
export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
