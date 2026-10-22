import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CollectionStatus = ({ name, label, loading, error, empty, onRetry }) => {
  if (loading) return (
    <p role="status" className="mt-6 flex items-center gap-2 text-sm text-botanical-muted" data-testid={`${name}-loading`}>
      <Loader2 className="h-4 w-4 animate-spin" /> Loading {label}…
    </p>
  );
  if (error) return (
    <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-botanical-forest/15 py-4 text-sm text-botanical-ink" data-testid={`${name}-error`}>
      <span data-testid={`${name}-error-message`}>Couldn’t load {label}. Please try again.</span>
      <Button variant="outline" onClick={onRetry} className="rounded-full" data-testid={`${name}-retry-btn`}>
        <RefreshCw className="mr-2 h-4 w-4" /> Retry
      </Button>
    </div>
  );
  return empty ? <p className="mt-6 text-sm text-botanical-muted" data-testid={`${name}-empty`}>No entries available.</p> : null;
};