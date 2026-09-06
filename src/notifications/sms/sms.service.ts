import { Injectable, Logger } from '@nestjs/common';

interface AfricaTalkingSmsResponse {
  SMSMessageData?: {
    Message?: unknown;
    Recipients?: unknown;
  };
}

export interface SmsSendResult {
  success: boolean;
  messageId: string | null;
  status: string | null;
  number: string;
  cost: string | null;
  message: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private getUsername(): string {
    return process.env.AT_USERNAME?.trim() || '';
  }

  private getApiKey(): string {
    return process.env.AT_API_KEY?.trim() || '';
  }

  private isSandbox(): boolean {
    return process.env.AT_SANDBOX?.trim().toLowerCase() === 'true';
  }

  private getBaseUrl(): string {
    return this.isSandbox()
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com';
  }

  private getSenderId(): string | undefined {
    const senderId = process.env.AT_SENDER_ID?.trim();

    return senderId || undefined;
  }

  private normalizePhone(phone: string): string {
    const normalized = phone.trim().replace(/\s+/g, '');

    if (/^07\d{8}$/.test(normalized)) {
      return `+254${normalized.substring(1)}`;
    }

    if (/^01\d{8}$/.test(normalized)) {
      return `+254${normalized.substring(1)}`;
    }

    if (/^254\d{9}$/.test(normalized)) {
      return `+${normalized}`;
    }

    if (/^\+254\d{9}$/.test(normalized)) {
      return normalized;
    }

    return normalized;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private parseResponse(value: unknown, recipient: string): SmsSendResult {
    const root = this.asRecord(value);
    const smsData = this.asRecord(root.SMSMessageData);

    const recipientsValue = smsData.Recipients;

    const recipients: unknown[] = Array.isArray(recipientsValue)
      ? recipientsValue
      : [];

    const firstRecipient = this.asRecord(recipients[0]);

    const number =
      typeof firstRecipient.number === 'string'
        ? firstRecipient.number
        : recipient;

    const status =
      typeof firstRecipient.status === 'string' ? firstRecipient.status : null;

    const messageId =
      typeof firstRecipient.messageId === 'string'
        ? firstRecipient.messageId
        : null;

    const cost =
      typeof firstRecipient.cost === 'string'
        ? firstRecipient.cost
        : typeof firstRecipient.cost === 'number'
          ? String(firstRecipient.cost)
          : null;

    const statusCode =
      typeof firstRecipient.statusCode === 'number'
        ? firstRecipient.statusCode
        : typeof firstRecipient.statusCode === 'string'
          ? Number(firstRecipient.statusCode)
          : null;

    const message =
      typeof smsData.Message === 'string'
        ? smsData.Message
        : "SMS request accepted by Africa's Talking.";

    /*
     * Africa's Talking uses:
     *
     * statusCode: 101
     * status: "Success"
     *
     * for a successfully accepted SMS API request.
     *
     * The later delivery report can have statuses such as:
     * Success, Failed, Rejected, Submitted, Buffered, etc.
     *
     * Therefore "sent" must NOT be used as the API acceptance
     * criterion.
     */
    const success =
      recipients.length > 0 &&
      (statusCode === 101 || status?.toLowerCase() === 'success');

    return {
      success,
      messageId,
      status,
      number,
      cost,
      message,
    };
  }

  async send(phone: string, message: string): Promise<SmsSendResult> {
    const username = this.getUsername();
    const apiKey = this.getApiKey();

    if (!username) {
      throw new Error('AT_USERNAME is not configured.');
    }

    if (!apiKey) {
      throw new Error('AT_API_KEY is not configured.');
    }

    const recipient = this.normalizePhone(phone);

    if (!recipient) {
      throw new Error('A recipient phone number is required.');
    }

    if (!message.trim()) {
      throw new Error('An SMS message is required.');
    }

    const form = new URLSearchParams();

    form.set('username', username);
    form.set('to', recipient);
    form.set('message', message.trim());

    const senderId = this.getSenderId();

    if (senderId) {
      form.set('from', senderId);
    }

    const response = await fetch(`${this.getBaseUrl()}/version1/messaging`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const responseText = await response.text();

    let responseData: AfricaTalkingSmsResponse | null = null;

    if (responseText) {
      try {
        responseData = JSON.parse(responseText) as AfricaTalkingSmsResponse;
      } catch {
        responseData = null;
      }
    }

    if (!response.ok) {
      const apiMessage = responseData
        ? this.extractErrorMessage(responseData)
        : responseText;

      const errorMessage =
        apiMessage || `Africa's Talking returned HTTP ${response.status}.`;

      this.logger.error(`SMS request failed for ${recipient}: ${errorMessage}`);

      throw new Error(errorMessage);
    }

    if (!responseData) {
      throw new Error(
        "Africa's Talking returned an empty or invalid response.",
      );
    }

    const result = this.parseResponse(responseData, recipient);

    if (!result.success) {
      this.logger.warn(
        `Africa's Talking rejected SMS for ${recipient}: ${result.message}`,
      );
    }

    return result;
  }

  private extractErrorMessage(value: unknown): string | null {
    const root = this.asRecord(value);

    const error = this.asRecord(root.error);

    if (typeof error.message === 'string') {
      return error.message;
    }

    if (typeof root.message === 'string') {
      return root.message;
    }

    const smsData = this.asRecord(root.SMSMessageData);

    if (typeof smsData.Message === 'string') {
      return smsData.Message;
    }

    return null;
  }
}
