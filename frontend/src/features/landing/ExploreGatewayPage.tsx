import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { pageTransitionOut } from "@/animations/transitions";
import { ExploreTransition } from "./ExploreTransition";

/** The "/explore" route — a dedicated gateway screen, not a fake
 * placeholder: its CTA plays a real page-transition-out animation, then
 * navigates into the (lazy-loaded) command center. */
export function ExploreGatewayPage() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const handleExplore = async () => {
    if (rootRef.current) {
      await pageTransitionOut(rootRef.current);
    }
    navigate("/command-center");
  };

  return (
    <div ref={rootRef}>
      <ExploreTransition onExplore={() => void handleExplore()} />
    </div>
  );
}
