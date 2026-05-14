import { config } from "../customize/config";
import { createApp } from "./app/app";
import { loadSongs } from "./songs";

createApp({
  config,
  songs: loadSongs(),
}).start();
