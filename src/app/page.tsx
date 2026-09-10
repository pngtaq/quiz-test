import { ButtonLink } from "@/components/ui/Button";

const FEATURES = [
  {
    icon: "⚡",
    title: "Truly real-time",
    text: "Questions, timers and scores stay in sync for every player over WebSockets.",
  },
  {
    icon: "🏆",
    title: "Speed scoring",
    text: "1,000 points for a correct answer, plus up to 500 bonus points for answering fast.",
  },
  {
    icon: "📱",
    title: "Any device",
    text: "Play from a phone, tablet or laptop. Just share the 5-character room code.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center py-6 text-center sm:py-14">
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
        Multiplayer quiz rooms
      </span>
      <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
        QuizTogether
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Create a room, invite your friends, and compete in real time.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <ButtonLink href="/create" size="lg">
          Create Room
        </ButtonLink>
        <ButtonLink href="/join" size="lg" variant="secondary">
          Join Room
        </ButtonLink>
      </div>

      <ul className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span aria-hidden="true" className="text-2xl">
              {feature.icon}
            </span>
            <h2 className="mt-2 font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{feature.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
