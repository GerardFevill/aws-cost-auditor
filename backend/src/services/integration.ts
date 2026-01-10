/**
 * Service d'audit Integration (SQS, SNS, EventBridge, Step Functions)
 */

import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand
} from '@aws-sdk/client-sqs';
import {
  SNSClient,
  ListTopicsCommand,
  ListSubscriptionsCommand
} from '@aws-sdk/client-sns';
import {
  EventBridgeClient,
  ListRulesCommand,
  ListEventBusesCommand
} from '@aws-sdk/client-eventbridge';
import {
  SFNClient,
  ListStateMachinesCommand
} from '@aws-sdk/client-sfn';
import { BaseAuditor } from './base';

export class IntegrationAuditor extends BaseAuditor {
  get serviceName() { return 'Integration'; }
  get category() { return 'integration'; }

  async audit(regions?: string[]): Promise<any> {
    const targetRegions = regions || await this.getRegions();

    const [sqs, sns, eventbridge, stepfunctions] = await Promise.all([
      this.auditSQS(targetRegions),
      this.auditSNS(targetRegions),
      this.auditEventBridge(targetRegions),
      this.auditStepFunctions(targetRegions)
    ]);

    return this.buildResult({
      sqs,
      sns,
      eventbridge,
      stepfunctions
    });
  }

  private async auditSQS(regions: string[]): Promise<any> {
    const queues: any[] = [];

    for (const region of regions) {
      const client = new SQSClient(this.getClientConfig(region));

      const listResponse = await this.safeApiCall(
        () => client.send(new ListQueuesCommand({})),
        `SQS ${region}`
      );

      if (listResponse?.QueueUrls) {
        for (const queueUrl of listResponse.QueueUrls) {
          const attrsResponse = await this.safeApiCall(
            () => client.send(new GetQueueAttributesCommand({
              QueueUrl: queueUrl,
              AttributeNames: ['All']
            })),
            `SQS attributes ${queueUrl}`
          );

          const attrs = attrsResponse?.Attributes || {};
          const queueName = queueUrl.split('/').pop();

          queues.push({
            queueUrl,
            queueName,
            approximateNumberOfMessages: parseInt(attrs.ApproximateNumberOfMessages || '0'),
            approximateNumberOfMessagesDelayed: parseInt(attrs.ApproximateNumberOfMessagesDelayed || '0'),
            approximateNumberOfMessagesNotVisible: parseInt(attrs.ApproximateNumberOfMessagesNotVisible || '0'),
            visibilityTimeout: parseInt(attrs.VisibilityTimeout || '0'),
            messageRetentionPeriod: parseInt(attrs.MessageRetentionPeriod || '0'),
            createdTimestamp: attrs.CreatedTimestamp,
            isFifo: queueName?.endsWith('.fifo') || false,
            region
          });

          // Détecter les queues avec beaucoup de messages en attente
          const messageCount = parseInt(attrs.ApproximateNumberOfMessages || '0');
          if (messageCount > 10000) {
            this.addIssue({
              type: 'SQS_HIGH_MESSAGE_COUNT',
              severity: 'MEDIUM',
              message: `Queue SQS avec ${messageCount} messages: ${queueName}`,
              resources: [queueUrl],
              recommendation: 'Vérifier le traitement des messages'
            });
          }
        }
      }
    }

    return {
      queues,
      summary: {
        totalQueues: queues.length,
        fifoQueues: queues.filter(q => q.isFifo).length,
        standardQueues: queues.filter(q => !q.isFifo).length,
        totalMessages: queues.reduce((sum, q) => sum + q.approximateNumberOfMessages, 0)
      }
    };
  }

  private async auditSNS(regions: string[]): Promise<any> {
    const topics: any[] = [];
    const subscriptions: any[] = [];

    for (const region of regions) {
      const client = new SNSClient(this.getClientConfig(region));

      // Topics
      const topicsResponse = await this.safeApiCall(
        () => client.send(new ListTopicsCommand({})),
        `SNS topics ${region}`
      );

      if (topicsResponse?.Topics) {
        for (const topic of topicsResponse.Topics) {
          const topicName = topic.TopicArn?.split(':').pop();
          topics.push({
            topicArn: topic.TopicArn,
            topicName,
            region
          });
        }
      }

      // Subscriptions
      const subsResponse = await this.safeApiCall(
        () => client.send(new ListSubscriptionsCommand({})),
        `SNS subscriptions ${region}`
      );

      if (subsResponse?.Subscriptions) {
        for (const sub of subsResponse.Subscriptions) {
          subscriptions.push({
            subscriptionArn: sub.SubscriptionArn,
            topicArn: sub.TopicArn,
            protocol: sub.Protocol,
            endpoint: sub.Endpoint,
            owner: sub.Owner,
            region
          });
        }
      }
    }

    return {
      topics,
      subscriptions,
      summary: {
        totalTopics: topics.length,
        totalSubscriptions: subscriptions.length,
        subscriptionsByProtocol: this.countBy(subscriptions, 'protocol')
      }
    };
  }

  private async auditEventBridge(regions: string[]): Promise<any> {
    const eventBuses: any[] = [];
    const rules: any[] = [];

    for (const region of regions) {
      const client = new EventBridgeClient(this.getClientConfig(region));

      // Event Buses
      const busesResponse = await this.safeApiCall(
        () => client.send(new ListEventBusesCommand({})),
        `EventBridge buses ${region}`
      );

      if (busesResponse?.EventBuses) {
        for (const bus of busesResponse.EventBuses) {
          eventBuses.push({
            name: bus.Name,
            arn: bus.Arn,
            region
          });
        }
      }

      // Rules
      const rulesResponse = await this.safeApiCall(
        () => client.send(new ListRulesCommand({})),
        `EventBridge rules ${region}`
      );

      if (rulesResponse?.Rules) {
        for (const rule of rulesResponse.Rules) {
          rules.push({
            name: rule.Name,
            arn: rule.Arn,
            state: rule.State,
            eventBusName: rule.EventBusName,
            scheduleExpression: rule.ScheduleExpression,
            region
          });

          // Règles désactivées
          if (rule.State === 'DISABLED') {
            this.addIssue({
              type: 'DISABLED_EVENTBRIDGE_RULE',
              severity: 'INFO',
              message: `Règle EventBridge désactivée: ${rule.Name}`,
              resources: [rule.Arn!],
              recommendation: 'Supprimer les règles inutilisées'
            });
          }
        }
      }
    }

    return {
      eventBuses,
      rules,
      summary: {
        totalEventBuses: eventBuses.length,
        totalRules: rules.length,
        enabledRules: rules.filter(r => r.state === 'ENABLED').length,
        disabledRules: rules.filter(r => r.state === 'DISABLED').length
      }
    };
  }

  private async auditStepFunctions(regions: string[]): Promise<any> {
    const stateMachines: any[] = [];

    for (const region of regions) {
      const client = new SFNClient(this.getClientConfig(region));

      const response = await this.safeApiCall(
        () => client.send(new ListStateMachinesCommand({})),
        `Step Functions ${region}`
      );

      if (response?.stateMachines) {
        for (const sm of response.stateMachines) {
          stateMachines.push({
            name: sm.name,
            arn: sm.stateMachineArn,
            type: sm.type,
            creationDate: sm.creationDate?.toISOString(),
            region
          });
        }
      }
    }

    return {
      stateMachines,
      summary: {
        totalStateMachines: stateMachines.length,
        byType: this.countBy(stateMachines, 'type')
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
