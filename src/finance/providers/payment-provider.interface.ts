export interface PaymentProviderStkRequest {
  paymentId: string;
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDescription: string;
}

export interface PaymentProviderStkResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage?: string;
}

export interface PaymentProvider {
  initiateStkPush(
    request: PaymentProviderStkRequest,
  ): Promise<PaymentProviderStkResponse>;
}
