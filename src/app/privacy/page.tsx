import { InfoPageLayout } from '@/components/landing/InfoPageLayout';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How WeildBuild collects, uses, and protects your data',
};

export default function PrivacyPage() {
  return (
    <InfoPageLayout
      title="Privacy Policy"
      subtitle="How WeildBuild collects, uses, and protects your data"
      lastUpdated="July 6, 2026"
    >
      <div className="prose prose-invert max-w-none">
        <p className="text-white/60 leading-relaxed mb-8">
          At WeildBuild, we take your privacy seriously. This Privacy Policy explains what information
          we collect, how we use it, and the choices you have. By using our Service, you consent to the
          data practices described in this policy.
        </p>

        {/* ─── 1. Information We Collect ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">1. Information We Collect</h2>

          <h3 className="text-lg font-semibold text-indigo-400 mb-2">Account Information</h3>
          <p className="text-white/60 leading-relaxed mb-4">
            When you create a WeildBuild account, we collect your username, an encrypted password
            (stored using scrypt hashing with salt, meaning we never see your plain-text password), and
            profile information you choose to provide, such as a profile description and avatar settings.
          </p>

          <h3 className="text-lg font-semibold text-indigo-400 mb-2">Game & Activity Data</h3>
          <p className="text-white/60 leading-relaxed mb-4">
            We store data related to your activity on the platform, including games you create, your
            Webuy currency balance, items you own, your friends list, friend requests, notifications,
            and in-game chat messages. Chat messages are automatically filtered for profanity but are
            otherwise stored to support moderation and community safety.
          </p>

          <h3 className="text-lg font-semibold text-indigo-400 mb-2">Technical Data</h3>
          <p className="text-white/60 leading-relaxed mb-4">
            We automatically collect certain technical information, including your IP address (for
            rate limiting and security), browser type, device information, and usage logs. Session
            tokens are stored as cookies to keep you logged in across sessions.
          </p>

          <h3 className="text-lg font-semibold text-indigo-400 mb-2">User-Generated Content</h3>
          <p className="text-white/60 leading-relaxed">
            Content you create in the studio, including games, scenes, scripts, and uploaded assets, is
            stored in our database and asset storage systems (including Backblaze B2 for larger files).
          </p>
        </section>

        {/* ─── 2. How We Use Your Information ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">2. How We Use Your Information</h2>
          <p className="text-white/60 leading-relaxed mb-3">We use the information we collect to:</p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Provide, operate, and maintain the WeildBuild platform</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Authenticate your account and manage sessions (up to 5 devices)</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Process transactions involving virtual currency and items</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Enable social features like friends, chat, and notifications</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Monitor for fraud, abuse, and violations of our rules</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Improve the Service, fix bugs, and develop new features</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Respond to support requests and moderation reports</span></li>
          </ul>
        </section>

        {/* ─── 3. How We Share Your Information ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">3. How We Share Your Information</h2>
          <p className="text-white/60 leading-relaxed mb-3">
            We do not sell your personal information. We may share your information in the following limited circumstances:
          </p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Public profiles.</strong> Your username, avatar, profile description, and certain stats are visible to other users by default. You can adjust profile visibility in Settings.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Service providers.</strong> We use Supabase for database hosting and Backblaze B2 for asset storage. These providers process data on our behalf under appropriate data processing agreements.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Legal compliance.</strong> We may disclose information if required by law or in response to valid legal requests.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Safety.</strong> We may share information with law enforcement or other parties when we believe it is necessary to protect the safety of our users or the public.</span></li>
          </ul>
        </section>

        {/* ─── 4. Data Security ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">4. Data Security</h2>
          <p className="text-white/60 leading-relaxed mb-3">
            We take reasonable measures to protect your data, including:
          </p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Passwords are hashed using scrypt with unique salts and never stored in plain text</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Session tokens are cryptographically random and tied to specific user accounts</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>API endpoints enforce authentication and authorization checks (requireAuth / requireAdmin)</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Rate limiting protects against brute force attacks</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Sensitive database tables (sessions, rate_limits) are blocked from direct API access</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span>Sensitive fields are stripped from user data returned by the API</span></li>
          </ul>
          <p className="text-white/60 leading-relaxed">
            No method of transmission over the internet or electronic storage is 100% secure. While we
            strive to protect your data, we cannot guarantee absolute security.
          </p>
        </section>

        {/* ─── 5. Your Choices ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">5. Your Choices</h2>
          <p className="text-white/60 leading-relaxed mb-3">You have several choices regarding your data:</p>
          <ul className="space-y-2 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Profile visibility.</strong> Toggle your profile visibility in Settings to control who can see your information.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Notification preferences.</strong> Choose which notifications you receive (friends, purchases, games) in Settings.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Visual settings.</strong> Adjust dark mode, UI scale, animations, and reduce motion in Settings.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Session management.</strong> When changing your password, you can choose to end all other device sessions.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400">•</span><span><strong className="text-white">Blocked users.</strong> Block specific users to prevent them from contacting you.</span></li>
          </ul>
        </section>

        {/* ─── 6. Data Retention ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">6. Data Retention</h2>
          <p className="text-white/60 leading-relaxed">
            We retain your account information and content for as long as your account is active. Session
            data may persist for extended periods (up to 10 years by default) to keep you logged in,
            unless you explicitly log out or change your password with the option to end other sessions.
            If you wish to delete your account, you can delete your account by accessing Settings, which
            will place your account under a 7 day timer. After the 7 days, all your information may take
            up to 5 days to be deleted completely, as traces of usage may still persist. If you wish to
            skip the waiting time, you can contact us through Discord and we will remove your personal
            data within a reasonable timeframe of 4 to 5 days, subject to legal retention requirements.
          </p>
        </section>

        {/* ─── 7. Children's Privacy ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">7. Children's Privacy</h2>
          <p className="text-white/60 leading-relaxed">
            WeildBuild is not directed at children under 13, and we do not knowingly collect personal
            information from children under 13. If we learn that we have collected personal information
            from a child under 13, we will delete that information as soon as possible. If you believe
            we have collected such information, please contact us on Discord.
          </p>
        </section>

        {/* ─── 8. Third-Party Services and Subprocessors ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">8. Third-Party Services and Subprocessors</h2>
          <p className="text-white/60 leading-relaxed mb-3">
            WeildBuild relies on trusted third-party service providers ("subprocessors") to operate, secure,
            and improve the platform. Depending on how you use WeildBuild, these providers may process
            certain personal data on our behalf.
          </p>
          <ul className="space-y-3 text-white/60 mb-3">
            <li className="flex gap-3"><span className="text-indigo-400 font-semibold">•</span><span><strong className="text-white">Supabase:</strong> Provides cloud database infrastructure, user authentication, and storage of account information, platform metadata, and application data.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 font-semibold">•</span><span><strong className="text-white">Backblaze B2:</strong> Provides secure cloud object storage for user-uploaded content, including images, audio, and game assets.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 font-semibold">•</span><span><strong className="text-white">Render:</strong> Provides cloud hosting infrastructure for the WeildBuild website, APIs, and related online services.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 font-semibold">•</span><span><strong className="text-white">Discord (Optional):</strong> If you choose to connect your Discord account or interact with our official Discord community, Discord processes information in accordance with its own Privacy Policy and Terms of Service. We only receive the information necessary to provide the requested integration.</span></li>
          </ul>
          <p className="text-white/60 leading-relaxed">
            These service providers process data only as necessary to perform the services they provide.
            While we carefully select providers that maintain appropriate security practices, each provider
            operates under its own privacy policy and terms. We encourage you to review their documentation
            to understand how they collect, use, and protect your information.
          </p>
        </section>

        {/* ─── 9. Changes to This Policy ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">9. Changes to This Policy</h2>
          <p className="text-white/60 leading-relaxed">
            We may update this Privacy Policy from time to time. When we do, we will revise the "Last
            updated" date at the top of this page. For significant changes, we will provide notice
            through the Service or our Discord server. Your continued use of WeildBuild after changes
            take effect constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* ─── 10. Contact Us ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">10. Contact Us</h2>
          <p className="text-white/60 leading-relaxed">
            If you have questions about this Privacy Policy or your personal data, reach out to us
            through our
            <a href="https://discord.gg/9FU338GYcJ" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline ml-1">Discord server</a>.
          </p>
        </section>
      </div>
    </InfoPageLayout>
  );
}
