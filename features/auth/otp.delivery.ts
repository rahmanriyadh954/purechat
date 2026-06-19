type OtpDeliveryInput = {
  identifier: string;
  code: string;
  purpose: string;
};

export async function deliverOtpCode(input: OtpDeliveryInput) {
  if (process.env.OTP_PROVIDER === "console" || process.env.NODE_ENV !== "production") {
    console.info(
      `[PureChat OTP] ${input.purpose} code for ${input.identifier}: ${input.code}`
    );
    return;
  }

  // Production hook:
  // - Email codes should go through a trusted email provider.
  // - Phone codes should go through a trusted SMS provider.
  // - Do not return OTP codes from API responses.
}
