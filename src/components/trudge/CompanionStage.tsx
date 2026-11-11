// Placeholder for the 3D companion model. Swap the inner orb for the 3D viewer later.
export function CompanionStage({ thinking }: { thinking: boolean }) {
  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48" aria-label="Trudge companion">
      <div className={`absolute inset-0 rounded-full bg-sage/30 blur-2xl ${thinking ? "animate-pulse" : ""}`} />
      <div className="trudge-orb relative h-28 w-28 rounded-full sm:h-32 sm:w-32" />
    </div>
  );
}
