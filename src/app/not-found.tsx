import NextImage from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a1a] gap-6 p-8">
      <img
        src="/404-image.png"
        alt="Page not found"
        className="w-64 h-64 object-contain"
      />
      <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
      <p className="text-slate-400 text-center max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <a
        href="/"
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
      >
        ← Go Home
      </a>
    </div>
  );
}
