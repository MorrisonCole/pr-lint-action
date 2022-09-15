import { jest, describe, expect, test } from "@jest/globals";
import { alreadyRequiredChanges } from "./main";

jest.mock("@actions/core", () => ({
  ...(jest.requireActual("@actions/core") as any),
  getInput: () => "",
}));

jest.mock("@actions/github");

describe("alreadyRequiredChanges", () => {
  test.each(["CHANGES_REQUESTED", "COMMENTED"])(
    "returns true when state is %p",
    () => {
      expect(alreadyRequiredChanges("CHANGES_REQUESTED")).toBe(true);
    }
  );
});
