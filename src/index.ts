import { run } from "./main.js";
import { setFailed } from "@actions/core";

run().catch((error) => {
  if (error instanceof Error) {
      setFailed(error);
  }
});
