import { InfoPageLayout } from '@/components/landing/InfoPageLayout';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for WeildBuild',
};

export default function TermsPage() {
  return (
    <InfoPageLayout
      title="Terms of Service"
      subtitle="The terms and conditions for using WeildBuild"
      lastUpdated="July 2, 2026"
    >
      <div className="prose prose-invert max-w-none">
        <p className="text-white/60 leading-relaxed mb-8">
          Welcome to WeildBuild. By creating an account, accessing our website, or using any of our
          services, you agree to these Terms of Service. Please read them carefully. If you do not
          agree with any part of these terms, you should not use WeildBuild.
        </p>

        {/* ─── 1. Acceptance of Terms ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
          <p className="text-white/60 leading-relaxed">
            These Terms of Service ("Terms") govern your use of the WeildBuild website, studio editor,
            game platform, and any related services (collectively, the "Service"). The Service is provided
            by WeildBuild ("we", "us", or "our"). By using the Service, you confirm that you have read,
            understood, and agree to be bound by these Terms. If you are using the Service on behalf of
            an organization, you represent that you have authority to bind that organization to these Terms.
          </p>
        </section>

        {/* ─── 2. Eligibility ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">2. Eligibility</h2>
          <p className="text-white/60 leading-relaxed">
            You must be at least 13 years old to create a WeildBuild account. If you are under 18, you
            represent that your parent or legal guardian has reviewed and agreed to these Terms on your
            behalf. We do not knowingly collect personal information from children under 13 in compliance
            with the Children's Online Privacy Protection Act (COPPA). If you believe a child under 13
            has provided us with personal information, please contact us so we can delete it.
          </p>
        </section>

        {/* ─── 3. Accounts ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">3. Accounts</h2>
          <p className="text-white/60 leading-relaxed mb-3">
            To access most features of WeildBuild, you must create an account. You are responsible for:
          </p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Maintaining the confidentiality of your password</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>All activities that occur under your account</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Providing accurate and complete registration information</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Promptly notifying us of any unauthorized use of your account</span></li>
          </ul>
          <p className="text-white/60 leading-relaxed">
            We reserve the right to suspend or terminate accounts that violate these Terms or our
            <a href="/rules" className="text-indigo-400 hover:text-indigo-300 underline ml-1">Rules & Standards</a>.
          </p>
        </section>

        {/* ─── 4. User-Generated Content ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">4. User-Generated Content</h2>
          <p className="text-white/60 leading-relaxed mb-3">
            WeildBuild allows users to create and publish games, avatars, and other content. You retain
            ownership of content you create, but you grant us a worldwide, non-exclusive, royalty-free
            license to host, store, use, display, and distribute that content as needed to operate the Service.
          </p>
          <p className="text-white/60 leading-relaxed mb-3">You represent and warrant that your content:</p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Does not infringe on any third party's intellectual property rights</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Is not defamatory, obscene, illegal, or harmful</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Does not contain malware or malicious code</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Complies with all applicable laws and our Rules & Standards</span></li>
          </ul>
          <p className="text-white/60 leading-relaxed">
            We reserve the right to remove any content that violates these Terms or that we deem
            inappropriate, at our sole discretion.
          </p>
        </section>

        {/* ─── 5. Virtual Currency & Items ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">5. Virtual Currency & Items</h2>
          <p className="text-white/60 leading-relaxed">
            WeildBuild uses a virtual currency called "Webuy" which can be earned through gameplay or
            purchased. Webuy and virtual items have no real-world monetary value and cannot be exchanged
            for cash or sold for real money. We reserve the right to adjust Webuy balances, item prices,
            or the availability of virtual items at any time. We are not liable for any loss of virtual
            currency or items due to service outages, bugs, or account termination.
          </p>
        </section>

        {/* ─── 6. Acceptable Use ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">6. Acceptable Use</h2>
          <p className="text-white/60 leading-relaxed mb-3">You agree not to:</p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-red-400">✕</span><span>Use the Service for any illegal purpose</span></li>
            <li className="flex gap-3"><span className="text-red-400">✕</span><span>Attempt to disrupt, overload, or gain unauthorized access to our systems</span></li>
            <li className="flex gap-3"><span className="text-red-400">✕</span><span>Use bots, scripts, or automated tools to exploit the platform</span></li>
            <li className="flex gap-3"><span className="text-red-400">✕</span><span>Reverse engineer, decompile, or otherwise attempt to extract source code</span></li>
            <li className="flex gap-3"><span className="text-red-400">✕</span><span>Interfere with other users' enjoyment of the Service</span></li>
            <li className="flex gap-3"><span className="text-red-400">✕</span><span>Impersonate WeildBuild staff, moderators, or other users</span></li>
          </ul>
        </section>

        {/* ─── 7. Service Availability ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">7. Service Availability</h2>
          <p className="text-white/60 leading-relaxed">
            WeildBuild is provided on an "as is" and "as available" basis. We do not guarantee that the
            Service will be uninterrupted, secure, or error-free. We may modify, suspend, or discontinue
            the Service (or any part of it) at any time, with or without notice. We are not liable to you
            or any third party for any modification, suspension, or discontinuance of the Service.
          </p>
        </section>

        {/* ─── 8. Intellectual Property ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">8. Intellectual Property</h2>
          <p className="text-white/60 leading-relaxed">
            The WeildBuild platform, including its software, design, logos, and brand assets, is owned by
            us and protected by intellectual property laws. These Terms do not grant you any right to use
            our trademarks or other proprietary information. User-generated content remains the property
            of the respective creators, subject to the license granted in Section 4.
          </p>
        </section>

        {/* ─── 9. Disclaimer & Limitation of Liability ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">9. Disclaimer & Limitation of Liability</h2>
          <p className="text-white/60 leading-relaxed mb-3">
            The Service is provided without warranties of any kind, either express or implied. To the
            fullest extent permitted by law, WeildBuild and its operators shall not be liable for:
          </p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Indirect, incidental, or consequential damages</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Loss of data, virtual currency, or virtual items</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Service interruptions or downtime</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Content posted by other users</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Any third-party conduct or content</span></li>
          </ul>
        </section>

        {/* ─── 10. Changes to Terms ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">10. Changes to Terms</h2>
          <p className="text-white/60 leading-relaxed">
            We may update these Terms from time to time. When we do, we will revise the "Last updated"
            date at the top of this page. For significant changes, we will provide notice through the
            Service or our Discord server. Your continued use of WeildBuild after changes take effect
            constitutes acceptance of the updated Terms.
          </p>
        </section>

        {/* ─── 11. Contact ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">11. Contact Us</h2>
          <p className="text-white/60 leading-relaxed">
            If you have questions about these Terms, you can reach us through our
            <a href="https://discord.gg/9FU338GYcJ" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline ml-1">Discord server</a>.
          </p>
        </section>
      </div>
    </InfoPageLayout>
  );
}
