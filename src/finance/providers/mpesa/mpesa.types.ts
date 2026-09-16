export interface MpesaAccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface MpesaStkResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage?: string;
}

export interface MpesaStkCallbackItem {
  Name: string;
  Value?: string | number;
}

export interface MpesaStkCallbackMetadata {
  Item?: MpesaStkCallbackItem[];
}

export interface MpesaStkCallback {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: MpesaStkCallbackMetadata;
    };
  };
}
