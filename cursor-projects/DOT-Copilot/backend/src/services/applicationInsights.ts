import { logError } from './logger';
import * as appInsights from 'applicationinsights';

export function initApplicationInsights() {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;

  if (!connectionString && !instrumentationKey) {
    console.warn('Application Insights not configured');
    return;
  }

  try {
    if (connectionString) {
      appInsights.setup(connectionString)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true, false)
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(false)
        .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
        .start();

      console.log('Application Insights initialized');
    } else if (instrumentationKey) {
      // Legacy support for instrumentation key
      appInsights.setup(instrumentationKey)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true, false)
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(false)
        .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
        .start();

      console.log('Application Insights initialized (legacy mode)');
    }
  } catch (error) {
    logError('Failed to initialize Application Insights', error);
  }
}

export function trackEvent(name: string, properties?: Record<string, string>) {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackEvent({
      name,
      properties,
    });
  }
}

export function trackException(error: Error, properties?: Record<string, string>) {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackException({
      exception: error,
      properties,
    });
  }
}

export function trackMetric(name: string, value: number) {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackMetric({
      name,
      value,
    });
  }
}

export { appInsights };

