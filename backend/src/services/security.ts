/**
 * Service d'audit Security (IAM, KMS, Secrets Manager, ACM, WAF, GuardDuty)
 */

import {
  IAMClient,
  ListUsersCommand,
  ListRolesCommand,
  ListPoliciesCommand,
  ListAccessKeysCommand,
  GetAccessKeyLastUsedCommand
} from '@aws-sdk/client-iam';
import {
  KMSClient,
  ListKeysCommand,
  DescribeKeyCommand
} from '@aws-sdk/client-kms';
import {
  SecretsManagerClient,
  ListSecretsCommand
} from '@aws-sdk/client-secrets-manager';
import {
  ACMClient,
  ListCertificatesCommand,
  DescribeCertificateCommand
} from '@aws-sdk/client-acm';
import {
  WAFV2Client,
  ListWebACLsCommand
} from '@aws-sdk/client-wafv2';
import {
  GuardDutyClient,
  ListDetectorsCommand,
  GetDetectorCommand
} from '@aws-sdk/client-guardduty';
import { BaseAuditor } from './base';

export class SecurityAuditor extends BaseAuditor {
  get serviceName() { return 'Security'; }
  get category() { return 'security'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const [iam, kms, secretsManager, acm, waf, guardduty] = await Promise.all([
      this.auditIAM(),
      this.auditKMS(targetRegions),
      this.auditSecretsManager(targetRegions),
      this.auditACM(targetRegions),
      this.auditWAF(targetRegions),
      this.auditGuardDuty(targetRegions)
    ]);

    return this.buildResult({
      iam,
      kms,
      secretsManager,
      acm,
      waf,
      guardduty
    });
  }

  private async auditIAM(): Promise<any> {
    const client = new IAMClient(this.getClientConfig('us-east-1'));

    const users: any[] = [];
    const roles: any[] = [];
    const policies: any[] = [];

    // Users
    const usersResponse = await this.safeApiCall(
      () => client.send(new ListUsersCommand({})),
      'IAM users'
    );

    if (usersResponse?.Users) {
      for (const user of usersResponse.Users) {
        // Vérifier les access keys
        const keysResponse = await this.safeApiCall(
          () => client.send(new ListAccessKeysCommand({ UserName: user.UserName })),
          `IAM keys ${user.UserName}`
        );

        const accessKeys: any[] = [];
        if (keysResponse?.AccessKeyMetadata) {
          for (const key of keysResponse.AccessKeyMetadata) {
            const lastUsedResponse = await this.safeApiCall(
              () => client.send(new GetAccessKeyLastUsedCommand({ AccessKeyId: key.AccessKeyId })),
              `IAM key last used ${key.AccessKeyId}`
            );

            accessKeys.push({
              accessKeyId: key.AccessKeyId,
              status: key.Status,
              createDate: key.CreateDate?.toISOString(),
              lastUsed: lastUsedResponse?.AccessKeyLastUsed?.LastUsedDate?.toISOString()
            });

            // Détecter les clés anciennes
            if (key.CreateDate) {
              const age = Date.now() - key.CreateDate.getTime();
              if (age > 90 * 24 * 60 * 60 * 1000) { // 90 jours
                this.addIssue({
                  type: 'OLD_ACCESS_KEY',
                  severity: 'MEDIUM',
                  message: `Clé d'accès de plus de 90 jours: ${user.UserName}`,
                  resources: [key.AccessKeyId!],
                  recommendation: 'Rotation des clés d\'accès recommandée'
                });
              }
            }
          }
        }

        users.push({
          userName: user.UserName,
          userId: user.UserId,
          arn: user.Arn,
          createDate: user.CreateDate?.toISOString(),
          passwordLastUsed: user.PasswordLastUsed?.toISOString(),
          accessKeys
        });
      }
    }

    // Roles
    const rolesResponse = await this.safeApiCall(
      () => client.send(new ListRolesCommand({})),
      'IAM roles'
    );

    if (rolesResponse?.Roles) {
      for (const role of rolesResponse.Roles) {
        roles.push({
          roleName: role.RoleName,
          roleId: role.RoleId,
          arn: role.Arn,
          createDate: role.CreateDate?.toISOString(),
          maxSessionDuration: role.MaxSessionDuration
        });
      }
    }

    // Policies
    const policiesResponse = await this.safeApiCall(
      () => client.send(new ListPoliciesCommand({ Scope: 'Local' })),
      'IAM policies'
    );

    if (policiesResponse?.Policies) {
      for (const policy of policiesResponse.Policies) {
        policies.push({
          policyName: policy.PolicyName,
          policyId: policy.PolicyId,
          arn: policy.Arn,
          attachmentCount: policy.AttachmentCount,
          createDate: policy.CreateDate?.toISOString()
        });

        // Policies non attachées
        if (policy.AttachmentCount === 0) {
          this.addIssue({
            type: 'UNATTACHED_POLICY',
            severity: 'LOW',
            message: `Policy non attachée: ${policy.PolicyName}`,
            resources: [policy.Arn!],
            recommendation: 'Supprimer les policies inutilisées'
          });
        }
      }
    }

    return {
      users,
      roles,
      policies,
      summary: {
        totalUsers: users.length,
        totalRoles: roles.length,
        totalPolicies: policies.length,
        usersWithAccessKeys: users.filter(u => u.accessKeys.length > 0).length
      }
    };
  }

