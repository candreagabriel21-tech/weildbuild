import { InfoPageLayout } from '@/components/landing/InfoPageLayout';

export const metadata = {
  title: 'Devlogs',
  description: 'The latest updates and changes to WeildBuild',
};

export default function DevlogsPage() {
  return (
    <InfoPageLayout
      title="Devlogs"
      subtitle="The latest updates and changes to WeildBuild"
      lastUpdated="July 2, 2026"
    >
      {/* ─── Huge Update Drop Warning ─── */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            Latest
          </span>
          <span className="text-white/30 text-sm">July 2, 2026</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Huge Update Drop Warning!</h2>
        <h3 className="text-lg font-semibold text-indigo-400 mb-4">Welcome to Update 1.3.0: The Editor Overhaul</h3>
        <p className="text-white/60 leading-relaxed mb-6">
          As you guys know, I've been working on a new update, and I have great news! It's out for early access!!
        </p>
        <p className="text-white/60 leading-relaxed mb-6">
          This update is focused on the WeildCreate/Create/Editor, but there are also many smaller improvements.
          Here's a partially complete devlog of everything that was added.
        </p>

        {/* ─── What Was Added ─── */}
        <h2 className="text-2xl font-bold text-white mb-4 mt-8">What Was Added</h2>

        {/* Editor */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Editor</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Replaced the logos with two versions: <strong className="text-white">Square Logo</strong> (the small cube logo) and <strong className="text-white">Text Logo</strong> (the WeildBuild text logo), which will replace them across the website.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a new, much more complete toolbar. It includes the basic Move, Scale and Rotate tools, along with Paste, Cut, Copy, Dupe, Redo, Select, Material, Color, Group and Ungroup.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added toolbar tabs, which reveal more tools when clicked while hiding the previous ones. The tabs include <strong className="text-white">File, Home, Model, Terrain, Test</strong> and <strong className="text-white">View</strong>.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a <strong className="text-white">File</strong> tab containing project-related buttons such as Publish, Save, Load, New Universe, Published Games and Reset Project (shown as New, Published and Reset), along with all of your Universes.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a <strong className="text-white">Test</strong> button, which plays a version of the original Test Play mode without spawning a character, entirely inside the editor. It can be found at the end of the Home tab and at the beginning of the Test tab.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a new <strong className="text-white">Output</strong> panel, which displays tool usage, selections and other events happening in the editor, including Test mode.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added an <strong className="text-white">Axis Indicator (X/Y/Z)</strong>. Clicking one of the axes rotates the camera to face that direction.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added settings in the <strong className="text-white">View</strong> tab to enable or disable the Baseplate Grid, Object Snap, Axis Indicator, Explorer, Properties and Output panels.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added the ability to deselect an object by clicking the sky or an empty space in the Explorer. A future update will also allow deselecting objects by clicking them again.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>All primitives (Block, Sphere, Wedge and Cylinder) now have improved colors and are four times smaller than before.</span></li>
          </ul>
        </section>

        {/* Lighting & Physics */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Lighting & Physics</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a new <strong className="text-white">lighting</strong> system with day/night cycles, better skies with clouds and stars, smooth sky color transitions and a more realistic moon.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added object physics with Friction, Elasticity and Density settings. <strong className="text-white">Unanchored</strong> objects will fall and behave physically, while <strong className="text-white">anchored</strong> objects remain stationary.</span></li>
          </ul>
        </section>

        {/* Universes */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Universes</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added <strong className="text-white">Universes</strong>, which act as separate worlds within the same project. You can create up to three Universes. Changes made in one Universe do not affect the others, and players can be sent between them using the new <strong className="text-white">Send Player to Universe</strong> action.</span></li>
          </ul>
        </section>

        {/* Model */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Model</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added <strong className="text-white">Union</strong>, <strong className="text-white">Negate</strong>, <strong className="text-white">De-negate</strong> and <strong className="text-white">Separate</strong> tools.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added <strong className="text-white">Weld</strong>, <strong className="text-white">Motor Joint</strong>, <strong className="text-white">Rope</strong>, <strong className="text-white">Untie</strong> and <strong className="text-white">Break</strong> tools for connecting and separating objects.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added new object effects: <strong className="text-white">Explode</strong>, <strong className="text-white">Fire</strong>, <strong className="text-white">Smoke</strong> and <strong className="text-white">Light</strong>.</span></li>
          </ul>
        </section>

        {/* Globals & Timers */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Globals & Timers</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added <strong className="text-white">Globals</strong> and <strong className="text-white">Vars</strong> buttons in the Model tab. These allow you to create Global Variables that every object can access, along with Timers that repeat after a specified number of seconds, either once or forever.</span></li>
          </ul>
        </section>

        {/* Terrain */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Terrain</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added voxel-based <strong className="text-white">Terrain Generation</strong>.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added terrain settings including custom size, height, layers, seed and other options.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added terrain brushes including Raise, Lower, Smooth, Flatten, Erode, Sculpt and Paint.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added water, trees and several terrain presets.</span></li>
          </ul>
        </section>

        {/* Characters */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Characters</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Character body parts can now be edited. Deleting a body part removes it from every player's character. Colors, size, position and rotation can also be modified.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Character parts include a <strong className="text-white">Modify Player's Avatar</strong> option. When enabled, modifications (such as color) are applied to every player's avatar.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added screen animations, including landing, jumping and sprint animations. These can be disabled in the Settings menu.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added Sprinting (hold <strong className="text-white">Shift</strong>) and First Person camera mode (zoom in).</span></li>
          </ul>
        </section>

        {/* Explorer */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Explorer</h3>
          <p className="text-white/60 mb-2">Added new Explorer subfolders for future functionality. The current structure includes:</p>
          <ul className="space-y-1 text-white/60 mb-4 ml-4">
            <li>• Primitives</li>
            <li>• Player</li>
            <li className="ml-4">• Character</li>
            <li className="ml-4">• Inventory</li>
            <li>• Interface</li>
            <li>• OverseerTools</li>
          </ul>
        </section>

        {/* Rules */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Rules</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added two rule modes:</span></li>
            <li className="flex gap-2 ml-4"><span className="text-indigo-400">◦</span> <span><strong className="text-white">Simple</strong> (visual rule editor)</span></li>
            <li className="flex gap-2 ml-4"><span className="text-indigo-400">◦</span> <span><strong className="text-white">Advanced</strong> (manual code editing)</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a toggle button next to the Trash icon that enables or disables a rule without deleting it.</span></li>
          </ul>
        </section>

        {/* BodyMovers */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">BodyMovers</h3>
          <p className="text-white/60 mb-2">Added BodyMovers, which function similarly to scripts that apply physical movement to objects. These include:</p>
          <ul className="space-y-1 text-white/60 mb-4 ml-4">
            <li>• Force</li>
            <li>• Velocity</li>
            <li>• Position</li>
            <li>• Gyro</li>
            <li>• Thrust</li>
            <li>• AngVel (Angular Velocity)</li>
          </ul>
        </section>

        {/* Shop & Items */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Shop & Items</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Improved Shop item previews by displaying items on a 3D model.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>The purchase button now displays <strong className="text-white">Buy: (price)</strong>.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a <strong className="text-white">More</strong> button (three dots) that displays additional information about an item.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Items now include <strong className="text-white">Date Created</strong> and <strong className="text-white">Creator</strong> fields.</span></li>
          </ul>
        </section>

        {/* Backend */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Backend</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added the <strong className="text-white">Object-Key Protocol</strong>. Every item and user now has a unique key used internally instead of names or usernames, allowing multiple objects with identical names.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Visiting <code className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-sm">weildbuild.onrender.com/(item/user key)</code> opens the corresponding user or item profile.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a custom <strong className="text-white">404 page</strong> for invalid Object Keys.</span></li>
          </ul>
        </section>

        {/* Website & Interface */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-indigo-400 mb-3">Website & Interface</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added new website pages: <strong className="text-white">/rules</strong>, <strong className="text-white">/terms</strong>, <strong className="text-white">/devlogs</strong>, and <strong className="text-white">/privacy</strong>.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Added a Discord icon to the top bar. Clicking it displays an invitation to join our Discord server.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>The <strong className="text-white">WeBuy</strong> icons in the Home and Shop tabs are now clickable, displaying a short description explaining what WeBuy is.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>The <strong className="text-white">Profile</strong> tab now includes <strong className="text-white">Online Status</strong>, <strong className="text-white">Badges</strong>, and shortcuts to the <strong className="text-white">Avatar Editor</strong>, <strong className="text-white">Shop</strong>, <strong className="text-white">Friends</strong>, and <strong className="text-white">Settings</strong>.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>Updated the <strong className="text-white">Profile</strong> tab UI for a cleaner and better visual appearance.</span></li>
            <li className="flex gap-2"><span className="text-indigo-400">•</span> <span>In the <strong className="text-white">Home</strong> tab, the <strong className="text-white">WeBuy</strong>, <strong className="text-white">Items</strong>, <strong className="text-white">Games</strong>, and <strong className="text-white">Friends</strong> cards that display their counts are now 50% smaller for a cleaner visual appearance.</span></li>
          </ul>
        </section>

        {/* ─── What Was Removed ─── */}
        <h2 className="text-2xl font-bold text-white mb-4 mt-8">What Was Removed</h2>

        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Rules</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Most rule actions were removed and replaced with a much more flexible system that allows players to create whatever they want.</span></li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Toolbox</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed the Gameplay, Structure and Environment categories, along with object presets. These will return in a redesigned form.</span></li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Editor</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed the original <strong className="text-white">Wire</strong> tool.</span></li>
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed WeildCreate's shifting colors. The name itself may also be removed in the future to save screen space.</span></li>
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed click-to-place object placement temporarily.</span></li>
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed the Explorer search bar temporarily.</span></li>
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed the selected object indicator temporarily.</span></li>
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed the <strong className="text-white">Locked</strong> object option permanently, since it could permanently prevent selecting an object.</span></li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-400 mb-3">World</h3>
          <ul className="space-y-2 text-white/60 mb-4">
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed the automatically generated Spawn Place, Baseplate and Invisible Ground.</span></li>
            <li className="flex gap-2"><span className="text-red-400">•</span> <span>Removed the <strong className="text-white">Fog</strong> weather event temporarily because it conflicted with the new lighting system.</span></li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Shop</h3>
          <p className="text-white/60 leading-relaxed">
            Most Shop faces have been removed permanently and will be replaced with faces that better match WeildBuild's style.
            If enough players request them, they may return. Most of these faces were originally created by my friend Megan,
            who sadly passed away a few months ago. I decided to replace them with the faces she created for the early game tests.
          </p>
        </section>

        {/* ─── Dev Notes ─── */}
        <h2 className="text-2xl font-bold text-white mb-4 mt-8">Dev Notes</h2>
        <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/10 p-6">
          <p className="text-white/60 leading-relaxed">
            There are still many bugs to fix and many planned features to come. Some of these include improved character physics,
            movement, climbing, actual shirts and pants, and much more!
          </p>
        </div>
      </section>

      {/* More devlogs will be added here as future updates are released */}
      <section className="text-center py-12 border-t border-white/5">
        <p className="text-white/30 text-sm">More devlogs coming soon. Stay tuned for future updates!</p>
      </section>
    </InfoPageLayout>
  );
}
