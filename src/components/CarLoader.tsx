import { MatchWheelsLogo } from "./MatchWheelsLogo";

export function CarLoader({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-10">
      <div className="relative h-28 w-28">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-border" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="car-loop">
            <MatchWheelsLogo size={28} />
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {message}
      </p>
    </div>
  );
}
