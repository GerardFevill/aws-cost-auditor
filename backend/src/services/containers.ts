/**
 * Service d'audit Containers (ECR, ECS, EKS)
 * Note: ECS et EKS sont aussi audités dans compute.ts, ici on se concentre sur ECR
 */

import {
  ECRClient,
  DescribeRepositoriesCommand,
  DescribeImagesCommand,
  GetLifecyclePolicyCommand
} from '@aws-sdk/client-ecr';
import { BaseAuditor } from './base';

export class ContainersAuditor extends BaseAuditor {
  get serviceName() { return 'Containers'; }
  get category() { return 'containers'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();
    const ecr = await this.auditECR(targetRegions);

    return this.buildResult({
      ecr
    });
  }

  private async auditECR(regions: string[]): Promise<any> {
    const repositories: any[] = [];

    for (const region of regions) {
      const client = new ECRClient(this.getClientConfig(region));

      const reposResponse = await this.safeApiCall(
        () => client.send(new DescribeRepositoriesCommand({})),
        `ECR ${region}`
      );

      if (reposResponse?.repositories) {
        for (const repo of reposResponse.repositories) {
          // Get image count
          const imagesResponse = await this.safeApiCall(
            () => client.send(new DescribeImagesCommand({
              repositoryName: repo.repositoryName
            })),
            `ECR images ${repo.repositoryName}`
          );

          const imageCount = imagesResponse?.imageDetails?.length || 0;
          const totalSizeBytes = imagesResponse?.imageDetails?.reduce(
            (sum, img) => sum + (img.imageSizeInBytes || 0), 0
          ) || 0;

          // Check lifecycle policy
          let hasLifecyclePolicy = false;
          const lifecycleResponse = await this.safeApiCall(
            () => client.send(new GetLifecyclePolicyCommand({
              repositoryName: repo.repositoryName
            })),
            `ECR lifecycle ${repo.repositoryName}`
          );
          hasLifecyclePolicy = !!lifecycleResponse?.lifecyclePolicyText;

          repositories.push({
            repositoryName: repo.repositoryName,
            repositoryArn: repo.repositoryArn,
            repositoryUri: repo.repositoryUri,
            createdAt: repo.createdAt?.toISOString(),
            imageTagMutability: repo.imageTagMutability,
            imageScanningEnabled: repo.imageScanningConfiguration?.scanOnPush,
            encryptionType: repo.encryptionConfiguration?.encryptionType,
            imageCount,
            totalSizeBytes,
            totalSizeMB: Math.round(totalSizeBytes / (1024 * 1024) * 100) / 100,
            hasLifecyclePolicy,
            region
          });

          // Repo sans lifecycle policy (accumulation d'images)
          if (!hasLifecyclePolicy && imageCount > 10) {
            this.addIssue({
              type: 'ECR_NO_LIFECYCLE',
              severity: 'LOW',
              message: `ECR repo sans lifecycle policy (${imageCount} images): ${repo.repositoryName}`,
              resources: [repo.repositoryArn!],
              recommendation: 'Configurer une lifecycle policy pour supprimer les anciennes images'
            });
          }

          // Repo avec beaucoup d'images
          if (imageCount > 100) {
            this.addIssue({
              type: 'ECR_MANY_IMAGES',
              severity: 'INFO',
              message: `ECR repo avec ${imageCount} images: ${repo.repositoryName}`,
              resources: [repo.repositoryArn!],
              recommendation: 'Vérifier si toutes les images sont nécessaires'
            });
          }
        }
      }
    }

    const totalSize = repositories.reduce((sum, r) => sum + r.totalSizeBytes, 0);
    const totalImages = repositories.reduce((sum, r) => sum + r.imageCount, 0);

    return {
      repositories,
      summary: {
        totalRepositories: repositories.length,
        totalImages,
        totalSizeBytes: totalSize,
        totalSizeGB: Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100,
        withLifecyclePolicy: repositories.filter(r => r.hasLifecyclePolicy).length,
        withScanningEnabled: repositories.filter(r => r.imageScanningEnabled).length
      }
    };
  }
}
