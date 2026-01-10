/**
 * Service d'audit Cost Explorer et Budgets
 */

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  GetReservationCoverageCommand,
  GetSavingsPlansCoverageCommand,
  GetRightsizingRecommendationCommand
} from '@aws-sdk/client-cost-explorer';
import { BudgetsClient, DescribeBudgetsCommand } from '@aws-sdk/client-budgets';
import { BaseAuditor } from './base';

export class CostAuditor extends BaseAuditor {
  get serviceName() { return 'Cost Explorer'; }
  get category() { return 'cost'; }

  async audit(): Promise<any> {
    // Cost Explorer est uniquement disponible en us-east-1
    const ceClient = new CostExplorerClient(this.getClientConfig('us-east-1'));
    const budgetsClient = new BudgetsClient(this.getClientConfig('us-east-1'));

    const [
      monthlyCosts,
      costsByService,
      costsByRegion,
      dailyCosts,
      forecast,
      riCoverage,
      spCoverage,
      rightsizing,
      budgets
    ] = await Promise.all([
      this.getMonthlyCosts(ceClient),
      this.getCostsByService(ceClient),
      this.getCostsByRegion(ceClient),
      this.getDailyCosts(ceClient),
      this.getForecast(ceClient),
      this.getReservationCoverage(ceClient),
      this.getSavingsPlansCoverage(ceClient),
      this.getRightsizingRecommendations(ceClient),
      this.getBudgets(budgetsClient)
    ]);

    // Calculer le total et analyser les tendances
    const totalMonthlyCost = monthlyCosts.reduce((sum, m) => sum + m.cost, 0);
    const currentMonthCost = monthlyCosts[monthlyCosts.length - 1]?.cost || 0;

    // Détecter les anomalies
    this.analyzeIssues(costsByService, riCoverage, spCoverage, rightsizing);

    return this.buildResult({
      summary: {
        totalLast12Months: totalMonthlyCost,
        currentMonthCost,
        forecastedCost: forecast?.forecastedCost || 0,
        currency: 'USD'
      },
      monthlyCosts,
      costsByService,
      costsByRegion,
      dailyCosts,
      forecast,
      reservedInstancesCoverage: riCoverage,
      savingsPlansCoverage: spCoverage,
      rightsizingRecommendations: rightsizing,
      budgets
    });
  }

