import { LoadingState } from "~/components/common/states";

/** The map fills the shell, so a card-list skeleton would be the wrong shape. */
export default function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-forum-medium-gray/60">
      <LoadingState label="Loading map…" />
    </div>
  );
}
