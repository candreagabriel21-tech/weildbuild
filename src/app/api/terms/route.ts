// ==================== TERMS OF SERVICE API ====================
// GET /api/terms — Fetch Terms of Use text
// Used by the WeildBuild desktop app

import { NextResponse } from "next/server";

const TERMS_OF_USE = `WeildBuild Terms of Use

Last updated: 2024

1. ACCEPTANCE OF TERMS
By using WeildBuild, you agree to these Terms of Use. If you do not agree, please do not use the platform.

2. DESCRIPTION OF SERVICE
WeildBuild is a creative platform where users can create, share, and play games and virtual items. The platform includes virtual currency (WeBuy) for purchasing items.

3. USER ACCOUNTS
- You must provide accurate information when creating an account.
- You are responsible for maintaining the security of your account.
- You must be at least 13 years old to use WeildBuild.

4. VIRTUAL CURRENCY (WeBuy)
- WeBuy is a virtual currency with no real-world monetary value.
- WeBuy cannot be refunded, exchanged, or transferred for real money.
- WeildBuild reserves the right to adjust WeBuy balances in cases of errors or exploitation.

5. USER-GENERATED CONTENT
- You retain ownership of content you create.
- By sharing content on WeildBuild, you grant us a license to display and distribute it on the platform.
- You must not upload content that is illegal, harmful, threatening, abusive, or otherwise objectionable.

6. PROHIBITED CONDUCT
- Exploiting bugs or glitches for personal gain.
- Harassing, bullying, or threatening other users.
- Creating multiple accounts to circumvent restrictions.
- Attempting to hack, disrupt, or overload the platform.

7. TERMINATION
We may suspend or terminate accounts that violate these Terms of Use, with or without notice.

8. DISCLAIMER
WeildBuild is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service.

9. CHANGES TO TERMS
We may update these Terms of Use at any time. Continued use of the platform constitutes acceptance of the updated terms.

For questions or concerns, contact: weildbild.game@gmail.com`;

export async function GET() {
  return NextResponse.json({ terms: TERMS_OF_USE });
}
