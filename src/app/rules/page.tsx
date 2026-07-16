import { InfoPageLayout } from '@/components/landing/InfoPageLayout';

export const metadata = {
  title: 'Rules & Standards',
  description: 'Community rules and content standards for WeildBuild',
};

export default function RulesPage() {
  return (
    <InfoPageLayout
      title="Rules & Standards"
      subtitle="Community rules and content standards for WeildBuild"
      lastUpdated="July 2, 2026"
    >
      <div className="prose prose-invert max-w-none">
        <p className="text-white/60 leading-relaxed mb-8">
          Welcome to WeildBuild! To keep our community safe, welcoming, and creative for everyone,
          we've established a set of rules and standards that all users must follow. These rules apply
          across the entire WeildBuild platform — the website, the studio, published games, chat,
          profiles, and any user-generated content.
        </p>

        {/* ─── General Conduct ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-indigo-400">01</span> General Conduct
          </h2>
          <ul className="space-y-3 text-white/60">
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Be respectful.</strong> Treat all users with kindness. Harassment, bullying, hate speech, discrimination, or personal attacks are not tolerated.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No inappropriate content.</strong> No nudity, sexual content, gore, or excessively violent material in games, avatars, profiles, or chat.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Keep it clean.</strong> Our chat system automatically filters profanity. Attempting to bypass the filter is not allowed.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No spam.</strong> Don't flood chat, post repetitive messages, or send unsolicited advertisements.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No impersonation.</strong> Don't pretend to be another user, a staff member, or a moderator.</span></li>
          </ul>
        </section>

        {/* ─── Account Security ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-indigo-400">02</span> Account Security
          </h2>
          <ul className="space-y-3 text-white/60">
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">One account per person.</strong> Creating multiple accounts to evade bans or exploit the system is prohibited.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Keep your password secure.</strong> Never share your password with anyone. WeildBuild staff will never ask for your password.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Account sharing is discouraged.</strong> You are responsible for all activity on your account.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Accurate information.</strong> Provide accurate registration information. Usernames must not contain profanity or offensive terms.</span></li>
          </ul>
        </section>

        {/* ─── Game Content Standards ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-indigo-400">03</span> Game & Content Standards
          </h2>
          <ul className="space-y-3 text-white/60">
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Original work.</strong> Don't upload content that infringes on someone else's copyright or intellectual property.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No malicious scripts.</strong> Using WeildCode or any mechanism to crash browsers, mine cryptocurrency, or harm other users' devices is strictly forbidden.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No scams.</strong> Don't create games or content designed to trick users into giving up currency, items, or personal information.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Appropriate game titles & descriptions.</strong> Game names and descriptions must follow the same content standards as chat.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No exploits.</strong> Reporting bugs is appreciated. Exploiting them for personal gain or to disrupt the platform is not.</span></li>
          </ul>
        </section>

        {/* ─── Fair Play ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-indigo-400">04</span> Fair Play & Economy
          </h2>
          <ul className="space-y-3 text-white/60">
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No cheating.</strong> Using third-party tools, scripts, or exploits to gain unfair advantages in games is prohibited.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">No currency exploitation.</strong> Exploiting bugs to duplicate Webuy or items will result in account action.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Real-money trading.</strong> Selling in-game currency, items, or accounts for real money is not permitted.</span></li>
          </ul>
        </section>

        {/* ─── Reporting & Moderation ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-indigo-400">05</span> Reporting & Moderation
          </h2>
          <ul className="space-y-3 text-white/60">
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Report violations.</strong> If you see a user breaking these rules, report them through the in-app reporting tools or contact a moderator on Discord.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Cooperate with moderators.</strong> When a moderator contacts you about a report, please respond honestly and promptly.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Enforcement.</strong> Violations may result in warnings, content removal, temporary suspensions, or permanent bans depending on severity.</span></li>
            <li className="flex gap-3"><span className="text-indigo-400 mt-1">✓</span><span><strong className="text-white">Appeals.</strong> If you believe a moderation action was made in error, you can appeal by contacting us on Discord.</span></li>
          </ul>
        </section>

        {/* ─── Contact ─── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-indigo-400">06</span> Questions?
          </h2>
          <p className="text-white/60 leading-relaxed">
            If you have any questions about these rules, or if you're unsure whether something is allowed,
            please reach out to our team on Discord. We're happy to help clarify anything before you publish.
          </p>
          <p className="text-white/60 leading-relaxed mt-3">
            These rules may be updated from time to time. Significant changes will be announced in our
            devlog and Discord server. Continued use of WeildBuild after changes take effect constitutes
            acceptance of the updated rules.
          </p>
        </section>
      </div>
    </InfoPageLayout>
  );
}
