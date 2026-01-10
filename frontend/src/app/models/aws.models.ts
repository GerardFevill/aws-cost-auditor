/**
 * Modèles pour l'application AWS Cost Auditor
 */

// Credentials AWS
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}

// Service AWS
export interface AWSService {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  icon?: string;
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

// Résultat d'audit
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

// Réponse API
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// État de l'authentification
export interface AuthState {
  isAuthenticated: boolean;
  accountId?: string;
  credentials?: AWSCredentials;
}

// Configuration d'audit
export interface AuditConfig {
  services: string[];
  regions?: string[];
}

// Résumé des coûts
export interface CostSummary {
  totalLast12Months: number;
  currentMonthCost: number;
  forecastedCost: number;
  currency: string;
}

// Données de coût mensuel
export interface MonthlyCost {
  periodStart: string;
  periodEnd: string;
  cost: number;
  currency: string;
}

// Coût par service
export interface ServiceCost {
  service: string;
  cost: number;
  currency: string;
}

// Labels des catégories
export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  'compute': 'Compute',
  'storage': 'Stockage',
  'database': 'Base de données',
  'network': 'Réseau',
  'security': 'Sécurité',
  'analytics': 'Analytics',
  'integration': 'Intégration',
  'management': 'Management',
  'containers': 'Containers',
  'ai-ml': 'AI/ML',
  'cost': 'Coûts',
  'developer-tools': 'Developer Tools',
  'iot': 'IoT',
  'media': 'Media',
  'game': 'Game Tech',
  'business': 'Business Apps',
  'migration': 'Migration',
  'blockchain': 'Blockchain',
  'frontend-web': 'Frontend & Mobile',
  'end-user-computing': 'End User Computing',
  'customer-engagement': 'Customer Engagement'
};

// Icônes des catégories
export const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  'compute': '🖥️',
  'storage': '💾',
  'database': '🗄️',
  'network': '🌐',
  'security': '🔒',
  'analytics': '📊',
  'integration': '🔗',
  'management': '⚙️',
  'containers': '📦',
  'ai-ml': '🤖',
  'cost': '💰',
  'developer-tools': '🛠️',
  'iot': '📡',
  'media': '🎬',
  'game': '🎮',
  'business': '💼',
  'migration': '🚚',
  'blockchain': '⛓️',
  'frontend-web': '🌍',
  'end-user-computing': '🖱️',
  'customer-engagement': '📞'
};

// Régions AWS principales
export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-west-3', label: 'Europe (Paris)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-north-1', label: 'Europe (Stockholm)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
  { value: 'ca-central-1', label: 'Canada (Central)' }
];