  private getDateRange(days: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  private async getMonthlyCosts(client: CostExplorerClient): Promise<any[]> {
    const end = new Date();
    end.setDate(1);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);

    const response = await this.safeApiCall(
      () => client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start.toISOString().split('T')[0], End: end.toISOString().split('T')[0] },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost']
      })),
      'getMonthlyCosts'
    );

    if (!response?.ResultsByTime) return [];

    return response.ResultsByTime.map(r => ({
      periodStart: r.TimePeriod?.Start,
      periodEnd: r.TimePeriod?.End,
      cost: parseFloat(r.Total?.UnblendedCost?.Amount || '0'),
      currency: r.Total?.UnblendedCost?.Unit || 'USD'
    }));
  }

  private async getCostsByService(client: CostExplorerClient): Promise<any[]> {
    const { start, end } = this.getDateRange(30);

    const response = await this.safeApiCall(
      () => client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }]
      })),
      'getCostsByService'
    );

    if (!response?.ResultsByTime) return [];

    const services: any[] = [];
    for (const result of response.ResultsByTime) {
      for (const group of result.Groups || []) {
        const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
        if (cost > 0) {
          services.push({
            service: group.Keys?.[0],
            cost,
            currency: group.Metrics?.UnblendedCost?.Unit || 'USD'
          });
        }
      }
    }

    return services.sort((a, b) => b.cost - a.cost);
  }

  private async getCostsByRegion(client: CostExplorerClient): Promise<any[]> {
    const { start, end } = this.getDateRange(30);

    const response = await this.safeApiCall(
      () => client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'REGION' }]
      })),
      'getCostsByRegion'
    );

    if (!response?.ResultsByTime) return [];

    const regions: any[] = [];
    for (const result of response.ResultsByTime) {
      for (const group of result.Groups || []) {
        const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
        if (cost > 0) {
          regions.push({
            region: group.Keys?.[0],
            cost,
            currency: group.Metrics?.UnblendedCost?.Unit || 'USD'
          });
        }
      }
    }

    return regions.sort((a, b) => b.cost - a.cost);
  }

  private async getDailyCosts(client: CostExplorerClient): Promise<any[]> {
    const { start, end } = this.getDateRange(14);

    const response = await this.safeApiCall(
      () => client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost']
      })),
      'getDailyCosts'
    );

    if (!response?.ResultsByTime) return [];

    return response.ResultsByTime.map(r => ({
      date: r.TimePeriod?.Start,
      cost: parseFloat(r.Total?.UnblendedCost?.Amount || '0'),
      currency: r.Total?.UnblendedCost?.Unit || 'USD'
    }));
  }

  private async getForecast(client: CostExplorerClient): Promise<any> {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);

    const response = await this.safeApiCall(
      () => client.send(new GetCostForecastCommand({
        TimePeriod: {
          Start: start.toISOString().split('T')[0],
          End: end.toISOString().split('T')[0]
        },
        Metric: 'UNBLENDED_COST',
        Granularity: 'MONTHLY'
      })),
      'getForecast'
    );

    if (!response) return null;

    return {
      forecastedCost: parseFloat(response.Total?.Amount || '0'),
      currency: response.Total?.Unit || 'USD'
    };
  }

  private async getReservationCoverage(client: CostExplorerClient): Promise<any> {
    const { start, end } = this.getDateRange(30);

    const response = await this.safeApiCall(
      () => client.send(new GetReservationCoverageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY'
      })),
      'getReservationCoverage'
    );

    if (!response?.Total) return null;

    const coverage = response.Total.CoverageHours;
    return {
      coveragePercentage: parseFloat(coverage?.CoverageHoursPercentage || '0'),
      onDemandHours: parseFloat(coverage?.OnDemandHours || '0'),
      reservedHours: parseFloat(coverage?.ReservedHours || '0'),
      totalRunningHours: parseFloat(coverage?.TotalRunningHours || '0')
    };
  }

  private async getSavingsPlansCoverage(client: CostExplorerClient): Promise<any> {
    const { start, end } = this.getDateRange(30);

    const response = await this.safeApiCall(
      () => client.send(new GetSavingsPlansCoverageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY'
      })),
      'getSavingsPlansCoverage'
    );

    if (!response?.SavingsPlansCoverages?.[0]) return null;

    const coverage = response.SavingsPlansCoverages[0].Coverage;
    return {
      coveragePercentage: parseFloat(coverage?.CoveragePercentage || '0'),
      spendCovered: parseFloat(coverage?.SpendCoveredBySavingsPlans || '0'),
      onDemandCost: parseFloat(coverage?.OnDemandCost || '0')
    };
  }

  private async getRightsizingRecommendations(client: CostExplorerClient): Promise<any[]> {
    const response = await this.safeApiCall(
      () => client.send(new GetRightsizingRecommendationCommand({
        Service: 'AmazonEC2',
        Configuration: {
          RecommendationTarget: 'SAME_INSTANCE_FAMILY',
          BenefitsConsidered: true
        }
      })),
      'getRightsizingRecommendations'
    );

    if (!response?.RightsizingRecommendations) return [];

    return response.RightsizingRecommendations.slice(0, 20).map(rec => ({
      instanceId: rec.CurrentInstance?.ResourceId,
      instanceType: rec.CurrentInstance?.ResourceDetails?.EC2ResourceDetails?.InstanceType,
      recommendationType: rec.RightsizingType,
      estimatedMonthlySavings: parseFloat(
        rec.ModifyRecommendationDetail?.TargetInstances?.[0]?.EstimatedMonthlySavings || '0'
      )
    }));
  }

  private async getBudgets(client: BudgetsClient): Promise<any[]> {
    const response = await this.safeApiCall(
      () => client.send(new DescribeBudgetsCommand({
        AccountId: undefined // Will use the account from credentials
      })),
      'getBudgets'
    );

    if (!response?.Budgets) return [];

    return response.Budgets.map(b => ({
      name: b.BudgetName,
      type: b.BudgetType,
      limit: parseFloat(b.BudgetLimit?.Amount || '0'),
      actualSpend: parseFloat(b.CalculatedSpend?.ActualSpend?.Amount || '0'),
      forecastedSpend: parseFloat(b.CalculatedSpend?.ForecastedSpend?.Amount || '0'),
      currency: b.BudgetLimit?.Unit || 'USD'
    }));
  }

  private analyzeIssues(
    costsByService: any[],
    riCoverage: any,
    spCoverage: any,
    rightsizing: any[]
  ): void {
    // Vérifier la couverture RI
    if (riCoverage && riCoverage.coveragePercentage < 50) {
      this.addIssue({
        type: 'LOW_RI_COVERAGE',
        severity: 'MEDIUM',
        message: `Couverture Reserved Instances faible (${riCoverage.coveragePercentage.toFixed(1)}%)`,
        resources: [],
        recommendation: 'Envisager l\'achat de Reserved Instances pour réduire les coûts'
      });
    }

    // Vérifier les recommandations de rightsizing
    const totalSavings = rightsizing.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0);
    if (totalSavings > 100) {
      this.addIssue({
        type: 'RIGHTSIZING_AVAILABLE',
        severity: 'HIGH',
        message: `Économies potentielles de $${totalSavings.toFixed(2)}/mois via rightsizing`,
        resources: rightsizing.map(r => r.instanceId).filter(Boolean),
        potentialSavings: totalSavings,
        recommendation: 'Redimensionner les instances surdimensionnées'
      });
    }

    // Top services coûteux
    const topServices = costsByService.slice(0, 3);
    if (topServices.length > 0 && topServices[0].cost > 1000) {
      this.addIssue({
        type: 'HIGH_COST_SERVICES',
        severity: 'INFO',
        message: `Services les plus coûteux: ${topServices.map(s => s.service).join(', ')}`,
        resources: topServices.map(s => s.service)
      });
    }
  }
}
