import { SorterIndex } from "../sorterIndex/SorterIndex";
import { ActiveRoute as SorterAppRoute } from "./SorterAppRoute";

export function ActiveRoute() {
  return isSorterRoute() ? <SorterAppRoute /> : <SorterIndex />;
}

function isSorterRoute(): boolean {
  const pathname = window.location.pathname.replace(/\/+$/, "");
  return pathname === "/test" || pathname.startsWith("/test/");
}