  private async auditKMS(regions: string[]): Promise<any> {
    const keys: any[] = [];

    for (const region of regions) {
      const client = new KMSClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListKeysCommand({})),
        `KMS keys ${region}`
      );

      if (listResponse?.Keys) {
        for (const key of listResponse.Keys) {
          const describeResponse = await this.safeApiCall(
            () => client.send(new DescribeKeyCommand({ KeyId: key.KeyId })),
            `KMS describe ${key.KeyId}`
          );

          if (describeResponse?.KeyMetadata) {
            const metadata = describeResponse.KeyMetadata;
            keys.push({
              keyId: metadata.KeyId,
              arn: metadata.Arn,
              description: metadata.Description,
              keyState: metadata.KeyState,
              keyUsage: metadata.KeyUsage,
              keyManager: metadata.KeyManager,
              creationDate: metadata.CreationDate?.toISOString(),
              region
            });
          }
        }
      }
    }

    return {
      keys,
      summary: {
        totalKeys: keys.length,
        customerManagedKeys: keys.filter(k => k.keyManager === 'CUSTOMER').length,
        awsManagedKeys: keys.filter(k => k.keyManager === 'AWS').length
      }
    };
  }

  private async auditSecretsManager(regions: string[]): Promise<any> {
    const secrets: any[] = [];

    for (const region of regions) {
      const client = new SecretsManagerClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new ListSecretsCommand({})),
        `Secrets Manager ${region}`
      );

      if (response?.SecretList) {
        for (const secret of response.SecretList) {
          secrets.push({
            name: secret.Name,
            arn: secret.ARN,
            lastAccessedDate: secret.LastAccessedDate?.toISOString(),
            lastChangedDate: secret.LastChangedDate?.toISOString(),
            rotationEnabled: secret.RotationEnabled,
            region
          });

          // Secret sans rotation
          if (!secret.RotationEnabled) {
            this.addIssue({
              type: 'SECRET_NO_ROTATION',
              severity: 'LOW',
              message: `Secret sans rotation automatique: ${secret.Name}`,
              resources: [secret.ARN!],
              recommendation: 'Activer la rotation automatique des secrets'
            });
          }
        }
      }
    }

    return {
      secrets,
      summary: {
        totalSecrets: secrets.length,
        withRotation: secrets.filter(s => s.rotationEnabled).length
      }
    };
  }

  private async auditACM(regions: string[]): Promise<any> {
    const certificates: any[] = [];

    for (const region of regions) {
      const client = new ACMClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListCertificatesCommand({})),
        `ACM certificates ${region}`
      );

      if (listResponse?.CertificateSummaryList) {
        for (const cert of listResponse.CertificateSummaryList) {
          const describeResponse = await this.safeApiCall(
            () => client.send(new DescribeCertificateCommand({ CertificateArn: cert.CertificateArn })),
            `ACM describe ${cert.CertificateArn}`
          );

          if (describeResponse?.Certificate) {
            const c = describeResponse.Certificate;
            certificates.push({
              arn: c.CertificateArn,
              domainName: c.DomainName,
              status: c.Status,
              type: c.Type,
              issuer: c.Issuer,
              notBefore: c.NotBefore?.toISOString(),
              notAfter: c.NotAfter?.toISOString(),
              inUseBy: c.InUseBy?.length || 0,
              region
            });

            // Certificat expirant bientôt
            if (c.NotAfter) {
              const daysUntilExpiry = (c.NotAfter.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
              if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
                this.addIssue({
                  type: 'CERTIFICATE_EXPIRING',
                  severity: 'HIGH',
                  message: `Certificat expire dans ${Math.round(daysUntilExpiry)} jours: ${c.DomainName}`,
                  resources: [c.CertificateArn!],
                  recommendation: 'Renouveler le certificat avant expiration'
                });
              }
            }
          }
        }
      }
    }

    return {
      certificates,
      summary: {
        totalCertificates: certificates.length,
        byStatus: this.countBy(certificates, 'status')
      }
    };
  }

  private async auditWAF(regions: string[]): Promise<any> {
    const webACLs: any[] = [];

    // WAF Global (CloudFront)
    const globalClient = new WAFV2Client(this.getClientConfig('us-east-1'));
    const globalResponse = await this.safeApiCall(
      () => globalClient.send(new ListWebACLsCommand({ Scope: 'CLOUDFRONT' })),
      'WAF global'
    );

    if (globalResponse?.WebACLs) {
      for (const acl of globalResponse.WebACLs) {
        webACLs.push({
          id: acl.Id,
          name: acl.Name,
          scope: 'CLOUDFRONT',
          region: 'global'
        });
      }
    }

    // WAF Regional
    for (const region of regions) {
      const client = new WAFV2Client(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new ListWebACLsCommand({ Scope: 'REGIONAL' })),
        `WAF ${region}`
      );

      if (response?.WebACLs) {
        for (const acl of response.WebACLs) {
          webACLs.push({
            id: acl.Id,
            name: acl.Name,
            scope: 'REGIONAL',
            region
          });
        }
      }
    }

    return {
      webACLs,
      summary: {
        totalWebACLs: webACLs.length,
        globalACLs: webACLs.filter(a => a.scope === 'CLOUDFRONT').length,
        regionalACLs: webACLs.filter(a => a.scope === 'REGIONAL').length
      }
    };
  }

  private async auditGuardDuty(regions: string[]): Promise<any> {
    const detectors: any[] = [];

    for (const region of regions) {
      const client = new GuardDutyClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListDetectorsCommand({})),
        `GuardDuty ${region}`
      );

      if (listResponse?.DetectorIds) {
        for (const detectorId of listResponse.DetectorIds) {
          const getResponse = await this.safeApiCall(
            () => client.send(new GetDetectorCommand({ DetectorId: detectorId })),
            `GuardDuty get ${detectorId}`
          );

          if (getResponse) {
            detectors.push({
              detectorId,
              status: getResponse.Status,
              findingPublishingFrequency: getResponse.FindingPublishingFrequency,
              region
            });
          }
        }
      }
    }

    // Vérifier les régions sans GuardDuty
    const regionsWithGuardDuty = new Set(detectors.map(d => d.region));
    for (const region of regions.slice(0, 5)) { // Vérifier les 5 principales régions
      if (!regionsWithGuardDuty.has(region)) {
        this.addIssue({
          type: 'NO_GUARDDUTY',
          severity: 'MEDIUM',
          message: `GuardDuty non activé dans: ${region}`,
          resources: [region],
          recommendation: 'Activer GuardDuty pour la détection des menaces'
        });
      }
    }

    return {
      detectors,
      summary: {
        totalDetectors: detectors.length,
        regionsWithGuardDuty: regionsWithGuardDuty.size
      }
    };
  }

  private countBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}
