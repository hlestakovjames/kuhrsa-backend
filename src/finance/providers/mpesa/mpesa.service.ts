import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PaymentProvider,
  PaymentProviderStkRequest,
  PaymentProviderStkResponse,
} from '../payment-provider.interface';
import {
  MpesaAccessTokenResponse,
  MpesaStkCallback,
  MpesaStkResponse,
} from './mpesa.types';

@Injectable()
export class MpesaService implements PaymentProvider {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async initiateStkPush(
    request: PaymentProviderStkRequest,
  ): Promise<PaymentProviderStkResponse> {
    const organizationId = await this.resolveOrganizationId(request.paymentId);

    const configuration = await this.prisma.paymentConfiguration.findFirst({
      where: {
        organizationId,
        provider: {
          type: 'MPESA',
          isActive: true,
        },
        enabled: true,
      },
      include: {
        provider: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!configuration) {
      throw new BadRequestException(
        'No active M-Pesa payment configuration is available.',
      );
    }

    if (configuration.environment !== 'sandbox' &&
        configuration.environment !== 'production') {
      throw new BadRequestException(
        'M-Pesa environment must be sandbox or production.',
      );
    }

    if (!configuration.shortcode) {
      throw new BadRequestException(
        'M-Pesa shortcode is not configured.',
      );
    }

    if (!configuration.callbackUrl) {
      throw new BadRequestException(
        'M-Pesa callback URL is not configured.',
      );
    }

    const minimumAmount =
      configuration.minimumAmount !== null
        ? Number(configuration.minimumAmount)
        : null;

    const maximumAmount =
      configuration.maximumAmount !== null
        ? Number(configuration.maximumAmount)
        : null;

    if (minimumAmount !== null && request.amount < minimumAmount) {
      throw new BadRequestException(
        `Payment amount must be at least ${minimumAmount}.`,
      );
    }

    if (maximumAmount !== null && request.amount > maximumAmount) {
      throw new BadRequestException(
        `Payment amount must not exceed ${maximumAmount}.`,
      );
    }

    const phoneNumber = this.normalizePhoneNumber(request.phoneNumber);

    const token = await this.getAccessToken(configuration.environment);

    const timestamp = this.getTimestamp();

    const passkey = process.env.MPESA_PASSKEY;

    if (!passkey) {
      throw new InternalServerErrorException(
        'MPESA_PASSKEY is not configured.',
      );
    }

    const password = Buffer.from(
      `${configuration.shortcode}${passkey}${timestamp}`,
    ).toString('base64');

    const endpoint =
      configuration.environment === 'production'
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: Number(configuration.shortcode),
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount),
        PartyA: phoneNumber,
        PartyB: Number(configuration.shortcode),
        PhoneNumber: phoneNumber,
        CallBackURL: configuration.callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.transactionDescription,
      }),
    });

    if (!response.ok) {
      const body = await response.text();

      throw new BadRequestException(
        `M-Pesa STK request failed: ${body || response.statusText}`,
      );
    }

    const data = (await response.json()) as MpesaStkResponse;

    if (data.ResponseCode !== '0') {
      throw new BadRequestException(
        data.ResponseDescription || 'M-Pesa rejected the STK request.',
      );
    }

    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage,
    };
  }

  async handleCallback(
    payload: MpesaStkCallback,
  ): Promise<{ received: boolean }> {
    const callback = payload.Body?.stkCallback;

    if (!callback?.CheckoutRequestID) {
      throw new BadRequestException(
        'Invalid M-Pesa callback payload.',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        mpesaTransaction: {
          checkoutRequestId: callback.CheckoutRequestID,
        },
      },
      include: {
        mpesaTransaction: true,
      },
    });

    if (!payment || !payment.mpesaTransaction) {
      throw new NotFoundException(
        'Payment associated with the M-Pesa callback was not found.',
      );
    }

    const metadata = this.extractMetadata(
      callback.CallbackMetadata?.Item ?? [],
    );

    const successful = callback.ResultCode === 0;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      /*
       * Always persist the callback details.
       * Duplicate callbacks update the same transaction
       * rather than creating another transaction record.
       */
      await tx.mpesaTransaction.update({
        where: {
          paymentId: payment.id,
        },
        data: {
          merchantRequestId:
            callback.MerchantRequestID ??
            payment.mpesaTransaction!.merchantRequestId,

          checkoutRequestId:
            callback.CheckoutRequestID,

          mpesaReceiptNumber:
            metadata.mpesaReceiptNumber ??
            payment.mpesaTransaction!.mpesaReceiptNumber,

          phoneNumber:
            metadata.phoneNumber ??
            payment.mpesaTransaction!.phoneNumber,

          resultCode:
            callback.ResultCode !== undefined
              ? callback.ResultCode
              : null,

          resultDescription:
            callback.ResultDesc ?? null,

          transactionDate:
            metadata.transactionDate ??
            payment.mpesaTransaction!.transactionDate,

          callbackPayload:
            payload as Prisma.InputJsonValue,
        },
      });

      /*
       * Refunded payments are terminal from the
       * payment-processing perspective. A delayed or
       * duplicate callback must not restore them.
       */
      if (
        payment.status === PaymentStatus.REFUNDED ||
        payment.status ===
          PaymentStatus.PARTIALLY_REFUNDED
      ) {
        return;
      }

      /*
       * A completed payment must never be reverted
       * to FAILED by a duplicate or delayed callback.
       */
      if (
        payment.status === PaymentStatus.COMPLETED
      ) {
        return;
      }

      /*
       * Successful Safaricom callback.
       */
      if (successful) {
        await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: PaymentStatus.COMPLETED,

            paidAt:
              metadata.transactionDate ??
              new Date(),

            reference:
              metadata.mpesaReceiptNumber ??
              payment.reference,

            externalReference:
              callback.CheckoutRequestID,
          },
        });

        return;
      }

      /*
       * Non-zero ResultCode means the STK request
       * did not complete successfully.
       */
      if (
        payment.status !== PaymentStatus.FAILED &&
        payment.status !== PaymentStatus.CANCELLED
      ) {
        await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: PaymentStatus.FAILED,
            externalReference:
              callback.CheckoutRequestID,
          },
        });
      }
    });

    return {
      received: true,
    };
  }

  private async resolveOrganizationId(
    paymentId: string,
  ): Promise<string> {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      select: {
        organizationId: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    return payment.organizationId;
  }

  private async getAccessToken(
    environment: string,
  ): Promise<string> {
    if (
      this.accessToken &&
      Date.now() < this.accessTokenExpiresAt
    ) {
      return this.accessToken;
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      throw new InternalServerErrorException(
        'M-Pesa consumer credentials are not configured.',
      );
    }

    const host =
      environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    const credentials = Buffer.from(
      `${consumerKey}:${consumerSecret}`,
    ).toString('base64');

    const response = await fetch(
      `${host}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();

      throw new InternalServerErrorException(
        `Unable to obtain M-Pesa access token: ${
          body || response.statusText
        }`,
      );
    }

    const data =
      (await response.json()) as MpesaAccessTokenResponse;

    this.accessToken = data.access_token;

    const expiresInSeconds = Number(data.expires_in) || 3600;

    this.accessTokenExpiresAt =
      Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000;

    return this.accessToken;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    const value = phoneNumber.trim();

    if (value.startsWith('+254')) {
      return value.substring(1);
    }

    if (value.startsWith('254')) {
      return value;
    }

    if (value.startsWith('07') || value.startsWith('01')) {
      return `254${value.substring(1)}`;
    }

    throw new BadRequestException(
      'Invalid Kenyan mobile number.',
    );
  }

  private getTimestamp(): string {
    const now = new Date();

    const parts = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      String(now.getUTCDate()).padStart(2, '0'),
      String(now.getUTCHours()).padStart(2, '0'),
      String(now.getUTCMinutes()).padStart(2, '0'),
      String(now.getUTCSeconds()).padStart(2, '0'),
    ];

    return parts.join('');
  }

  private extractMetadata(
    items: Array<{ Name: string; Value?: string | number }>,
  ) {
    const get = (name: string) =>
      items.find((item) => item.Name === name)?.Value;

    const transactionDateValue =
      get('TransactionDate');

    let transactionDate: Date | null = null;

    if (transactionDateValue !== undefined) {
      const value = String(transactionDateValue);

      /*
       * Safaricom TransactionDate format:
       * YYYYMMDDHHmmss
       */
      if (/^\d{14}$/.test(value)) {
        const year = Number(value.substring(0, 4));
        const month =
          Number(value.substring(4, 6)) - 1;
        const day = Number(value.substring(6, 8));
        const hour = Number(value.substring(8, 10));
        const minute =
          Number(value.substring(10, 12));
        const second =
          Number(value.substring(12, 14));

        const parsed = new Date(
          Date.UTC(
            year,
            month,
            day,
            hour,
            minute,
            second,
          ),
        );

        /*
         * Confirm the resulting date is valid and
         * that JavaScript did not normalize invalid
         * calendar values.
         */
        if (
          !Number.isNaN(parsed.getTime()) &&
          parsed.getUTCFullYear() === year &&
          parsed.getUTCMonth() === month &&
          parsed.getUTCDate() === day &&
          parsed.getUTCHours() === hour &&
          parsed.getUTCMinutes() === minute &&
          parsed.getUTCSeconds() === second
        ) {
          transactionDate = parsed;
        }
      }
    }

    const amount = get('Amount');
    const mpesaReceiptNumber =
      get('MpesaReceiptNumber');
    const phoneNumber = get('PhoneNumber');
    const balance = get('Balance');

    return {
      amount,
      mpesaReceiptNumber:
        mpesaReceiptNumber !== undefined
          ? String(mpesaReceiptNumber)
          : null,
      transactionDate,
      phoneNumber:
        phoneNumber !== undefined
          ? String(phoneNumber)
          : null,
      balance,
    };
  }
}
