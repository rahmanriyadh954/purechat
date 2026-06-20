type OtpDeliveryInput = {
  identifier: string;
  code: string;
  purpose: string;
};

export type OtpDeliveryResult = {
  provider: "console" | "email" | "sms";
  message: string;
};

export function getOtpDeliveryMessage(): OtpDeliveryResult {
  const provider = process.env.OTP_PROVIDER === "email" || process.env.OTP_PROVIDER === "sms"
    ? process.env.OTP_PROVIDER
    : "console";

  if (provider === "console") {
    return {
      provider,
      message: "Your verification code was generated in the server logs."
    };
  }

  return {
    provider,
    message: "A real email or SMS provider is not configured yet. Use OTP_PROVIDER=console for testing."
  };
}

export async function deliverOtpCode(input: OtpDeliveryInput) {
  const delivery = getOtpDeliveryMessage();

  if (delivery.provider === "console") {
    console.info(
      `[PureChat OTP] ${input.purpose} code for ${input.identifier}: ${input.code}`
    );
    return delivery;
  }

  // Production hook:
  // - Email codes should go through a trusted email provider.
  // - Phone codes should go through a trusted SMS provider.
  // - Do not return OTP codes from API responses.
  return delivery;
}
