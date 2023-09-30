import { run } from "./main";
import { setFailed } from "@actions/core";

run().catch((error) => {
  if (error instanceof Error) {
      setFailed(error);
  }
});
