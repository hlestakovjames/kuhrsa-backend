interface MemberWelcomeTemplateInput {
  firstName: string;
  lastName: string;
  memberNumber: string;
  category: string;
  identifier: string;
  activationUrl: string;
}

interface MemberWelcomeTemplate {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildMemberWelcomeTemplate(
  input: MemberWelcomeTemplateInput,
): MemberWelcomeTemplate {
  const firstName = escapeHtml(input.firstName);
  const lastName = escapeHtml(input.lastName);
  const memberNumber = escapeHtml(input.memberNumber);
  const category = escapeHtml(input.category);
  const identifier = escapeHtml(input.identifier);
  const activationUrl = input.activationUrl;

  const subject = 'Welcome to KUHRSA — Activate Your Account';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f7fb;
    font-family:Arial,Helvetica,sans-serif;
    color:#1f2937;
  "
>
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div
      style="
        background:#ffffff;
        border-radius:12px;
        overflow:hidden;
        border:1px solid #e5e7eb;
      "
    >
      <div
        style="
          background:#0b1b3a;
          padding:28px 32px;
          text-align:center;
        "
      >
        <h1
          style="
            margin:0;
            color:#ffffff;
            font-size:28px;
            letter-spacing:.3px;
          "
        >
          KUHRSA
        </h1>

        <p
          style="
            margin:8px 0 0;
            color:#dbeafe;
            font-size:14px;
          "
        >
          Kisii University Human Resource Students' Association
        </p>
      </div>

      <div style="padding:32px;">
        <p style="margin:0 0 18px;font-size:16px;">
          Dear <strong>${firstName} ${lastName}</strong>,
        </p>

        <p style="margin:0 0 18px;line-height:1.7;">
          Your KUHRSA membership record has been created in the
          KUHRSA Integrated Management System.
        </p>

        <div
          style="
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:10px;
            padding:18px;
            margin:24px 0;
          "
        >
          <p
            style="
              margin:0 0 8px;
              font-size:14px;
              color:#64748b;
            "
          >
            Membership Details
          </p>

          <p style="margin:6px 0;">
            <strong>Member Number:</strong> ${memberNumber}
          </p>

          <p style="margin:6px 0;">
            <strong>Category:</strong> ${category}
          </p>

          <p style="margin:6px 0;">
            <strong>Identifier:</strong> ${identifier}
          </p>
        </div>

        <p style="margin:0 0 20px;line-height:1.7;">
          Your KUHRSA account is currently pending activation.
          Please activate your account and create your password
          using the button below.
        </p>

        <div style="text-align:center;margin:30px 0;">
          <a
            href="${activationUrl}"
            style="
              display:inline-block;
              background:#1e90ff;
              color:#ffffff;
              text-decoration:none;
              padding:13px 24px;
              border-radius:7px;
              font-weight:bold;
            "
          >
            Activate My KUHRSA Account
          </a>
        </div>

        <p
          style="
            margin:0 0 14px;
            line-height:1.7;
            font-size:14px;
            color:#475569;
          "
        >
          You will be asked to verify your membership details before
          creating your password.
        </p>

        <p
          style="
            margin:0;
            line-height:1.7;
            font-size:14px;
            color:#64748b;
          "
        >
          For your security, do not share your activation details
          with another person.
        </p>

        <hr
          style="
            border:none;
            border-top:1px solid #e5e7eb;
            margin:28px 0;
          "
        />

        <p
          style="
            margin:0;
            font-size:13px;
            color:#64748b;
            line-height:1.6;
          "
        >
          If you did not expect this membership record or believe
          this message was sent to you in error, please contact
          KUHRSA administration.
        </p>
      </div>

      <div
        style="
          background:#f8fafc;
          padding:20px 32px;
          text-align:center;
        "
      >
        <p
          style="
            margin:0;
            font-size:12px;
            color:#94a3b8;
          "
        >
          KUHRSA Integrated Management System
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Dear ${input.firstName} ${input.lastName},

Your KUHRSA membership record has been created in the KUHRSA Integrated Management System.

Membership Details:
Member Number: ${input.memberNumber}
Category: ${input.category}
Identifier: ${input.identifier}

Your KUHRSA account is currently pending activation.

Activate your account and create your password here:

${input.activationUrl}

You will be asked to verify your membership details before creating your password.

For your security, do not share your activation details with another person.

If you did not expect this membership record or believe this message was sent to you in error, please contact KUHRSA administration.

KUHRSA Integrated Management System
`.trim();

  return {
    subject,
    html,
    text,
  };
}
