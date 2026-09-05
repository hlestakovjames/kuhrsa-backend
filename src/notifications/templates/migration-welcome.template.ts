export type MigrationWelcomeTemplateData = {
  firstName: string;
  lastName: string;
  memberNumber: string;
  category: string;
  identifier: string;
  activationUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildMigrationWelcomeTemplate(
  data: MigrationWelcomeTemplateData,
) {
  const firstName = escapeHtml(data.firstName);
  const lastName = escapeHtml(data.lastName);
  const memberNumber = escapeHtml(data.memberNumber);
  const category = escapeHtml(data.category);
  const identifier = escapeHtml(data.identifier);
  const activationUrl = escapeHtml(data.activationUrl);

  const subject = 'Your KUHRSA Membership Has Been Successfully Migrated';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>${subject}</title>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background: #f4f8fa;
    font-family: Arial, Helvetica, sans-serif;
    color: #0b2633;
  "
>
  <div
    style="
      max-width: 680px;
      margin: 0 auto;
      padding: 32px 18px;
    "
  >
    <div
      style="
        background: #ffffff;
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid #e6edf0;
        box-shadow: 0 8px 30px rgba(11, 38, 51, 0.08);
      "
    >
      <div
        style="
          padding: 30px 32px;
          background: #0b2633;
          color: #ffffff;
        "
      >
        <div
          style="
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            opacity: 0.7;
          "
        >
          Kisii University Human Resource Students' Association
        </div>

        <div
          style="
            margin-top: 10px;
            font-size: 28px;
            font-weight: 800;
          "
        >
          KUHRSA
        </div>
      </div>

      <div style="padding: 34px 32px;">
        <p
          style="
            margin: 0;
            font-size: 15px;
            color: #168db8;
            font-weight: 700;
          "
        >
          MEMBERSHIP MIGRATION
        </p>

        <h1
          style="
            margin: 10px 0 0;
            font-size: 28px;
            line-height: 1.25;
          "
        >
          Welcome to KUHRSA, ${firstName}
        </h1>

        <p
          style="
            margin: 18px 0 0;
            font-size: 15px;
            line-height: 1.7;
            color: #53656d;
          "
        >
          Your existing KUHRSA membership record has been
          successfully migrated into the new KUHRSA management
          system.
        </p>

        <div
          style="
            margin-top: 28px;
            border-radius: 16px;
            background: #f7fbfc;
            border: 1px solid #e6f0f3;
            padding: 20px;
          "
        >
          <div
            style="
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1.3px;
              color: #7b8b91;
              font-weight: 700;
            "
          >
            Membership Details
          </div>

          <div style="margin-top: 15px;">
            <p
              style="
                margin: 0 0 9px;
                font-size: 14px;
              "
            >
              <strong>Member:</strong>
              ${firstName} ${lastName}
            </p>

            <p
              style="
                margin: 0 0 9px;
                font-size: 14px;
              "
            >
              <strong>Member Number:</strong>
              ${memberNumber}
            </p>

            <p
              style="
                margin: 0 0 9px;
                font-size: 14px;
              "
            >
              <strong>Category:</strong>
              ${category}
            </p>

            <p
              style="
                margin: 0;
                font-size: 14px;
              "
            >
              <strong>Identifier:</strong>
              ${identifier}
            </p>
          </div>
        </div>

        <div
          style="
            margin-top: 28px;
            padding: 20px;
            border-radius: 16px;
            background: #eef9fd;
            border: 1px solid #d5edf5;
          "
        >
          <p
            style="
              margin: 0;
              font-size: 14px;
              line-height: 1.7;
              color: #335762;
            "
          >
            Your membership has been migrated, but your online
            account still needs to be activated. Account
            activation will allow you to access the KUHRSA
            member portal.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a
            href="${activationUrl}"
            style="
              display: inline-block;
              background: #168db8;
              color: #ffffff;
              text-decoration: none;
              padding: 14px 24px;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 700;
            "
          >
            Activate My KUHRSA Account
          </a>
        </div>

        <p
          style="
            margin: 25px 0 0;
            font-size: 13px;
            line-height: 1.7;
            color: #728188;
          "
        >
          Migrated members do not need to pay the KUHRSA
          registration fee again. Follow the activation
          instructions provided through the KUHRSA system.
        </p>

        <p
          style="
            margin: 18px 0 0;
            font-size: 13px;
            line-height: 1.7;
            color: #728188;
          "
        >
          If you did not expect this notification, please
          contact the KUHRSA administration team.
        </p>
      </div>

      <div
        style="
          padding: 22px 32px;
          border-top: 1px solid #edf2f4;
          background: #fbfdfe;
          font-size: 12px;
          line-height: 1.6;
          color: #7b8b91;
        "
      >
        This is an automated KUHRSA system notification.
        Please do not reply directly to this email.
      </div>
    </div>
  </div>
</body>
</html>
`;

  const text = `
KUHRSA MEMBERSHIP MIGRATION

Welcome to KUHRSA, ${data.firstName} ${data.lastName}.

Your existing KUHRSA membership record has been successfully
migrated into the KUHRSA management system.

Membership Details
------------------
Member: ${data.firstName} ${data.lastName}
Member Number: ${data.memberNumber}
Category: ${data.category}
Identifier: ${data.identifier}

Your online KUHRSA account still needs to be activated.

Activate your account:
${data.activationUrl}

Migrated members do not need to pay the KUHRSA registration
fee again.

If you did not expect this notification, please contact the
KUHRSA administration team.

This is an automated KUHRSA system notification.
`;

  return {
    subject,
    html,
    text,
  };
}
