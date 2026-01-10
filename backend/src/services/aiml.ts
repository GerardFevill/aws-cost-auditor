/**
 * Service d'audit AI/ML (SageMaker, Bedrock)
 */

import {
  SageMakerClient,
  ListEndpointsCommand,
  ListNotebookInstancesCommand,
  ListModelsCommand,
  ListTrainingJobsCommand
} from '@aws-sdk/client-sagemaker';
import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListCustomModelsCommand
} from '@aws-sdk/client-bedrock';
import { BaseAuditor } from './base';

export class AIMLAuditor extends BaseAuditor {
  get serviceName() { return 'AI/ML'; }
  get category() { return 'ai-ml'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const [sagemaker, bedrock] = await Promise.all([
      this.auditSageMaker(targetRegions),
      this.auditBedrock(targetRegions)
    ]);

    return this.buildResult({
      sagemaker,
      bedrock
    });
  }

  private async auditSageMaker(regions: string[]): Promise<any> {
    const endpoints: any[] = [];
    const notebookInstances: any[] = [];
    const models: any[] = [];
    const trainingJobs: any[] = [];

    for (const region of regions) {
      const client = new SageMakerClient(this.getClientConfig(region));

      // Endpoints
      const endpointsResponse = await this.safeApiCall(
        () => client.send(new ListEndpointsCommand({})),
        `SageMaker endpoints ${region}`
      );

      if (endpointsResponse?.Endpoints) {
        for (const endpoint of endpointsResponse.Endpoints) {
          endpoints.push({
            endpointName: endpoint.EndpointName,
            endpointArn: endpoint.EndpointArn,
            endpointStatus: endpoint.EndpointStatus,
            creationTime: endpoint.CreationTime?.toISOString(),
            lastModifiedTime: endpoint.LastModifiedTime?.toISOString(),
            region
          });

          // Endpoints actifs sont coûteux
          if (endpoint.EndpointStatus === 'InService') {
            this.addIssue({
              type: 'SAGEMAKER_ENDPOINT_ACTIVE',
              severity: 'INFO',
              message: `Endpoint SageMaker actif: ${endpoint.EndpointName}`,
              resources: [endpoint.EndpointArn!],
              recommendation: 'Vérifier l\'utilisation de l\'endpoint'
            });
          }
        }
      }

      // Notebook Instances
      const notebooksResponse = await this.safeApiCall(
        () => client.send(new ListNotebookInstancesCommand({})),
        `SageMaker notebooks ${region}`
      );

      if (notebooksResponse?.NotebookInstances) {
        for (const notebook of notebooksResponse.NotebookInstances) {
          notebookInstances.push({
            notebookInstanceName: notebook.NotebookInstanceName,
            notebookInstanceArn: notebook.NotebookInstanceArn,
            notebookInstanceStatus: notebook.NotebookInstanceStatus,
            instanceType: notebook.InstanceType,
            creationTime: notebook.CreationTime?.toISOString(),
            region
          });

          // Notebooks en cours d'exécution
          if (notebook.NotebookInstanceStatus === 'InService') {
            this.addIssue({
              type: 'SAGEMAKER_NOTEBOOK_RUNNING',
              severity: 'MEDIUM',
              message: `Notebook SageMaker en cours: ${notebook.NotebookInstanceName} (${notebook.InstanceType})`,
              resources: [notebook.NotebookInstanceArn!],
              recommendation: 'Arrêter les notebooks non utilisés'
            });
          }
        }
      }

      // Models
      const modelsResponse = await this.safeApiCall(
        () => client.send(new ListModelsCommand({})),
        `SageMaker models ${region}`
      );

      if (modelsResponse?.Models) {
        for (const model of modelsResponse.Models) {
          models.push({
            modelName: model.ModelName,
            modelArn: model.ModelArn,
            creationTime: model.CreationTime?.toISOString(),
            region
          });
        }
      }

      // Training Jobs (récents)
      const trainingResponse = await this.safeApiCall(
        () => client.send(new ListTrainingJobsCommand({
          MaxResults: 50,
          SortBy: 'CreationTime',
          SortOrder: 'Descending'
        })),
        `SageMaker training jobs ${region}`
      );

      if (trainingResponse?.TrainingJobSummaries) {
        for (const job of trainingResponse.TrainingJobSummaries) {
          trainingJobs.push({
            trainingJobName: job.TrainingJobName,
            trainingJobArn: job.TrainingJobArn,
            trainingJobStatus: job.TrainingJobStatus,
            creationTime: job.CreationTime?.toISOString(),
            trainingEndTime: job.TrainingEndTime?.toISOString(),
            region
          });
        }
      }
    }

    return {
      endpoints,
      notebookInstances,
      models,
      trainingJobs,
      summary: {
        totalEndpoints: endpoints.length,
        activeEndpoints: endpoints.filter(e => e.endpointStatus === 'InService').length,
        totalNotebooks: notebookInstances.length,
        runningNotebooks: notebookInstances.filter(n => n.notebookInstanceStatus === 'InService').length,
        totalModels: models.length,
        totalTrainingJobs: trainingJobs.length
      }
    };
  }

  private async auditBedrock(regions: string[]): Promise<any> {
    const foundationModels: any[] = [];
    const customModels: any[] = [];

    // Bedrock n'est pas disponible dans toutes les régions
    const bedrockRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'];

    for (const region of bedrockRegions) {
      const client = new BedrockClient(this.getClientConfig(region));

      // Foundation Models
      const foundationResponse = await this.safeApiCall(
        () => client.send(new ListFoundationModelsCommand({})),
        `Bedrock foundation models ${region}`
      );

      if (foundationResponse?.modelSummaries) {
        // On ne garde que les modèles accessibles
        for (const model of foundationResponse.modelSummaries) {
          if (model.modelLifecycle?.status === 'ACTIVE') {
            foundationModels.push({
              modelId: model.modelId,
              modelName: model.modelName,
              providerName: model.providerName,
              inputModalities: model.inputModalities,
              outputModalities: model.outputModalities,
              region
            });
          }
        }
      }

      // Custom Models
      const customResponse = await this.safeApiCall(
        () => client.send(new ListCustomModelsCommand({})),
        `Bedrock custom models ${region}`
      );

      if (customResponse?.modelSummaries) {
        for (const model of customResponse.modelSummaries) {
          customModels.push({
            modelArn: model.modelArn,
            modelName: model.modelName,
            baseModelArn: model.baseModelArn,
            creationTime: model.creationTime?.toISOString(),
            region
          });
        }
      }
    }

    return {
      foundationModels: foundationModels.slice(0, 20), // Limiter pour ne pas surcharger
      customModels,
      summary: {
        availableFoundationModels: foundationModels.length,
        totalCustomModels: customModels.length
      }
    };
  }
}
