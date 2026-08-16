export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 items-end bg-[#e9e3d8] p-6 text-[#142c2b] sm:p-10">
      <div className="max-w-xl border-l border-[#073b3a] pl-5 sm:pl-7">
        <p className="font-mono text-xs tracking-[0.16em] uppercase">
          JANI//OS v0.1.0
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
          System scaffold ready.
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#526965]">
          The Next.js foundation is installed. The browser operating system is
          ready to be built from here.
        </p>
      </div>
    </main>
  );
}
