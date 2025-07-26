/// <reference types="chrome"/>

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
}

export interface UsageStats {
  requestsLastMinute: number;
  requestsLastHour: number;
  requestsLastDay: number;
  tokensLastMinute: number;
  tokensLastDay: number;
  lastRequestTime: number;
}

export interface RequestRecord {
  timestamp: number;
  tokens: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private storageKey = "rateLimiterData";

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async canMakeRequest(
    estimatedTokens: number = 1000,
  ): Promise<{ allowed: boolean; reason?: string; waitTime?: number }> {
    const stats = await this.getUsageStats();
    const now = Date.now();

    // Check requests per minute
    if (stats.requestsLastMinute >= this.config.requestsPerMinute) {
      const waitTime = 60000 - (now - stats.lastRequestTime);
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.requestsPerMinute} requests per minute`,
        waitTime: Math.max(0, waitTime),
      };
    }

    // Check requests per hour
    if (stats.requestsLastHour >= this.config.requestsPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.requestsPerHour} requests per hour`,
        waitTime: 3600000, // 1 hour
      };
    }

    // Check requests per day
    if (stats.requestsLastDay >= this.config.requestsPerDay) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.requestsPerDay} requests per day`,
        waitTime: 86400000, // 24 hours
      };
    }

    // Check tokens per minute
    if (
      this.config.tokensPerMinute &&
      stats.tokensLastMinute + estimatedTokens > this.config.tokensPerMinute
    ) {
      const waitTime = 60000 - (now - stats.lastRequestTime);
      return {
        allowed: false,
        reason: `Token rate limit exceeded: ${this.config.tokensPerMinute} tokens per minute`,
        waitTime: Math.max(0, waitTime),
      };
    }

    // Check tokens per day
    if (
      this.config.tokensPerDay &&
      stats.tokensLastDay + estimatedTokens > this.config.tokensPerDay
    ) {
      return {
        allowed: false,
        reason: `Daily token limit exceeded: ${this.config.tokensPerDay} tokens per day`,
        waitTime: 86400000, // 24 hours
      };
    }

    return { allowed: true };
  }

  async recordRequest(actualTokens: number): Promise<void> {
    const data = await this.getStorageData();
    const now = Date.now();

    data.requests.push({
      timestamp: now,
      tokens: actualTokens,
    });

    // Clean old records (keep last 24 hours)
    const oneDayAgo = now - 86400000;
    data.requests = data.requests.filter(
      (record) => record.timestamp > oneDayAgo,
    );

    await this.saveStorageData(data);
  }

  async getUsageStats(): Promise<UsageStats> {
    const data = await this.getStorageData();
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const recentRequests = data.requests.filter(
      (record) => record.timestamp > oneDayAgo,
    );

    const requestsLastMinute = recentRequests.filter(
      (record) => record.timestamp > oneMinuteAgo,
    ).length;
    const requestsLastHour = recentRequests.filter(
      (record) => record.timestamp > oneHourAgo,
    ).length;
    const requestsLastDay = recentRequests.length;

    const tokensLastMinute = recentRequests
      .filter((record) => record.timestamp > oneMinuteAgo)
      .reduce((sum, record) => sum + record.tokens, 0);

    const tokensLastDay = recentRequests.reduce(
      (sum, record) => sum + record.tokens,
      0,
    );

    const lastRequestTime =
      recentRequests.length > 0
        ? Math.max(...recentRequests.map((r) => r.timestamp))
        : 0;

    return {
      requestsLastMinute,
      requestsLastHour,
      requestsLastDay,
      tokensLastMinute,
      tokensLastDay,
      lastRequestTime,
    };
  }

  async resetUsage(): Promise<void> {
    await this.saveStorageData({ requests: [] });
  }

  private async getStorageData(): Promise<{ requests: RequestRecord[] }> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        resolve(result[this.storageKey] || { requests: [] });
      });
    });
  }

  private async saveStorageData(data: {
    requests: RequestRecord[];
  }): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.storageKey]: data }, resolve);
    });
  }
}

// Predefined rate limit configurations for different providers
export const RATE_LIMIT_CONFIGS = {
  OPENAI_FREE: {
    requestsPerMinute: 3,
    requestsPerHour: 200,
    requestsPerDay: 200,
    tokensPerMinute: 40000,
    tokensPerDay: 200000,
  },
  OPENAI_PAID: {
    requestsPerMinute: 60,
    requestsPerHour: 3600,
    requestsPerDay: 10000,
    tokensPerMinute: 90000,
    tokensPerDay: 2000000,
  },
  DEEPSEEK: {
    requestsPerMinute: 30,
    requestsPerHour: 1800,
    requestsPerDay: 5000,
    tokensPerMinute: 60000,
    tokensPerDay: 1000000,
  },
  GEMINI_FREE: {
    requestsPerMinute: 15,
    requestsPerHour: 1500,
    requestsPerDay: 1500,
    tokensPerMinute: 32000,
    tokensPerDay: 50000,
  },
  GEMINI_PAID: {
    requestsPerMinute: 360,
    requestsPerHour: 21600,
    requestsPerDay: 50000,
    tokensPerMinute: 4000000,
    tokensPerDay: 4000000,
  },
  CONSERVATIVE: {
    requestsPerMinute: 2,
    requestsPerHour: 100,
    requestsPerDay: 500,
    tokensPerMinute: 20000,
    tokensPerDay: 100000,
  },
  UNLIMITED: {
    requestsPerMinute: 60,
    requestsPerHour: 3600,
    requestsPerDay: 14400,
    tokensPerMinute: 1000000,
    tokensPerDay: 1000000,
  },
} as const;

export function createRateLimiter(
  provider: keyof typeof RATE_LIMIT_CONFIGS,
): RateLimiter {
  // return new RateLimiter(RATE_LIMIT_CONFIGS[provider]);
  // replace with an unlimited version
  return new RateLimiter(RATE_LIMIT_CONFIGS.UNLIMITED);
}
