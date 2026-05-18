import { createRoot } from "react-dom/client";
import { config } from "../customize/config";
import { songList } from "../customize/songList";
import { App } from "./app/App";
import { exposeHistoryMigrationTool } from "./app/historyMigrationTool";
import { CustomizeImporter } from "./customizeImporter/CustomizeImporter";

exposeHistoryMigrationTool(config.localStoragePrefix, songList);

createRoot(document.querySelector<HTMLElement>("#root")!).render(
  window.location.pathname.endsWith("/import") ? <CustomizeImporter config={config} /> : <App config={config} songs={songList} />,
);
